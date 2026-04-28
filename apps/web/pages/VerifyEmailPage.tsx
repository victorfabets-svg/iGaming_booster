/**
 * Verify Email Page - Verify email with token
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authApi } from '../services/auth-api';
import { useAuth } from '../state/AuthContext';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token inválido');
      setIsLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const response = await authApi.verifyEmail(token);
        
        if (response.success && response.data) {
          setSession({
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token ?? null,
          });
          const role = JSON.parse(atob(response.data.access_token.split('.')[1] + '=='.slice(0, (4 - response.data.access_token.split('.')[1].length % 4) % 4)))?.role;
          navigate(role === 'admin' ? '/admin' : '/me', { replace: true });
        } else {
          setError(response.error?.message || 'Link inválido ou expirado');
        }
      } catch (err) {
        setError('Erro ao verificar email');
      } finally {
        setIsLoading(false);
      }
    };

    verify();
  }, [token, navigate, setSession]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background-primary)',
        color: 'var(--text-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner-lg" style={{ margin: '0 auto 1rem' }} />
          <p>Verificando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background-primary)',
      color: 'var(--text-primary)',
      padding: '2rem',
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontFamily: 'var(--font-display)', color: 'var(--color-error-primary)' }}>
          Erro na verificação
        </h1>
        <div className="alert-box alert-error" style={{ marginBottom: '2rem', textAlign: 'left' }}>
          {error || 'Link inválido ou expirado'}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Solicitar novo link de verificação?{' '}
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary-primary)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Ir para Login
          </button>
        </p>
      </div>
    </div>
  );
}
