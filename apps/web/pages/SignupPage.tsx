/**
 * Signup Page — registration form.
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
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.register(email, password, displayName);
      if (response.success) {
        setShowConfirmation(true);
      } else if (response.error?.code === 'DUPLICATE_EMAIL') {
        setError('Este email já está cadastrado.');
      } else if (response.error?.code === 'RATE_LIMIT') {
        setError('Muitas tentativas. Aguarde alguns minutos.');
      } else {
        setError(response.error?.message || 'Erro ao cadastrar.');
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="auth-shell">
        <div className="card auth-card text-center">
          <h1 className="card-title mb-4">Confirme seu email</h1>
          <p className="text-secondary mb-6">
            Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para
            ativar sua conta.
          </p>
          <p className="text-secondary text-sm mb-4">
            Não recebeu?{' '}
            <button
              type="button"
              className="btn-link"
              onClick={() => { authApi.resendVerification(email); }}
            >
              Reenviar
            </button>
          </p>
          <Link to="/login" className="btn-link">Voltar para login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1 className="card-title text-center mb-6">Criar conta</h1>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="signup-email">Email *</label>
            <input
              id="signup-email"
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="signup-name">Nome (opcional)</label>
            <input
              id="signup-name"
              className="input"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="signup-password">Senha *</label>
            <input
              id="signup-password"
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="signup-confirm">Confirmar Senha *</label>
            <input
              id="signup-confirm"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="alert-box alert-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary full-width"
            disabled={isLoading}
          >
            {isLoading ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-secondary text-sm mt-4">
          Já tem conta? <Link to="/login" className="btn-link">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
