import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onBackToUserLogin: () => void;
}

export function AdminLogin({ onLogin, onBackToUserLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="admin-login-screen">
        <div className="logo">🔒</div>
        <h1>Админ-панель</h1>
        <h2>Викторина по СИМ</h2>
        <p className="description">
          Панель управления результатами тестирования
        </p>

        <form className="login-form admin-login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Логин</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              className={error ? 'error' : ''}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className={error ? 'error' : ''}
              disabled={isLoading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="start-button" disabled={isLoading}>
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <button className="back-button" onClick={onBackToUserLogin}>
          ← Вернуться к тестированию
        </button>
      </div>
    </div>
  );
}