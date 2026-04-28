/**
 * Signup Page - Registration form
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/auth-api';

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!email || !password || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.register(email, password, displayName);
      
      if (response.success) {
        setShowConfirmation(true);
      } else {
        if (response.error?.code === 'DUPLICATE_EMAIL') {
          setError('Este email já está cadastrado');
        } else if (response.error?.code === 'RATE_LIMIT') {
          setError('Muitas tentativas. Aguarde alguns minutos.');
        } else {
          setError(response.error?.message || 'Erro ao cadastrar');
        }
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmation) {
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
            Confirme seu email
          </h1>
          <p style={{ color: '#a0a0b0', marginBottom: '2rem', lineHeight: 1.6 }}>
            Enviamos um link de confirmação para <strong>{email}</strong>. 
            Clique no link para ativar sua conta.
          </p>
          
          <p style={{ color: '#a0a0b0', marginBottom: '2rem', fontSize: '0.875rem' }}>
            Não received?{' '}
            <button
              onClick={async () => {
                await authApi.resendVerification(email);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#FFD700',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Reenviar
            </button>
          </p>

          <Link
            to="/login"
            style={{ color: '#FFD700', textDecoration: 'none' }}
          >
            Voltar para login
          </Link>
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
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', textAlign: 'center' }}>
          Criar conta
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#0f0f1a',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Nome (opcional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#0f0f1a',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Senha *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#0f0f1a',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Confirmar senha *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#0f0f1a',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
          </div>

          {error && (
            <div style={{
              color: '#ff6b6b',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#FFD700',
              color: '#1a1a2e',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#a0a0b0' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: '#FFD700', textDecoration: 'none' }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}