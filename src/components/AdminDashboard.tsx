import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface ResultRecord {
  id: number;
  fio: string;
  school: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: number;
  created_at: string;
  quiz_type: string;
  answers: Array<{
    questionId: number;
    selectedAnswer: number;
    isCorrect: boolean;
  }>;
}

interface Statistics {
  totalAttempts: number;
  avgPercentage: number;
  passedCount: number;
  failedCount: number;
  highestScore: number;
  lowestScore: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField = 'id' | 'fio' | 'school' | 'score' | 'percentage' | 'passed' | 'created_at';
type SortOrder = 'ASC' | 'DESC';
type QuizTypeFilter = 'all' | 'sim' | 'pdd' | 'med';

interface AdminDashboardProps {
  onLogout: () => void;
  username: string;
  authRequired: boolean;
  onToggleAuthRequired: (value: boolean) => void;
}

export function AdminDashboard({ onLogout, username, authRequired, onToggleAuthRequired }: AdminDashboardProps) {
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [quizTypeFilter, setQuizTypeFilter] = useState<QuizTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [selectedResult, setSelectedResult] = useState<ResultRecord | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, resultId: 0, resultFio: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resultsData, statsData] = await Promise.all([
        api.getResults({ 
          page: pagination.page, 
          limit: pagination.limit, 
          search, 
          sortBy, 
          order: sortOrder,
          quizType: quizTypeFilter === 'all' ? undefined : quizTypeFilter
        }),
        api.getStatistics(quizTypeFilter === 'all' ? undefined : quizTypeFilter),
      ]);
      setResults(resultsData.results);
      setPagination(resultsData.pagination);
      setStats(statsData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, sortBy, sortOrder, quizTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchData();
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleExport = async () => {
    try {
      const exportQuizType = quizTypeFilter === 'all' ? undefined : quizTypeFilter;
      await api.exportResults(exportQuizType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка экспорта');
    }
  };

  const handleDelete = (id: number, fio: string) => {
    setDeleteModal({ isOpen: true, resultId: id, resultFio: fio });
  };

  const confirmDelete = async () => {
    try {
      await api.deleteResult(deleteModal.resultId);
      fetchData();
      setDeleteModal({ isOpen: false, resultId: 0, resultFio: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.new !== passwordData.confirm) {
      setPasswordError('Пароли не совпадают');
      return;
    }

    if (passwordData.new.length < 6) {
      setPasswordError('Пароль должен быть не менее 6 символов');
      return;
    }

    try {
      await api.changePassword(passwordData.current, passwordData.new);
      setPasswordSuccess('Пароль успешно изменен');
      setPasswordData({ current: '', new: '', confirm: '' });
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Добавляем 3 часа к времени
    date.setHours(date.getHours() + 3);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) return '↕';
    return sortOrder === 'ASC' ? '↑' : '↓';
  };

  if (loading && results.length === 0) {
    return (
      <div className="app-container">
        <div className="admin-dashboard loading-screen">
          <div className="spinner"></div>
          <p>Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="admin-dashboard">
        <header className="admin-header">
          <div className="admin-header-left">
            <h1>📊 Админ-панель</h1>
            <span className="admin-username">👤 {username}</span>
          </div>
          <div className="admin-header-right">
            <button className="password-btn" onClick={() => setShowPasswordModal(true)}>
              Сменить пароль
            </button>
            <button className="export-btn" onClick={handleExport}>
              Экспорт Excel
            </button>
            <button className="logout-btn" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </header>

        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{stats.totalAttempts}</span>
              <span className="stat-label">Всего попыток</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.avgPercentage}%</span>
              <span className="stat-label">Средний балл</span>
            </div>
            <div className="stat-card passed">
              <span className="stat-value">{stats.passedCount}</span>
              <span className="stat-label">Сдали (≥70%)</span>
            </div>
            <div className="stat-card failed">
              <span className="stat-value">{stats.failedCount}</span>
              <span className="stat-label">Не сдали</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.highestScore}%</span>
              <span className="stat-label">Лучший результат</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.lowestScore}%</span>
              <span className="stat-label">Худший результат</span>
            </div>
          </div>
        )}

        {/* Settings Section */}
        <div className="settings-section">
          <div className="settings-card">
            <h3>⚙️ Настройки</h3>
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-label">Требовать авторизацию администратора</span>
                <span className="setting-description">
                  {authRequired 
                    ? 'Для доступа к викторинам требуется авторизация администратора' 
                    : 'Викторины доступны без авторизации'}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={authRequired}
                  onChange={(e) => onToggleAuthRequired(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="results-section">
          <div className="results-header">
            <h2>Результаты тестирования</h2>
            <div className="filters-row">
              <select 
                value={quizTypeFilter} 
                onChange={(e) => { setQuizTypeFilter(e.target.value as QuizTypeFilter); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="quiz-type-filter"
              >
                <option value="all">Все викторины</option>
                <option value="sim">Викторина по СИМ</option>
                <option value="pdd">Викторина по ПДД</option>
                <option value="med">Викторина по медицине</option>
              </select>
              <form className="search-form" onSubmit={handleSearch}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по ФИО или региону..."
                  className="search-input"
                />
                <button type="submit" className="search-btn">Найти</button>
                {search && (
                  <button type="button" className="clear-btn" onClick={() => { setSearch(''); setPagination(prev => ({ ...prev, page: 1 })); }}>
                    Сбросить
                  </button>
                )}
              </form>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="results-table-wrapper">
            <table className="results-table admin-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('id')} className="sortable">
                    № {getSortIcon('id')}
                  </th>
                  <th onClick={() => handleSort('fio')} className="sortable">
                    ФИО {getSortIcon('fio')}
                  </th>
                  <th onClick={() => handleSort('school')} className="sortable">
                    Регион {getSortIcon('school')}
                  </th>
                  <th onClick={() => handleSort('score')} className="sortable">
                    Баллы {getSortIcon('score')}
                  </th>
                  <th onClick={() => handleSort('percentage')} className="sortable">
                    % {getSortIcon('percentage')}
                  </th>
                  <th onClick={() => handleSort('passed')} className="sortable">
                    Статус {getSortIcon('passed')}
                  </th>
                  <th onClick={() => handleSort('created_at')} className="sortable">
                    Дата {getSortIcon('created_at')}
                  </th>
                  <th>Викторина</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="no-results">
                      Результаты не найдены
                    </td>
                  </tr>
                ) : (
                  results.map((result) => (
                    <tr key={result.id} className={result.passed ? 'passed-row' : 'failed-row'}>
                      <td>{result.id}</td>
                      <td>{result.fio}</td>
                      <td>{result.school}</td>
                      <td>{result.score}</td>
                      <td>{result.percentage}%</td>
                      <td>
                        <span className={`status-badge ${result.passed ? 'passed' : 'failed'}`}>
                          {result.passed ? 'Сдал' : 'Не сдал'}
                        </span>
                      </td>
                      <td>{formatDate(result.created_at)}</td>
                      <td>
                        <span className={`quiz-type-badge ${result.quiz_type}`}>
                          {result.quiz_type === 'sim' ? '🛴 СИМ' : 
                           result.quiz_type === 'pdd' ? '🚦 ПДД' : 
                           result.quiz_type === 'med' ? '🏥 Медицина' : '❓'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="details-btn"
                          onClick={() => setSelectedResult(result)}
                        >
                          Подробнее
                        </button>
                      </td>
                      <td>
                        <button
                          className="details-btn"
                          style={{ background: 'var(--danger-color)' }}
                          onClick={() => handleDelete(result.id, result.fio)}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                ← Назад
              </button>
              <span className="page-info">
                Страница {pagination.page} из {pagination.totalPages}
              </span>
              <button
                className="page-btn"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Вперед →
              </button>
            </div>
          )}
        </div>

        {/* Result Details Modal */}
        {selectedResult && (
          <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Детали результата</h3>
                <button className="modal-close" onClick={() => setSelectedResult(null)}>×</button>
              </div>
              <div className="modal-body">
                <div className="result-info">
                  <p><strong>ФИО:</strong> {selectedResult.fio}</p>
                  <p><strong>Регион:</strong> {selectedResult.school}</p>
                  <p><strong>Результат:</strong> {selectedResult.score} ({selectedResult.percentage}%)</p>
                  <p><strong>Дата:</strong> {formatDate(selectedResult.created_at)}</p>
                  <p><strong>Статус:</strong> <span className={`status-badge ${selectedResult.passed ? 'passed' : 'failed'}`}>
                    {selectedResult.passed ? 'Сдал' : 'Не сдал'}
                  </span></p>
                </div>
                <div className="answers-detail">
                  <h4>Детализация ответов</h4>
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Ваш ответ</th>
                        <th>Правильный ответ</th>
                        <th>Результат</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedResult.answers.map((answer, index) => (
                        <tr key={index} className={answer.isCorrect ? 'correct-row' : 'wrong-row'}>
                          <td>{index + 1}</td>
                          <td>{answer.selectedAnswer !== -1 ? answer.selectedAnswer + 1 : '-'}</td>
                          <td>{answer.isCorrect ? answer.selectedAnswer + 1 : '-'}</td>
                          <td>{answer.isCorrect ? '✓' : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="modal-overlay" onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); setPasswordData({ current: '', new: '', confirm: '' }); }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Смена пароля</h3>
                <button className="modal-close" onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); setPasswordData({ current: '', new: '', confirm: '' }); }}>×</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handlePasswordChange}>
                  {passwordError && <div className="error-message">{passwordError}</div>}
                  {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}
                  <div className="form-group">
                    <label>Текущий пароль</label>
                    <input
                      type="password"
                      value={passwordData.current}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Новый пароль</label>
                    <input
                      type="password"
                      value={passwordData.new}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label>Подтвердите пароль</label>
                    <input
                      type="password"
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="cancel-btn" onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); setPasswordData({ current: '', new: '', confirm: '' }); }}>
                      Отмена
                    </button>
                    <button type="submit" className="submit-btn">
                      Изменить пароль
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModal.isOpen && (
          <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, resultId: 0, resultFio: '' })}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Подтверждение удаления</h3>
                <button className="modal-close" onClick={() => setDeleteModal({ isOpen: false, resultId: 0, resultFio: '' })}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '15px', color: 'var(--text-primary)' }}>
                  Вы действительно хотите удалить результат <strong>{deleteModal.resultFio}</strong>?
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Это действие нельзя отменить.
                </p>
              </div>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setDeleteModal({ isOpen: false, resultId: 0, resultFio: '' })}>
                  Отмена
                </button>
                <button 
                  className="submit-btn" 
                  style={{ background: 'var(--danger-color)' }}
                  onClick={confirmDelete}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}