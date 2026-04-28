/**
 * Verify Email Page — consumes verification token, auto-logs the user in.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { authApi } from '../services/auth-api';
import { useAuth } from '../state/AuthContext';

function decodeRole(jwt: string): string | undefined {
  try {
    const part = jwt.split('.')[1];
    const padded = part + '=='.slice(0, (4 - (part.length % 4)) % 4);
    return JSON.parse(atob(padded))?.role;
  } catch { return undefined; }
}

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token inválido.');
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const response = await authApi.verifyEmail(token);
        if (response.success && response.data) {
          setSession({
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token ?? null,
          });
          const role = decodeRole(response.data.access_token);
          navigate(role === 'admin' ? '/admin' : '/me', { replace: true });
        } else {
          setError(response.error?.message || 'Link inválido ou expirado.');
        }
      } catch {
        setError('Erro ao verificar email.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token, navigate, setSession]);

  if (isLoading) {
    return (
      <div className="auth-shell">
        <div className="text-center">
          <div className="spinner-lg auth-spinner" />
          <p className="text-secondary mt-4">Verificando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card text-center">
        <h1 className="card-title text-error mb-4">Erro na verificação</h1>
        <div className="alert-box alert-error">{error}</div>
        <p className="text-secondary text-sm mt-4">
          Solicitar novo link de verificação?{' '}
          <Link to="/login" className="btn-link">Ir para Login</Link>
        </p>
      </div>
    </div>
  );
}
