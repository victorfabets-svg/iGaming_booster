/**
 * Signup Page — registration form.
 */

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/auth-api';

const REF_KEY = 'igb_signup_ref';
const PROMO_KEY = 'igb_signup_promo';
const PROMO_NAME_KEY = 'igb_signup_promo_name';

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [trackingRef, setTrackingRef] = useState<string | null>(null);
  const [promoName, setPromoName] = useState<string | null>(null);

  // Capture ?ref / ?promo / ?promo_name from URL once and persist in
  // sessionStorage so a verify-email round-trip or accidental refresh
  // doesn't lose the attribution context before /register fires.
  useEffect(() => {
    const refParam = searchParams.get('ref');
    const promoParam = searchParams.get('promo');
    const promoNameParam = searchParams.get('promo_name');

    try {
      if (refParam) sessionStorage.setItem(REF_KEY, refParam);
      if (promoParam) sessionStorage.setItem(PROMO_KEY, promoParam);
      if (promoNameParam) sessionStorage.setItem(PROMO_NAME_KEY, promoNameParam);

      setTrackingRef(refParam || sessionStorage.getItem(REF_KEY));
      setPromoName(promoNameParam || sessionStorage.getItem(PROMO_NAME_KEY));
    } catch {
      // sessionStorage unavailable (private mode, etc.) — fall back to URL only.
      setTrackingRef(refParam);
      setPromoName(promoNameParam);
    }
  }, [searchParams]);

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
      const response = await authApi.register(email, password, displayName, trackingRef ?? undefined);
      if (response.success) {
        // Clear stored attribution context on success.
        try {
          sessionStorage.removeItem(REF_KEY);
          sessionStorage.removeItem(PROMO_KEY);
          sessionStorage.removeItem(PROMO_NAME_KEY);
        } catch { /* ignore */ }
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

        {promoName && (
          <div className="alert-box alert-info mb-4">
            Você está se cadastrando para participar de <strong>{promoName}</strong>.
          </div>
        )}

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
