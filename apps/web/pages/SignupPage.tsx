/**
 * Signup Page - Registration form
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/auth-api';

export default function SignupPage() {
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

    if (!email || !password || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.register(email, password, displayName);
      
      if (response.success) {
        setShowConfirmation(true);
      } else {
        if (response.error?.code === 'DUPLICATE_EMAIL') {
          setError('Este email ja esta cadastrado');
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
        background: 'var(--color-background-primary)',
        color: 'var(--text-primary)',
        padding: '2rem',
      }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
            Confirme seu email
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
            Enviamos um link de confirmacao para <strong>{email}</strong>. 
            Clique no link para ativar sua conta.
          </p>
          
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.875rem' }}>
            Nao recebeu?{' '}
            <button
              onClick={async () => {
                await authApi.resendVerification(email);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary-primary)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Reenviar
            </button>
          </p>

          <Link to="/login" style={{ color: 'var(--color-primary-primary)', textDecoration: 'none' }}>
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
      background: 'var(--color-background-primary)',
      color: 'var(--text-primary)',
      padding: '2rem',
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', textAlign: 'center', fontFamily: 'var(--font-display)' }}>
          Criar conta
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Email *
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Nome (opcional)
            </label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Senha *
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Confirmar Senha *
            </label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="input" />
          </div>

          {error && <div className="alert-box alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <button type="submit" disabled={isLoading} className="btn btn-primary" style={{ width: '100%' }}>
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          Ja tem conta?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary-primary)' }}>Entrar</Link>
        </p>
      </div>
    </div>
  );
}
