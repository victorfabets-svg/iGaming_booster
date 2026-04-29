/**
 * Login Page
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

type LoginError = 'none' | 'invalid' | 'network' | 'rate_limit' | 'email_not_verified';
type LoginStatus = 'idle' | 'loading' | 'error';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<LoginError>('none');

  if (isAuthenticated) {
    const next = searchParams.get('next');
    const userRole = user?.role;
    // Redirect by role: admin -> /admin, affiliate -> /afiliado, user -> /me
    const target = next ?? (userRole === 'admin' ? '/admin' : userRole === 'affiliate' ? '/afiliado' : '/me');
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('none');

    try {
      await login(email, password);
      // Re-render after login() updates state will hit the redirect above.
    } catch (err) {
      setStatus('error');
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg === 'EMAIL_NOT_VERIFIED') setError('email_not_verified');
      else if ((err as { code?: string }).code === 'RATE_LIMIT') setError('rate_limit');
      else if ((err as { code?: string }).code === 'NETWORK_ERROR') setError('network');
      else setError('invalid');
    }
  };

  const errorMessage: Record<LoginError, string> = {
    none: '',
    invalid: 'Email ou senha incorretos.',
    network: 'Falha de conexão.',
    rate_limit: 'Muitas tentativas, aguarde alguns instantes.',
    email_not_verified: 'Confirme seu email antes de entrar.',
  };

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1 className="card-title text-center mb-6">Entrar</h1>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error !== 'none' && (
            <>
              <div className={`alert-box ${error === 'email_not_verified' ? 'alert-warning' : 'alert-error'}`}>
                {errorMessage[error]}
              </div>
              {error === 'email_not_verified' && (
                <button
                  type="button"
                  className="btn btn-ghost full-width mb-4"
                  onClick={() => navigate('/signup')}
                >
                  Reenviar email de verificação
                </button>
              )}
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary full-width"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-secondary text-sm mt-4">
          Não tem conta? <Link to="/signup" className="btn-link">Cadastrar</Link>
        </p>
      </div>
    </div>
  );
}
