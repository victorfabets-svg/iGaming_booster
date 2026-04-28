/**
 * Verify Email Page - Verify email with token
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authApi } from '../services/auth-api';
import { useAuth } from '../state/AuthContext';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();
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
          // Auto-login after verification
          await login('', ''); // This won't work - need to use the tokens from response
          localStorage.setItem('igb_access', response.data.access_token);
          if (response.data.refresh_token) {
            localStorage.setItem('igb_refresh', response.data.refresh_token);
          }
          navigate('/me');
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
  }, [token, navigate, login]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #333',
            borderTopColor: '#FFD700',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      background: '#1a1a2e',
      color: '#fff',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ff6b6b' }}>
          Erro na verificação
        </h1>
        <p style={{ color: '#a0a0b0', marginBottom: '2rem' }}>
          {error || 'Link inválido ou expirado'}
        </p>
        <p style={{ color: '#a0a0b0', fontSize: '0.875rem' }}>
          Solicitar novo link de verificação?{' '}
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFD700',
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