/**
 * Login Page
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

type LoginError = 'none' | 'invalid' | 'network' | 'rate_limit' | 'email_not_verified';
type LoginStatus = 'idle' | 'loading' | 'error';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isAdmin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<LoginError>('none');

  // Redirect if already authenticated
  if (isAuthenticated) {
    const next = searchParams.get('next');
    if (next) {
      navigate(next, { replace: true });
    } else if (isAdmin) {
      navigate('/admin', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('none');

    try {
      await login(email, password);
      
      // On success, navigate
      const next = searchParams.get('next');
      if (next) {
        navigate(next, { replace: true });
      } else if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/me', { replace: true });
      }
    } catch (err) {
      setStatus('error');
      // Check error type
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg === 'EMAIL_NOT_VERIFIED') {
        setError('email_not_verified');
      } else if ((err as { code?: string }).code === 'RATE_LIMIT') {
        setError('rate_limit');
      } else if ((err as { code?: string }).code === 'NETWORK_ERROR') {
        setError('network');
      } else {
        setError('invalid');
      }
    }
  };

  const errorMessage = {
    none: '',
    invalid: 'Email ou senha incorretos',
    network: 'Falha de conexão',
    rate_limit: 'Muitas tentativas, aguarde.',
    email_not_verified: 'Confirme seu email antes de entrar.',
  }[error];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <h1 style={{ margin: '0 0 1.5rem', textAlign: 'center', fontSize: '1.5rem' }}>
          Login
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error !== 'none' && (
            <>
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  background: error === 'email_not_verified' ? '#fff3cd' : '#fee',
                  color: error === 'email_not_verified' ? '#856404' : '#c00',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                }}
              >
                {errorMessage}
              </div>
              {error === 'email_not_verified' && (
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginBottom: '1.5rem',
                    background: 'transparent',
                    color: error === 'email_not_verified' ? '#856404' : '#0066cc',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Reenviar email
                </button>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: 500,
              background: status === 'loading' ? '#ccc' : '#0066cc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ margin: '1.5rem 0 0', textAlign: 'center', fontSize: '0.9rem' }}>
          <a href="/" style={{ color: '#0066cc' }}>
            Voltar para página inicial
          </a>
        </p>
      </div>
    </div>
  );
}