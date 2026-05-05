/**
 * MeHomePage — landing-page de promoções ativas.
 * Topo: KPI cards (resumo da conta).
 * Banner: convites de repescagem pendentes (se houver).
 * Grid: cards de promoções ativas com 2 botões (Fazer depósito / Enviar comprovante).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { meApi, MePromotion, RepescagemInvitation } from '../../services/me-api';
import PromoUploadModal from '../../components/PromoUploadModal';

type LoadStatus = 'loading' | 'success' | 'error';

interface AccountStats {
  proofs: number;
  tickets: number;
  raffles: number;
}

export default function MeHomePage() {
  const [promotions, setPromotions] = useState<MePromotion[]>([]);
  const [invitations, setInvitations] = useState<RepescagemInvitation[]>([]);
  const [stats, setStats] = useState<AccountStats>({ proofs: 0, tickets: 0, raffles: 0 });
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<MePromotion | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setStatus('loading');
    const [promosRes, invitesRes, ticketsRes, rafflesRes] = await Promise.all([
      meApi.getPromotions(),
      meApi.getInvitations(),
      meApi.getTickets(),
      meApi.getRaffles(),
    ]);

    if (promosRes.success && promosRes.data) setPromotions(promosRes.data.promotions);
    if (invitesRes.success && invitesRes.data) setInvitations(invitesRes.data.invitations);

    const ticketCount = ticketsRes.success && ticketsRes.data ? ticketsRes.data.tickets.length : 0;
    const proofCount = ticketCount;
    const raffleCount = rafflesRes.success && rafflesRes.data ? rafflesRes.data.raffles.length : 0;
    setStats({ proofs: proofCount, tickets: ticketCount, raffles: raffleCount });

    setStatus('success');
  }

  async function handleAccept(invitationId: string, promotionName: string) {
    setActionMsg(null);
    const res = await meApi.acceptInvitation(invitationId);
    if (res.success && res.data) {
      setActionMsg(`Ticket #${res.data.ticket.number} emitido na promoção "${promotionName}".`);
      loadAll();
    } else {
      setActionMsg(res.error?.message || 'Erro ao aceitar convite.');
    }
  }

  async function handleDecline(invitationId: string) {
    setActionMsg(null);
    const res = await meApi.declineInvitation(invitationId);
    if (res.success) {
      setActionMsg('Convite recusado.');
      loadAll();
    } else {
      setActionMsg(res.error?.message || 'Erro ao recusar convite.');
    }
  }

  if (status === 'loading') {
    return <div className="empty-state">Carregando promoções…</div>;
  }

  return (
    <div>
      <div className="g-row mb-4">
        <div className="g-col-4">
          <KpiCard label="Comprovantes enviados" value={stats.proofs} />
        </div>
        <div className="g-col-4">
          <KpiCard label="Tickets ativos" value={stats.tickets} />
        </div>
        <div className="g-col-4">
          <KpiCard label="Sorteios participados" value={stats.raffles} />
        </div>
      </div>

      {actionMsg && (
        <div className="alert-box alert-info mb-4">{actionMsg}</div>
      )}

      {invitations.length > 0 && (
        <div className="card mb-4">
          <h2 className="card-title mb-3">Repescagem disponível</h2>
          <p className="text-secondary mb-4">
            Você ainda pode concorrer mesmo sem ter ganho em promoções anteriores.
          </p>
          {invitations.map(inv => (
            <div key={inv.id} className="card mb-3">
              <p className="mb-2">
                Você está elegível para a promoção <strong>{inv.promotion_name}</strong>.
              </p>
              <p className="text-muted text-sm mb-3">
                Seu ticket veio do sorteio <strong>{inv.source_promotion_name}</strong>.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAccept(inv.id, inv.promotion_name)}
                >
                  SIM, participar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleDecline(inv.id)}
                >
                  NÃO QUERO GANHAR ESSE PRÊMIO
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="page-header">
        <h2 className="page-title">Promoções ativas</h2>
      </div>

      {promotions.length === 0 ? (
        <div className="card empty-state">
          Nenhuma promoção ativa no momento. Volte em breve.
        </div>
      ) : (
        <div className="g-row">
          {promotions.map(promo => (
            <div key={promo.id} className="g-col-4 mb-4">
              <PromoCard
                promo={promo}
                onUploadClick={() => setUploadTarget(promo)}
              />
            </div>
          ))}
        </div>
      )}

      {uploadTarget && (
        <PromoUploadModal
          promo={uploadTarget}
          onClose={() => setUploadTarget(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-secondary text-xs uppercase mb-2">{label}</p>
      <p className="kpi-value">{value}</p>
    </div>
  );
}

function PromoCard({ promo, onUploadClick }: {
  promo: MePromotion;
  onUploadClick: () => void;
}) {
  const endsAt = useMemo(() => formatRemaining(promo.ends_at), [promo.ends_at]);

  return (
    <div className="card promo-grid-card">
      {promo.creative_url ? (
        promo.creative_type === 'video' ? (
          <video
            src={promo.creative_url}
            className="promo-creative"
            autoPlay
            loop
            muted
            playsInline
            aria-label={promo.name}
          />
        ) : (
          <img
            src={promo.creative_url}
            alt={promo.name}
            className="promo-creative"
          />
        )
      ) : (
        <div className="promo-creative promo-creative-placeholder" />
      )}
      <h3 className="card-title mb-2">{promo.name}</h3>
      <p className="text-muted text-xs uppercase mb-2">{promo.house_name}</p>
      {promo.description && (
        <p className="text-secondary text-sm mb-3">{promo.description}</p>
      )}
      <p className="text-muted text-xs mb-3">Termina em {endsAt}</p>
      <div className="flex gap-2 promo-grid-card-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.open(promo.deposit_url, '_blank', 'noopener,noreferrer')}
          disabled={!promo.deposit_url}
        >
          Fazer depósito
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onUploadClick}
        >
          Enviar comprovante
        </button>
      </div>
    </div>
  );
}

function formatRemaining(isoEnd: string): string {
  const end = new Date(isoEnd).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return 'encerrada';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days} dia${days === 1 ? '' : 's'}`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}min`;
}
