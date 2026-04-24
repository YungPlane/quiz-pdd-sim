import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = new Database(join(__dirname, 'quiz.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fio TEXT NOT NULL,
    school TEXT NOT NULL,
    score INTEGER NOT NULL,
    totalQuestions INTEGER NOT NULL,
    percentage INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    answers TEXT NOT NULL,
    quiz_type TEXT DEFAULT 'sim',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Initialize default settings
const existingSetting = db.prepare('SELECT * FROM settings WHERE key = ?').get('authRequired');
if (!existingSetting) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('authRequired', 'true');
  console.log('Default settings initialized: authRequired=true');
}

// Create default admin if not exists
const defaultAdmin = db.prepare('SELECT * FROM admins WHERE username = ?').get('admin');
if (!defaultAdmin) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hashedPassword);
  console.log('Default admin created: username=admin, password=admin123');
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// API Routes

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const validPassword = bcrypt.compareSync(password, admin.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username: admin.username });
});

// Verify admin token
app.get('/api/admin/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// Get all results (admin only)
app.get('/api/results', authenticateToken, (req, res) => {
  const { page = 1, limit = 20, sortBy = 'created_at', order = 'DESC', search = '', quizType = '' } = req.query;
  
  const offset = (page - 1) * limit;
  const searchPattern = `%${search}%`;
  
  // Build WHERE clause based on filters
  let whereClause = '(fio LIKE ? OR school LIKE ?)';
  let params = [searchPattern, searchPattern];
  
  if (quizType && ['sim', 'pdd', 'med'].includes(quizType)) {
    whereClause += ' AND quiz_type = ?';
    params.push(quizType);
  }
  
  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM results WHERE ${whereClause}`);
  const { total } = countStmt.get(...params);
  
  // Valid sort columns
  const validSortColumns = ['id', 'fio', 'school', 'score', 'percentage', 'passed', 'created_at'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  // Get results
  const results = db.prepare(`
    SELECT * FROM results 
    WHERE ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);
  
  // Parse answers JSON
  const parsedResults = results.map(r => ({
    ...r,
    answers: JSON.parse(r.answers)
  }));
  
  res.json({
    results: parsedResults,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// Save quiz result
app.post('/api/results', (req, res) => {
  const { fio, school, score, totalQuestions, percentage, passed, answers, quizType } = req.body;
  
  if (!fio || !school || score === undefined || !totalQuestions || !answers) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const answersJson = JSON.stringify(answers);
  const quizTypeValue = quizType || 'sim'; // Default to 'sim' for backward compatibility
  
  const result = db.prepare(`
    INSERT INTO results (fio, school, score, totalQuestions, percentage, passed, answers, quiz_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fio, school, score, totalQuestions, percentage, passed ? 1 : 0, answersJson, quizTypeValue);
  
  res.json({ id: result.lastInsertRowid, message: 'Result saved successfully' });
});

// Get statistics (admin only)
app.get('/api/statistics', authenticateToken, (req, res) => {
  const { quizType = '' } = req.query;
  
  let whereClause = '';
  let params = [];
  
  if (quizType && ['sim', 'pdd', 'med'].includes(quizType)) {
    whereClause = 'WHERE quiz_type = ?';
    params = [quizType];
  }
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as totalAttempts,
      AVG(percentage) as avgPercentage,
      SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passedCount,
      SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failedCount,
      MAX(percentage) as highestScore,
      MIN(percentage) as lowestScore
    FROM results
    ${whereClause}
  `).get(...params);
  
  res.json({
    totalAttempts: stats.totalAttempts || 0,
    avgPercentage: Math.round(stats.avgPercentage || 0),
    passedCount: stats.passedCount || 0,
    failedCount: stats.failedCount || 0,
    highestScore: stats.highestScore || 0,
    lowestScore: stats.lowestScore || 0
  });
});

// Export results to Excel (admin only)
app.get('/api/results/export', authenticateToken, (req, res) => {
  const { quizType = '' } = req.query;
  
  let whereClause = '';
  let params = [];
  
  if (quizType && ['sim', 'pdd', 'med'].includes(quizType)) {
    whereClause = 'WHERE quiz_type = ?';
    params = [quizType];
  }
  
  const results = db.prepare(`SELECT * FROM results ${whereClause} ORDER BY school ASC, score ASC`).all(...params);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Результаты');
  
  // Set column headers - include quiz type column
  worksheet.columns = [
    { header: 'Викторина', key: 'quiz_type', width: 15 },
    { header: 'Регион', key: 'school', width: 30 },
    { header: 'ФИО', key: 'fio', width: 40 },
    { header: 'Штрафные баллы', key: 'score', width: 15 }
  ];
  
  // Quiz type names mapping
  const quizTypeNames = {
    'sim': 'СИМ',
    'pdd': 'ПДД',
    'med': 'Медицина'
  };
  
  // Add data rows
  results.forEach(result => {
    worksheet.addRow({
      quiz_type: quizTypeNames[result.quiz_type] || result.quiz_type,
      school: result.school,
      fio: result.fio,
      score: result.score
    });
  });
  
  // Set response headers
  const filename = quizType ? `results_${quizType}.xlsx` : 'results.xlsx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  
  // Write to response
  workbook.xlsx.write(res).then(() => {
    res.end();
  });
});

// Delete a result (admin only)
app.delete('/api/results/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  const result = db.prepare('SELECT * FROM results WHERE id = ?').get(id);
  
  if (!result) {
    return res.status(404).json({ error: 'Result not found' });
  }
  
  db.prepare('DELETE FROM results WHERE id = ?').run(id);
  
  res.json({ message: 'Result deleted successfully' });
});

// Change admin password (admin only)
app.put('/api/admin/password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.user.id);
  
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  
  const validPassword = bcrypt.compareSync(currentPassword, admin.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
  
  res.json({ message: 'Password changed successfully' });
});

// Get settings (public)
app.get('/api/settings', (req, res) => {
  const authRequiredRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('authRequired');
  res.json({
    authRequired: authRequiredRow ? authRequiredRow.value === 'true' : true
  });
});

// Update settings (admin only)
app.put('/api/settings', authenticateToken, (req, res) => {
  const { authRequired } = req.body;
  
  if (authRequired !== undefined) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('authRequired', authRequired.toString());
  }
  
  res.json({ message: 'Settings updated successfully' });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});