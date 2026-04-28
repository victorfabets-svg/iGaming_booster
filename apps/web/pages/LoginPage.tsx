/**
 * Login Page
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
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

  // Redirect if already authenticated. Use the declarative <Navigate>
  // component instead of calling navigate() during render — calling it
  // imperatively from the render path leaves a tick where the component
  // returns null, painting a blank page until the route swaps in.
  if (isAuthenticated) {
    const next = searchParams.get('next');
    const target = next ?? (isAdmin ? '/admin' : '/me');
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('none');

    try {
      await login(email, password);
      // Don't navigate here — `isAdmin` would still hold its stale closure
      // value because React state updates are asynchronous, sending every
      // user (even admins) to /me. The early `if (isAuthenticated)` return
      // above re-runs once the new state propagates and routes by fresh role.
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
        background: 'var(--color-background-primary)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 className="card-title" style={{ textAlign: 'center', marginBottom: '24px' }}>
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
              className="input"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
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
              className="input"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error !== 'none' && (
            <>
              <div className={`alert-box ${error === 'email_not_verified' ? 'alert-warning' : 'alert-error'}`}>
                {errorMessage}
              </div>
              {error === 'email_not_verified' && (
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="btn"
                  style={{
                    width: '100%',
                    marginBottom: '1.5rem',
                    background: 'transparent',
                    border: '1px solid var(--glass-border)',
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
            className="btn btn-primary"
            style={{
              width: '100%',
              opacity: status === 'loading' ? 0.7 : 1,
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ margin: '1.5rem 0 0', textAlign: 'center' }}>
          <a href="/" style={{ color: 'var(--color-primary-primary)' }}>
            Voltar para página inicial
          </a>
        </p>
      </div>
    </div>
  );
}