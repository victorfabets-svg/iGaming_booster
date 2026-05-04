/**
 * Landing Page — Tipster Engine
 *
 * Sections (in order):
 *   1. Top bar  — brand + theme toggle + auth CTAs
 *   2. Hero     — headline + sub + mechanic + CTAs + grid of active promos
 *   3. Como Funciona — 4 steps + per-house promo list with tracked CTAs
 *   4. Core mecanismo, Loop, Prova, Objeções, Urgência — narrative copy
 *   5. CTA final
 *
 * Active promos come from GET /public/promotions/active.
 * Per-promo CTAs route through:
 *   /r/p/:slug          → tracking + signup (proof upload flow)
 *   /r/p/:slug/deposit  → tracking + redirect to house deposit_url
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
}

type LoadStatus = 'loading' | 'loaded' | 'error';

// Google Drive file links cannot be embedded directly into <img>/<video>
// (Drive rewrites/blocks hotlinking). Detect and warn the operator
// rather than render a silently broken element.
function isUnsupportedDriveUrl(url: string | null): boolean {
  if (!url) return false;
  return /drive\.google\.com\/file\/d\//.test(url);
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

function ActivePromoCard({ promo }: { promo: ActivePromotion }) {
  return (
    <article className="landing-active-card">
      <div className="landing-active-card-media">
        <PromoCreative promo={promo} />
      </div>
      <div className="landing-active-card-body">
        {promo.is_featured && <span className="badge badge-warning">★ Destaque</span>}
        <h3 className="landing-active-card-title">{promo.name}</h3>
        <p className="landing-active-card-house">{promo.house_name}</p>
        <p className="landing-active-card-prize">{promo.raffle.prize}</p>
      </div>
    </article>
  );
}

function HouseGroup({
  houseName,
  promos,
  isAuthenticated,
  expanded,
  onToggle,
}: {
  houseName: string;
  promos: ActivePromotion[];
  isAuthenticated: boolean;
  expanded: string | null;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="landing-house-group">
      <h3 className="landing-house-group-title">{houseName}</h3>
      <ul className="landing-house-group-list">
        {promos.map(promo => {
          const isOpen = expanded === promo.slug;
          // CTA "Enviar comprovante":
          //   - logged in: go straight to upload (already attributed)
          //   - logged out: through /r/p/:slug to record click + signup
          const proofHref = isAuthenticated
            ? `/me/upload?promo=${encodeURIComponent(promo.slug)}`
            : `${API_BASE}/r/p/${encodeURIComponent(promo.slug)}`;
          const proofIsExternal = !isAuthenticated;
          // CTA "Fazer depósito": always through the API to record the
          // click before bouncing to the partner house deposit URL.
          const depositHref = `${API_BASE}/r/p/${encodeURIComponent(promo.slug)}/deposit`;

          return (
            <li key={promo.slug} className={`landing-house-promo ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="landing-house-promo-header"
                onClick={() => onToggle(promo.slug)}
                aria-expanded={isOpen}
              >
                <span className="landing-house-promo-name">{promo.name}</span>
                <span className="landing-house-promo-prize">{promo.raffle.prize}</span>
                <span className="landing-house-promo-chevron" aria-hidden>
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen && (
                <div className="landing-house-promo-actions">
                  {proofIsExternal ? (
                    <a href={proofHref} className="btn btn-primary">Enviar comprovante</a>
                  ) : (
                    <Link to={proofHref} className="btn btn-primary">Enviar comprovante</Link>
                  )}
                  <a
                    href={depositHref}
                    className="btn btn-secondary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fazer depósito
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
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
  const [expandedPromo, setExpandedPromo] = useState<string | null>(null);
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

  const promosByHouse = useMemo(() => {
    const acc = new Map<string, { name: string; promos: ActivePromotion[] }>();
    for (const p of promos) {
      const existing = acc.get(p.house_slug);
      if (existing) {
        existing.promos.push(p);
      } else {
        acc.set(p.house_slug, { name: p.house_name, promos: [p] });
      }
    }
    return Array.from(acc.entries());
  }, [promos]);

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const primaryCtaHref = isAuthenticated ? '/me/upload' : '/signup';

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
            <p className="landing-hero-mechanic">
              Depositou → enviou comprovante → ganhou tickets
            </p>
            <div className="landing-hero-ctas">
              <Link to={primaryCtaHref} className="btn btn-primary btn-lg">
                👉 Participar agora
              </Link>
              <button type="button" className="btn btn-ghost btn-lg" onClick={scrollToHowItWorks}>
                Ver como funciona ↓
              </button>
            </div>
          </div>

          {status === 'loaded' && promos.length > 0 && (
            <div className="landing-active-grid">
              {promos.map(p => (
                <ActivePromoCard key={p.slug} promo={p} />
              ))}
            </div>
          )}
          {status === 'loaded' && promos.length === 0 && (
            <p className="landing-active-empty">Novas promoções em breve.</p>
          )}
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
              <h3 className="landing-subsection-title">Promoções disponíveis por casa</h3>
              <div className="landing-houses">
                {promosByHouse.map(([slug, group]) => (
                  <HouseGroup
                    key={slug}
                    houseName={group.name}
                    promos={group.promos}
                    isAuthenticated={isAuthenticated}
                    expanded={expandedPromo}
                    onToggle={s => setExpandedPromo(prev => prev === s ? null : s)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="landing-section-cta">
            <Link to={primaryCtaHref} className="btn btn-primary btn-lg">Quero gerar meus tickets</Link>
          </div>
        </section>

        {/* === CORE MECANISMO === */}
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
            <FAQItem
              q="Preciso ganhar na aposta?"
              a={<p>Não. Só o depósito já conta.</p>}
            />
            <FAQItem
              q="Preciso pagar para participar?"
              a={<p>Não. Você usa depósitos que já faria normalmente.</p>}
            />
            <FAQItem
              q="É complicado?"
              a={<p>Não. Leva menos de 1 minuto.</p>}
            />
            <FAQItem
              q="Tem limite de participação?"
              a={<p>Não. Quanto mais você participa, mais chances você tem.</p>}
            />
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

        {/* === CTA FINAL === */}
        <section className="landing-section landing-section-final">
          <h2 className="landing-final-headline">Você já aposta. Agora faça isso valer mais.</h2>
          <p className="landing-final-sub">Transforme seus depósitos em chances reais de ganhar.</p>
          <Link to={primaryCtaHref} className="btn btn-primary btn-lg">👉 Começar agora</Link>
        </section>
      </main>
    </div>
  );
}
