import { useState } from 'react';
import { getQuizByType } from '../data/questions';
import type { QuizType } from '../data/questions';

interface UserLoginProps {
  onLogin: (fio: string, school: string) => void;
  quizType?: QuizType;
}

export function UserLogin({ onLogin, quizType = 'sim' }: UserLoginProps) {
  const [fio, setFio] = useState('');
  const [school, setSchool] = useState('');
  const [errors, setErrors] = useState<{ fio?: string; school?: string }>({});
  
  // Get quiz data based on quiz type
  const quizData = getQuizByType(quizType);
  const quizName = quizData?.name || 'Викторина по СИМ';
  const quizDescription = quizData?.description || 'Проверьте свои знания правил дорожного движения для средств индивидуальной мобильности (СИМ)';
  const quizIcon = quizData?.icon || '🛴';
  const questionCount = quizType === 'med' ? 10 : (quizData?.questions.length || 20);

  const validate = (): boolean => {
    const newErrors: { fio?: string; school?: string } = {};

    if (!fio.trim()) {
      newErrors.fio = 'Введите ФИО';
    } else if (fio.trim().split(' ').length < 2) {
      newErrors.fio = 'Введите фамилию и имя (минимум 2 слова)';
    }

    if (!school.trim()) {
      newErrors.school = 'Введите город или округ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onLogin(fio.trim(), school.trim());
    }
  };

  return (
    <div className="app-container">
      <div className="login-screen">
        <div className="logo">{quizIcon}</div>
        <h1>БЕЗОПАСНОЕ КОЛЕСО 2026</h1>
        <h2>{quizName}</h2>
        <p className="description">
          {quizDescription}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fio">ФИО участника</label>
            <input
              type="text"
              id="fio"
              value={fio}
              onChange={(e) => setFio(e.target.value)}
              placeholder="Иванов Иван"
              className={errors.fio ? 'error' : ''}
              autoComplete="name"
            />
            {errors.fio && <span className="error-message">{errors.fio}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="school">Город, округ</label>
            <input
              type="text"
              id="school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Великий Новгород»"
              className={errors.school ? 'error' : ''}
              autoComplete="organization"
            />
            {errors.school && <span className="error-message">{errors.school}</span>}
          </div>

          <button type="submit" className="start-button">
            Начать тестирование
          </button>
        </form>

        <div className="info-cards">
          <div className="info-card">
            <span className="info-number">{questionCount}</span>
            <span className="info-label">вопросов</span>
          </div>
        </div>
      </div>
    </div>
  );
}