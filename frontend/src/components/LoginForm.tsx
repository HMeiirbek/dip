import React, { useState } from 'react';
import apiService from '../services/api';
import s from './LoginForm.module.css';

interface LoginFormProps {
  onSuccess: (token: string, username: string) => void;
  onError?: (error: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onError }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError('');

    try {
      let authResponse;
      if (isRegister) {
        // Password validation matching backend rules
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
        if (password.length < 8 || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
          const errMsg = 'Пароль должен быть от 8 символов, содержать заглавную и строчную латинские буквы, цифру и спецсимвол (!@#$%^&*...).';
          setLocalError(errMsg);
          onError?.(errMsg);
          setIsLoading(false);
          return;
        }

        try {
          await apiService.register(username, password);
          authResponse = await apiService.login(username, password);
        } catch (error: any) {
          if (error.response?.status === 409) {
            // User already exists: fallback to login
            authResponse = await apiService.login(username, password);
          } else {
            throw error;
          }
        }
      } else {
        authResponse = await apiService.login(username, password);
      }

      onSuccess(authResponse.accessToken, username);
    } catch (error: any) {
      const status = error.response?.status;
      const errorMessage =
        status === 401
          ? 'Неверный логин или пароль'
          : status === 429
          ? 'Слишком много попыток входа. Пожалуйста, попробуйте позже.'
          : status === 502 || status === 503 || status === 504
          ? 'Сервер временно недоступен. Попробуйте позже.'
          : error.response?.data?.message ||
            error.message ||
            'Ошибка авторизации: неверный логин или пароль';
      setLocalError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={s.container}>
      <div className={s.card}>
        <h1 className={s.title}>DIP</h1>
        <p className={s.subtitle}>Secure Voice Communication</p>

        {localError && <div className={s.errorMsg}>{localError}</div>}

        <form onSubmit={handleSubmit} className={s.form}>
          <div className={s.formGroup}>
            <label className={s.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className={s.input}
              disabled={isLoading}
              required
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={s.input}
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={s.primaryButton}
          >
            {isLoading
              ? 'Загрузка...'
              : isRegister
              ? 'Создать аккаунт'
              : 'Войти'}
          </button>
        </form>

        <div className={s.toggleAuth}>
          <span className={s.toggleText}>
            {isRegister
              ? 'Уже есть аккаунт? '
              : "Нет аккаунта? "}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setLocalError('');
            }}
            className={s.toggleButton}
            disabled={isLoading}
          >
            {isRegister ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
      </div>
    </div>
  );
};
