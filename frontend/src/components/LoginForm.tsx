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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let authResponse;
      if (isRegister) {
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
          ? 'Authentication failed'
          : status === 429
          ? 'Too many login attempts. Please try again later.'
          : error.response?.data?.message ||
            error.message ||
            'Authentication failed';
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
              ? 'Loading...'
              : isRegister
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>

        <div className={s.toggleAuth}>
          <span className={s.toggleText}>
            {isRegister
              ? 'Already have an account? '
              : "Don't have an account? "}
          </span>
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className={s.toggleButton}
            disabled={isLoading}
          >
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
