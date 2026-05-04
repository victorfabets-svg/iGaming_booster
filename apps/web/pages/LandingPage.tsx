/**
 * Landing Page — Tipster Engine
 *
 * Sections:
 *   1. Top bar  — brand + theme toggle + auth CTAs
 *   2. Hero     — headline + featured promo card (replaces mechanic pill)
 *   3. Como Funciona — 4 steps + per-house promo list with TIER buttons
 *   4. Narrative — core/loop/prova/objections/urgency
 *   5. CTA final
 *
 * Anywhere a promo or tier is clicked, PromoClaimModal opens with the
 * upload form. Modal handles passwordless signup + proof submission via
 * POST /public/promotions/:slug/claim.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import PromoClaimModal, { PromoClaimContext } from '../components/PromoClaimModal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Tier {
  min_deposit_cents: number;
  tickets: number;
}

interface ActivePromotion {
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  creative_type: 'image' | 'video';
  cta_label: string | null;
  cta_url: string | null;
  is_featured: boolean;
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
  tiers: Tier[];
}

type LoadStatus = 'loading' | 'loaded' | 'error';

function isUnsupportedDriveUrl(url: string | null): boolean {
  if (!url) return false;
  return /drive\.google\.com\/file\/d\//.test(url);
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function PromoCreative({ promo }: { promo: ActivePromotion }) {
  const broken = isUnsupportedDriveUrl(promo.creative_url);

  if (broken || !promo.creative_url) {
    return (
      <div className="landing-promo-creative-placeholder" aria-hidden>
        <span>🏆</span>
      </div>
    );
  }

  if (promo.creative_type === 'video') {
    return (
      <video
        src={promo.creative_url}
        autoPlay
        loop
        muted
        playsInline
        aria-label={promo.name}
      />
    );
  }

  return <img src={promo.creative_url} alt={promo.name} />;
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

function FeaturedPromoCard({ promo, onClick }: { promo: ActivePromotion; onClick: () => void }) {
  return (
    <button type="button" className="landing-featured-card" onClick={onClick}>
      <div className="landing-featured-media">
        <PromoCreative promo={promo} />
      </div>
      <div className="landing-featured-body">
        <span className="badge badge-warning">★ PRÊMIO PRINCIPAL</span>
        <h2 className="landing-featured-title">{promo.name}</h2>
        <p className="landing-featured-prize">{promo.raffle.prize}</p>
        <p className="landing-featured-house">{promo.house_name}</p>
        <span className="landing-featured-cta">Participar agora →</span>
      </div>
    </button>
  );
}

function HousePromoBlock({
  promo,
  onTierClick,
  onPromoClick,
}: {
  promo: ActivePromotion;
  onTierClick: (tier: Tier) => void;
  onPromoClick: () => void;
}) {
  const sortedTiers = useMemo(
    () => [...promo.tiers].sort((a, b) => a.min_deposit_cents - b.min_deposit_cents),
    [promo.tiers]
  );

  return (
    <div className="landing-house-promo-block">
      <button type="button" className="landing-house-promo-title" onClick={onPromoClick}>
        <span>{promo.name}</span>
        <span className="landing-house-promo-prize">{promo.raffle.prize}</span>
      </button>
      {sortedTiers.length > 0 ? (
        <div className="landing-tier-grid">
          {sortedTiers.map(tier => (
            <button
              key={tier.min_deposit_cents}
              type="button"
              className="landing-tier-btn"
              onClick={() => onTierClick(tier)}
            >
              <div className="landing-tier-amount">
                <strong>{formatBRL(tier.min_deposit_cents)}</strong>
                <span>depósito mínimo</span>
              </div>
              <div className="landing-tier-tickets">
                🎟 <strong>{tier.tickets}</strong> {tier.tickets === 1 ? 'cota' : 'cotas'}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm">Sem tiers configurados.</p>
      )}
    </div>
  );
}

function HouseGroup({
  houseName,
  promos,
  onPromoClick,
  onTierClick,
}: {
  houseName: string;
  promos: ActivePromotion[];
  onPromoClick: (promo: ActivePromotion) => void;
  onTierClick: (promo: ActivePromotion, tier: Tier) => void;
}) {
  return (
    <div className="landing-house-group">
      <h3 className="landing-house-group-title">{houseName}</h3>
      {promos.map(promo => (
        <HousePromoBlock
          key={promo.slug}
          promo={promo}
          onPromoClick={() => onPromoClick(promo)}
          onTierClick={t => onTierClick(promo, t)}
        />
      ))}
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`landing-faq-item ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="landing-faq-question"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="landing-faq-answer">{a}</div>}
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [promos, setPromos] = useState<ActivePromotion[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [claim, setClaim] = useState<PromoClaimContext | null>(null);
  const howItWorksRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/public/promotions/active`)
      .then(r => r.json())
      .then(body => {
        if (cancelled) return;
        const data = body?.success === true ? body.data : body;
        setPromos(data?.promotions ?? []);
        setStatus('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  const featured = useMemo(
    () => promos.find(p => p.is_featured) ?? promos[0] ?? null,
    [promos]
  );

  const promosByHouse = useMemo(() => {
    const acc = new Map<string, { name: string; promos: ActivePromotion[] }>();
    for (const p of promos) {
      const existing = acc.get(p.house_slug);
      if (existing) existing.promos.push(p);
      else acc.set(p.house_slug, { name: p.house_name, promos: [p] });
    }
    return Array.from(acc.entries());
  }, [promos]);

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openClaim = (promo: ActivePromotion, tier?: Tier) => {
    setClaim({
      promo_slug: promo.slug,
      promo_name: promo.name,
      house_name: promo.house_name,
      tier_min_deposit_cents: tier?.min_deposit_cents,
      tier_tickets: tier?.tickets,
    });
  };

  const primaryCtaHref = isAuthenticated ? '/me/upload' : '/signup';
  const primaryCtaOnClick = featured ? () => openClaim(featured) : undefined;

  return (
    <div className="landing-shell">
      <TopBar isAuthenticated={isAuthenticated} />

      <main className="landing-main-v2">
        {/* === HERO === */}
        <section className="landing-hero-v2">
          <div className="landing-hero-content">
            <h1 className="landing-hero-headline">
              Transforme seus depósitos em chances reais de ganhar
            </h1>
            <p className="landing-hero-sub">
              Você já aposta. Aqui, cada depósito vira tickets para participar das promoções ativas.
            </p>

            {featured ? (
              <FeaturedPromoCard promo={featured} onClick={() => openClaim(featured)} />
            ) : status === 'loaded' ? (
              <p className="landing-active-empty">Novas promoções em breve.</p>
            ) : (
              <p className="text-muted">Carregando promoções…</p>
            )}

            <div className="landing-hero-ctas">
              {primaryCtaOnClick ? (
                <button type="button" className="btn btn-primary btn-lg" onClick={primaryCtaOnClick}>
                  👉 Participar agora
                </button>
              ) : (
                <Link to={primaryCtaHref} className="btn btn-primary btn-lg">👉 Participar agora</Link>
              )}
              <button type="button" className="btn btn-ghost btn-lg" onClick={scrollToHowItWorks}>
                Ver como funciona ↓
              </button>
            </div>
          </div>
        </section>

        {/* === COMO FUNCIONA === */}
        <section className="landing-section" ref={howItWorksRef}>
          <h2 className="landing-section-title">Como participar (leva menos de 1 minuto)</h2>
          <ol className="landing-steps">
            <li><span className="landing-step-num">1</span><span>Faça um depósito em qualquer casa de aposta</span></li>
            <li><span className="landing-step-num">2</span><span>Envie o comprovante aqui na plataforma</span></li>
            <li><span className="landing-step-num">3</span><span>Receba seus tickets automaticamente</span></li>
            <li><span className="landing-step-num">4</span><span>Participe das promoções disponíveis</span></li>
          </ol>

          {promosByHouse.length > 0 && (
            <>
              <h3 className="landing-subsection-title">Deposite e ganhe bilhetes <span className="landing-accent">grátis</span></h3>
              <div className="landing-houses">
                {promosByHouse.map(([slug, group]) => (
                  <HouseGroup
                    key={slug}
                    houseName={group.name}
                    promos={group.promos}
                    onPromoClick={p => openClaim(p)}
                    onTierClick={(p, t) => openClaim(p, t)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* === CORE === */}
        <section className="landing-section landing-section-tinted">
          <h2 className="landing-section-title">Aqui sua aposta vale mais</h2>
          <div className="landing-narrative">
            <p>Você já faz depósitos nas casas de aposta.</p>
            <p>Aqui, esses mesmos depósitos viram chances reais de ganhar.</p>
            <p>Não depende de ganhar aposta.<br />Não depende de resultado no jogo.</p>
            <p><strong>Só depende de participar.</strong></p>
          </div>
          <ul className="landing-bullets">
            <li>Cada comprovante vira tickets</li>
            <li>Quanto mais você deposita, mais chances acumula</li>
            <li>Pode participar de várias promoções ao mesmo tempo</li>
            <li>Sistema automático, sem complicação</li>
          </ul>
        </section>

        {/* === LOOP === */}
        <section className="landing-section">
          <h2 className="landing-section-title">Quanto mais você participa, mais chances acumula</h2>
          <div className="landing-narrative">
            <p>Diferente da aposta, aqui você não perde participação.</p>
            <p>Cada depósito enviado aumenta suas chances.</p>
            <p>Quem participa mais:</p>
            <ul className="landing-arrow-list">
              <li>acumula mais tickets</li>
              <li>aumenta a probabilidade de ganhar</li>
            </ul>
          </div>
        </section>

        {/* === PROVA === */}
        <section className="landing-section landing-section-tinted">
          <h2 className="landing-section-title">Simples, direto e transparente</h2>
          <div className="landing-narrative">
            <p>Funciona como qualquer promoção por sorteio:</p>
            <p><strong>Você participa → recebe tickets → concorre.</strong></p>
            <p>Quanto mais tickets você tem, maiores são suas chances.</p>
            <p>Sem segredo. Sem pegadinha.</p>
          </div>
        </section>

        {/* === OBJEÇÕES === */}
        <section className="landing-section">
          <h2 className="landing-section-title">Dúvidas comuns</h2>
          <div className="landing-faq">
            <FAQItem q="Preciso ganhar na aposta?" a={<p>Não. Só o depósito já conta.</p>} />
            <FAQItem q="Preciso pagar para participar?" a={<p>Não. Você usa depósitos que já faria normalmente.</p>} />
            <FAQItem q="É complicado?" a={<p>Não. Leva menos de 1 minuto.</p>} />
            <FAQItem q="Tem limite de participação?" a={<p>Não. Quanto mais você participa, mais chances você tem.</p>} />
          </div>
        </section>

        {/* === URGÊNCIA === */}
        <section className="landing-section landing-section-tinted">
          <h2 className="landing-section-title">Cada depósito não enviado é uma chance perdida</h2>
          <div className="landing-narrative">
            <p>Se você já aposta, já poderia estar acumulando tickets.</p>
            <p>Quanto antes começar, mais chances você tem de ganhar.</p>
          </div>
        </section>

        {/* === FINAL === */}
        <section className="landing-section landing-section-final">
          <h2 className="landing-final-headline">Você já aposta. Agora faça isso valer mais.</h2>
          <p className="landing-final-sub">Transforme seus depósitos em chances reais de ganhar.</p>
          {primaryCtaOnClick ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={primaryCtaOnClick}>
              👉 Começar agora
            </button>
          ) : (
            <Link to={primaryCtaHref} className="btn btn-primary btn-lg">👉 Começar agora</Link>
          )}
        </section>
      </main>

      {claim && <PromoClaimModal context={claim} onClose={() => setClaim(null)} />}
    </div>
  );
}
