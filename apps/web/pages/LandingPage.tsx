/**
 * Landing Page — public root. Shows the featured promotion as the hero
 * (set by admin in /admin/promocoes); falls back to a generic Tipster
 * Engine hero when no promotion is featured / in-window.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface FeaturedPromotion {
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  house_slug: string;
  house_name: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  raffle: {
    name: string;
    prize: string;
    total_numbers: number;
    tickets_emitted: number;
  };
  tiers: Array<{ min_deposit_cents: number; tickets: number }>;
}

type LoadStatus = 'loading' | 'loaded' | 'error';

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function useCountdown(target: string): { days: number; hours: number; minutes: number; seconds: number; ended: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, ended: diff === 0 };
}

function TopBar({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <header className="landing-topbar">
      <div className="landing-topbar-inner">
        <span className="landing-brand">Tipster Engine</span>
        <nav className="landing-topbar-actions">
          <ThemeToggle compact />
          {isAuthenticated ? (
            <Link to="/me" className="btn btn-primary">Minha conta</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">Entrar</Link>
              <Link to="/signup" className="btn btn-primary">Cadastrar</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function FallbackHero() {
  return (
    <div className="landing-hero text-center">
      <h1 className="landing-title">Tipster Engine</h1>
      <p className="landing-subtitle">
        Potencialize seus lucros com predictions baseadas em dados. Acompanhe resultados em
        tempo real e ganhe prêmios exclusivos.
      </p>
    </div>
  );
}

function Countdown({ target }: { target: string }) {
  const { days, hours, minutes, seconds, ended } = useCountdown(target);
  if (ended) {
    return <span className="badge badge-gray">Encerrada</span>;
  }
  return (
    <div className="landing-countdown">
      <span className="landing-countdown-cell">{String(days).padStart(2, '0')}<small>d</small></span>
      <span className="landing-countdown-cell">{String(hours).padStart(2, '0')}<small>h</small></span>
      <span className="landing-countdown-cell">{String(minutes).padStart(2, '0')}<small>m</small></span>
      <span className="landing-countdown-cell">{String(seconds).padStart(2, '0')}<small>s</small></span>
    </div>
  );
}

function FeaturedHero({ promo, isAuthenticated }: { promo: FeaturedPromotion; isAuthenticated: boolean }) {
  const sortedTiers = useMemo(
    () => [...promo.tiers].sort((a, b) => a.min_deposit_cents - b.min_deposit_cents),
    [promo.tiers]
  );

  const total = promo.raffle.total_numbers;
  const emitted = promo.raffle.tickets_emitted;
  const pct = total > 0 ? Math.min(100, (emitted / total) * 100) : 0;

  // Authenticated → straight to /me. Unauthenticated → redirect via the API
  // so the affiliate click is registered + cookie set + ?ref forwarded to
  // /signup. Anchor (not <Link>) because the destination is a separate origin.
  const ctaLabel = isAuthenticated ? 'Ir para minha conta' : 'Cadastrar e participar';
  const ctaHref = isAuthenticated
    ? '/me'
    : `${API_BASE}/r/p/${encodeURIComponent(promo.slug)}`;

  return (
    <article className="landing-promo">
      <div className="landing-promo-card">
        <div className="landing-promo-creative">
          {promo.creative_url ? (
            <img src={promo.creative_url} alt={promo.name} />
          ) : (
            <div className="landing-promo-creative-placeholder" aria-hidden>
              <span>🏆</span>
            </div>
          )}
        </div>
        <div className="landing-promo-info">
          <span className="badge badge-warning landing-promo-badge">★ PRÊMIO PRINCIPAL</span>
          <h1 className="landing-promo-title">{promo.name}</h1>
          {promo.description && (
            <p className="landing-promo-description">{promo.description}</p>
          )}
          <p className="landing-promo-house">
            Casa parceira: <strong>{promo.house_name}</strong>
          </p>
        </div>
      </div>

      <div className="landing-promo-meta">
        <div className="landing-promo-meta-row">
          <span className="landing-promo-meta-label">Encerra em</span>
          <Countdown target={promo.ends_at} />
        </div>
        <div className="landing-promo-meta-row">
          <span className="landing-promo-meta-label">{pct.toFixed(1).replace('.', ',')}% vendido</span>
          <span className="landing-promo-meta-counts mono">{emitted.toLocaleString('pt-BR')} / {total.toLocaleString('pt-BR')} cotas</span>
        </div>
        <div className="landing-promo-progress">
          <div className="landing-promo-progress-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {sortedTiers.length > 0 && (
        <div className="landing-promo-tiers">
          <h2 className="landing-promo-tiers-title">Quanto mais você deposita, mais cotas você recebe</h2>
          <ul className="landing-promo-tiers-list">
            {sortedTiers.map((t, i) => (
              <li key={i} className="landing-promo-tier">
                <span className="landing-promo-tier-amount">{formatBRL(t.min_deposit_cents)}+</span>
                <span className="landing-promo-tier-arrow">→</span>
                <span className="landing-promo-tier-tickets">{t.tickets} {t.tickets === 1 ? 'cota' : 'cotas'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="landing-promo-cta">
        {isAuthenticated ? (
          <Link to={ctaHref} className="btn btn-primary btn-lg">{ctaLabel}</Link>
        ) : (
          <a href={ctaHref} className="btn btn-primary btn-lg">{ctaLabel}</a>
        )}
      </div>
    </article>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [promo, setPromo] = useState<FeaturedPromotion | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/public/promotions/featured`)
      .then(r => r.json())
      .then(body => {
        if (cancelled) return;
        const data = body?.success === true ? body.data : body;
        setPromo(data?.promotion ?? null);
        setStatus('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="landing-shell">
      <TopBar isAuthenticated={isAuthenticated} />
      <main className="landing-main">
        {status === 'loading' && <div className="landing-loading">Carregando…</div>}
        {status !== 'loading' && promo && <FeaturedHero promo={promo} isAuthenticated={isAuthenticated} />}
        {status !== 'loading' && !promo && <FallbackHero />}
      </main>
    </div>
  );
}
