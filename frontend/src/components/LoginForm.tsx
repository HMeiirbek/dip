import React, { useState } from 'react';
import apiService from '../services/api';

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
        await apiService.register(username, password);
        // After registration, log in
        authResponse = await apiService.login(username, password);
      } else {
        authResponse = await apiService.login(username, password);
      }

      onSuccess(authResponse.accessToken, username);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Authentication failed';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>DIP</h1>
        <p style={styles.subtitle}>Secure Voice Communication</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={styles.input}
              disabled={isLoading}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.button,
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading
              ? 'Loading...'
              : isRegister
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>

        <div style={styles.toggleAuth}>
          <span style={styles.toggleText}>
            {isRegister
              ? 'Already have an account? '
              : "Don't have an account? "}
          </span>
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            style={styles.toggleButton}
            disabled={isLoading}
          >
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
  } as React.CSSProperties,

  card: {
    background: 'var(--surface)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
    padding: '40px',
    maxWidth: '400px',
    width: '100%',
  } as React.CSSProperties,

  title: {
    textAlign: 'center' as const,
    color: 'var(--text)',
    marginBottom: '10px',
    fontSize: '32px',
  } as React.CSSProperties,

  subtitle: {
    textAlign: 'center' as const,
    color: 'var(--muted)',
    marginBottom: '30px',
    fontSize: '14px',
  } as React.CSSProperties,

  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  } as React.CSSProperties,

  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text)',
  } as React.CSSProperties,

  input: {
    padding: '12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
  } as React.CSSProperties,

  button: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, var(--primary) 0%, rgba(34,197,94,0.95) 100%)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  } as React.CSSProperties,

  toggleAuth: {
    textAlign: 'center' as const,
    marginTop: '20px',
    fontSize: '14px',
    color: 'var(--muted)',
  } as React.CSSProperties,

  toggleText: {
    marginRight: '5px',
  } as React.CSSProperties,

  toggleButton: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    cursor: 'pointer',
    fontWeight: '600',
    textDecoration: 'underline',
    fontSize: '14px',
  } as React.CSSProperties,
};
