import { useState, useMemo, useEffect, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom'
import './App.css'
import { quizzes, getQuizByType, getRandomMedicineTicket } from './data/questions'
import type { QuizType } from './data/questions'
import { UserLogin } from './components/UserLogin'
import { AdminLogin } from './components/AdminLogin'
import { AdminDashboard } from './components/AdminDashboard'
import { api } from './services/api'

type QuizState = 'start' | 'playing' | 'finished'
type AppMode = 'main' | 'accessLogin' | 'userLogin' | 'adminLogin' | 'adminDashboard'

interface Answer {
  questionId: number
  selectedAnswer: number
  isCorrect: boolean
}

interface UserInfo {
  fio: string
  school: string
}

interface QuizPageProps {
  accessGranted: boolean
  setMode: (mode: AppMode) => void
  authRequired: boolean
}

// Quiz Page Component
function QuizPage({ accessGranted, setMode, authRequired }: QuizPageProps) {
  const { quizType } = useParams<{ quizType: string }>()
  const navigate = useNavigate()
  
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [quizState, setQuizState] = useState<QuizState>('start')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Get the current quiz data
  const currentQuiz = useMemo(() => {
    if (!quizType || !['sim', 'pdd', 'med'].includes(quizType)) return null
    return getQuizByType(quizType as QuizType)
  }, [quizType])

  // For medicine quiz, use random ticket selection
  const questions = useMemo(() => {
    if (quizType === 'med') {
      return getRandomMedicineTicket()
    }
    return currentQuiz?.questions || []
  }, [quizType, currentQuiz?.questions])
  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [currentQuestionIndex, questions])

  // Reset state when quiz type changes
  useEffect(() => {
    setQuizState('start')
    setCurrentQuestionIndex(0)
    setAnswers([])
    setSelectedAnswer(null)
    setShowResult(false)
    setUserInfo(null)
    setSubmitError('')
  }, [quizType])

  // Calculate score - medicine quiz uses 2 penalty points, others use 4
  const penaltyPerWrong = useMemo(() => quizType === 'med' ? 2 : 4, [quizType])
  const score = useMemo(() => {
    const correctAnswers = answers.filter(a => a.isCorrect).length
    const totalQuestions = questions.length
    const wrongAnswers = totalQuestions - correctAnswers
    return wrongAnswers * penaltyPerWrong
  }, [answers, questions.length, penaltyPerWrong])

  // Redirect to home if quiz type is invalid
  if (!currentQuiz) {
    return <Navigate to="/" replace />
  }

  // Check if access is required but not granted
  if (authRequired && !accessGranted) {
    return <Navigate to="/" replace />
  }

  const handleUserLogin = (fio: string, school: string) => {
    setUserInfo({ fio, school })
    setQuizState('playing')
    setCurrentQuestionIndex(0)
    setAnswers([])
    setSelectedAnswer(null)
    setShowResult(false)
    setSubmitError('')
  }

  const handleStartQuiz = () => {
    setQuizState('playing')
    setCurrentQuestionIndex(0)
    setAnswers([])
    setSelectedAnswer(null)
    setShowResult(false)
  }

  const handleAnswerSelect = (optionIndex: number) => {
    if (showResult) return
    setSelectedAnswer(optionIndex)
    setShowResult(true)

    const isCorrect = optionIndex === currentQuestion.correctAnswer
    setAnswers(prev => [...prev, {
      questionId: currentQuestion.id,
      selectedAnswer: optionIndex,
      isCorrect
    }])
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    } else {
      setQuizState('finished')
      saveResult()
    }
  }

  const saveResult = async () => {
    if (!userInfo) return
    
    // Calculate percentage based on penalty system
    // For medicine: max penalty = 10 * 2 = 20
    // For others: max penalty = 20 * 4 = 80
    const maxPenalty = questions.length * penaltyPerWrong
    const percentage = Math.max(0, Math.round(((maxPenalty - score) / maxPenalty) * 100))
    const passed = percentage >= 70

    setIsSubmitting(true)
    setSubmitError('')

    try {
      await api.submitResult({
        fio: userInfo.fio,
        school: userInfo.school,
        score: score,
        totalQuestions: questions.length,
        percentage,
        passed,
        answers,
        quizType: quizType as QuizType
      })
    } catch (err) {
      setSubmitError('Не удалось сохранить результат. Попробуйте позже.')
      console.error('Failed to save result:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getButtonClassName = (optionIndex: number) => {
    if (!showResult) {
      return selectedAnswer === optionIndex ? 'option-button selected' : 'option-button'
    }
    
    // Show correct answer in green
    if (optionIndex === currentQuestion.correctAnswer) {
      return 'option-button correct'
    }
    
    // Show wrong selected answer in red
    if (selectedAnswer === optionIndex && selectedAnswer !== currentQuestion.correctAnswer) {
      return 'option-button wrong'
    }
    
    return 'option-button disabled'
  }

  // Show user login (no userInfo) - only if auth is required and granted
  if (!userInfo && authRequired && accessGranted) {
    return (
      <>
        <UserLogin onLogin={handleUserLogin} quizType={quizType as QuizType} />
        <button className="admin-link" onClick={() => setMode('adminLogin')}>
          Админ-панель
        </button>
      </>
    )
  }

  // Show user login without auth requirement
  if (!userInfo && !authRequired) {
    return (
      <>
        <UserLogin onLogin={handleUserLogin} quizType={quizType as QuizType} />
        <button className="admin-link" onClick={() => setMode('adminLogin')}>
          Админ-панель
        </button>
      </>
    )
  }

  // Show quiz start screen
  if (quizState === 'start' && userInfo) {
    return (
      <div className="app-container">
        <button className="admin-link" onClick={() => setMode('adminLogin')}>
          Админ-панель
        </button>
        <div className="start-screen">
          <div className="logo">{currentQuiz.icon}</div>
          <h1>{currentQuiz.title}</h1>
          <h2>{currentQuiz.name}</h2>
          <p className="description">{currentQuiz.description}</p>
          <div className="user-info-display">
            <p><strong>Участник:</strong> {userInfo.fio}</p>
            <p><strong>Регион:</strong> {userInfo.school}</p>
          </div>
          <div className="info-cards">
            <div className="info-card">
              <span className="info-number">{questions.length}</span>
              <span className="info-label">вопросов</span>
            </div>
            <div className="info-card">
              <span className="info-number">{penaltyPerWrong}</span>
              <span className="info-label">штрафа за ошибку</span>
            </div>
          </div>
          <button className="start-button" onClick={handleStartQuiz}>
            Начать тестирование
          </button>
          <button className="change-user-btn" onClick={() => setUserInfo(null)}>
            Изменить данные
          </button>
          <div className="quiz-nav">
            {quizzes.map(quiz => (
              <button
                key={quiz.id}
                className={`quiz-nav-btn ${quiz.id === quizType ? 'active' : ''}`}
                onClick={() => navigate(`/${quiz.id}`)}
              >
                {quiz.icon} {quiz.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show quiz finished screen
  if (quizState === 'finished' && userInfo) {
    const maxPenalty = questions.length * penaltyPerWrong
    const percentage = Math.max(0, Math.round(((maxPenalty - score) / maxPenalty) * 100))
    const passed = percentage >= 70
    const wrongAnswers = Math.floor(score / penaltyPerWrong)

    return (
      <div className="app-container">
        <button className="admin-link" onClick={() => setMode('adminLogin')}>
          Админ-панель
        </button>
        <div className="result-screen">
          <div className="result-icon">{passed ? '🎉' : '😔'}</div>
          <h1>{passed ? 'Поздравляем!' : 'Не расстраивайтесь'}</h1>
          
          {isSubmitting ? (
            <div className="saving-status">
              <div className="spinner"></div>
              <p>Сохранение результата...</p>
            </div>
          ) : submitError ? (
            <div className="error-message save-error">{submitError}</div>
          ) : (
            <div className="success-message save-success">✓ Результат сохранен</div>
          )}

          <div className="score-display">
            <div className="score-circle">
              <span className="score-number">{score}</span>
              <span className="score-total">штрафных</span>
              <span className="score-total">баллов</span>
            </div>
            <div className="score-percentage">{percentage}%</div>
          </div>
          
          <div className="results-summary">
            <div className="summary-item correct">
              <span className="summary-label">Правильных ответов</span>
              <span className="summary-value">{questions.length - wrongAnswers}</span>
            </div>
            <div className="summary-item wrong">
              <span className="summary-label">Ошибок</span>
              <span className="summary-value">{wrongAnswers}</span>
            </div>
          </div>

          <div className="quiz-nav">
            {quizzes.map(quiz => (
              <button
                key={quiz.id}
                className={`quiz-nav-btn ${quiz.id === quizType ? 'active' : ''}`}
                onClick={() => navigate(`/${quiz.id}`)}
              >
                {quiz.icon} {quiz.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show quiz playing screen
  if (userInfo) {
    return (
      <div className="app-container">
        <button className="admin-link" onClick={() => setMode('adminLogin')}>
          Админ-панель
        </button>
        <div className="quiz-screen">
          <div className="quiz-header">
            <div className="progress-info">
              <span>Вопрос {currentQuestionIndex + 1} из {questions.length}</span>
              <span>Штраф: {score}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="question-card">
            <div className="question-number">Вопрос {currentQuestion.id}</div>
            <h2 className="question-text">{currentQuestion.question}</h2>
            {currentQuestion.imageUrl && (
              <div className="question-image-container">
                <img src={currentQuestion.imageUrl} alt={`Иллюстрация к вопросу ${currentQuestion.id}`} className="question-image" />
              </div>
            )}
          </div>

          <div className="options-container">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                className={getButtonClassName(index)}
                onClick={() => handleAnswerSelect(index)}
                disabled={showResult}
              >
                <span className="option-letter">{String.fromCharCode(1040 + index)}</span>
                <span className="option-text">{option}</span>
                {showResult && index === currentQuestion.correctAnswer && (
                  <span className="check-icon">✓</span>
                )}
                {showResult && selectedAnswer === index && index !== currentQuestion.correctAnswer && (
                  <span className="cross-icon">✗</span>
                )}
              </button>
            ))}
          </div>

          {showResult && (
            <div className="feedback">
              <div className={`feedback-text ${selectedAnswer === currentQuestion.correctAnswer ? 'correct' : 'wrong'}`}>
                {selectedAnswer === currentQuestion.correctAnswer 
                  ? '✓ Правильно!' 
                  : `✗ Неправильно. Правильный ответ: ${String.fromCharCode(1040 + currentQuestion.correctAnswer)}`}
              </div>
              <button className="next-button" onClick={handleNextQuestion}>
                {currentQuestionIndex < questions.length - 1 ? 'Следующий вопрос' : 'Завершить'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback
  return null
}

// Main App Component
function App() {
  const [mode, setMode] = useState<AppMode>('main')
  const [accessGranted, setAccessGranted] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [authRequired, setAuthRequired] = useState(true)

  // Fetch settings and check sessions on mount
  useEffect(() => {
    const initApp = async () => {
      // First, try to fetch settings from server
      try {
        const settings = await api.getSettings()
        setAuthRequired(settings.authRequired)
      } catch {
        // If server doesn't have settings endpoint, use local storage
        const savedAuthRequired = localStorage.getItem('authRequired')
        if (savedAuthRequired !== null) {
          setAuthRequired(savedAuthRequired === 'true')
        }
      }

      // Check admin session first
      const adminToken = localStorage.getItem('adminToken')
      const username = localStorage.getItem('adminUsername')
      if (adminToken && username) {
        try {
          const response = await api.verifyAdmin()
          if (response.valid) {
            setAdminUsername(response.username)
            setMode('adminDashboard')
            setAccessGranted(true)
            return
          }
        } catch {
          api.logout()
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
        }
      }

      // Check access token for quiz (separate from admin session)
      const quizAccessToken = localStorage.getItem('quizAccessToken')
      if (quizAccessToken) {
        try {
          const response = await api.verifyAdmin()
          if (response.valid) {
            setAccessGranted(true)
            setMode('userLogin')
          } else {
            localStorage.removeItem('quizAccessToken')
          }
        } catch {
          localStorage.removeItem('quizAccessToken')
        }
      }
    }
    initApp()
  }, [])

  const handleAccessLogin = async (username: string, password: string) => {
    const data = await api.adminLogin(username, password)
    localStorage.setItem('quizAccessToken', data.token)
    setAccessGranted(true)
    setMode('userLogin')
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
  }

  const handleAdminLogin = async (username: string, password: string) => {
    const data = await api.adminLogin(username, password)
    setAdminUsername(data.username)
    setMode('adminDashboard')
    setAccessGranted(true)
  }

  const handleAdminLogout = () => {
    api.logout()
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    localStorage.removeItem('quizAccessToken')
    setAdminUsername('')
    setAccessGranted(false)
    setMode('main')
  }

  // Handler for toggling auth requirement
  const handleToggleAuthRequired = useCallback(async (newValue: boolean) => {
    setAuthRequired(newValue)
    localStorage.setItem('authRequired', newValue.toString())
    try {
      await api.updateSettings({ authRequired: newValue })
    } catch {
      // Server might not support this endpoint yet
    }
  }, [])

  // Show admin login (for admin panel access)
  if (mode === 'adminLogin') {
    return (
      <Router>
        <AdminLogin 
          onLogin={handleAdminLogin} 
          onBackToUserLogin={() => setMode('main')}
        />
      </Router>
    )
  }

  // Show admin dashboard
  if (mode === 'adminDashboard') {
    return (
      <Router>
        <AdminDashboard 
          onLogout={handleAdminLogout}
          username={adminUsername}
          authRequired={authRequired}
          onToggleAuthRequired={handleToggleAuthRequired}
        />
      </Router>
    )
  }

  // Show access login (for quiz access)
  if (mode === 'accessLogin') {
    return (
      <Router>
        <AdminLogin 
          onLogin={handleAccessLogin} 
          onBackToUserLogin={() => setMode('main')}
        />
      </Router>
    )
  }

  // Show main screen (no access granted) - only if auth is required
  if (!accessGranted && authRequired) {
    return (
      <Router>
        <div className="app-container">
          <div className="login-screen">
            <div className="logo">🛴</div>
            <h1>БЕЗОПАСНОЕ КОЛЕСО 2026</h1>
            <h2>Викторины</h2>
            <p className="description">
              Для начала тестирования необходима авторизация администратора
            </p>

            <div className="access-prompt">
              <button className="start-button" onClick={() => setMode('accessLogin')}>
                Авторизоваться для доступа к викторине
              </button>
            </div>
          </div>
          <button className="admin-link" onClick={() => setMode('adminLogin')}>
            Админ-панель
          </button>
        </div>
      </Router>
    )
  }

  // Main app with routing (when no auth required or access granted)
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/sim" replace />} />
        <Route 
          path="/:quizType" 
          element={
            <QuizPage 
              accessGranted={accessGranted} 
              setMode={setMode}
              authRequired={authRequired}
            />
          } 
        />
      </Routes>
    </Router>
  )
}

export default App