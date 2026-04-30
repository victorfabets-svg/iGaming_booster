import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useProofFlow from '../state/useProofFlow';
import UploadScreen from '../components/flow/UploadScreen';
import SubmittedScreen from '../components/flow/SubmittedScreen';
import ErrorScreen from '../components/flow/ErrorScreen';
import { meApi, MePromotion } from '../services/me-api';

export interface ConversionFlowProps {
  onOpenHistory?: () => void;
}

const ConversionFlow: React.FC<ConversionFlowProps> = ({ onOpenHistory }) => {
  const flow = useProofFlow();
  const [searchParams] = useSearchParams();
  const promotionSlug = searchParams.get('promotion');
  const [promotion, setPromotion] = useState<MePromotion | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  useEffect(() => {
    if (!promotionSlug) {
      setPromotion(null);
      setPromoError(null);
      return;
    }
    meApi.getPromotion(promotionSlug).then(res => {
      if (res.success && res.data) {
        setPromotion(res.data.promotion);
        setPromoError(null);
      } else {
        setPromotion(null);
        setPromoError(res.error?.message || 'Promoção não encontrada ou fora da janela.');
      }
    });
  }, [promotionSlug]);

  const banner = promotionSlug ? (
    <PromotionContextBanner promotion={promotion} error={promoError} />
  ) : null;

  switch (flow.phase) {
    case 'idle':
    case 'submitting':
      return (
        <>
          {banner}
          <UploadScreen
            onSubmit={flow.submit}
            isSubmitting={flow.phase === 'submitting'}
          />
        </>
      );
    case 'submitted':
    case 'approved':
    case 'rejected':
    case 'manual_review':
    case 'timeout':
      return (
        <SubmittedScreen
          proofId={flow.proofId ?? ''}
          isNew={flow.isNew}
          submittedAt={flow.submittedAt}
          status={flow.phase}
          confidenceScore={flow.confidenceScore}
          onOpenHistory={onOpenHistory ?? (() => {})}
          onSubmitAnother={flow.reset}
        />
      );
    case 'error':
      return (
        <ErrorScreen
          title="Falha no envio"
          description={flow.error ?? 'Não foi possível concluir a operação.'}
          onRetry={flow.retry}
          onReset={flow.reset}
          canRetry={flow.canRetry}
        />
      );
    default: {
      const _exhaustive: never = flow.phase;
      void _exhaustive;
      return null;
    }
  }
};

function PromotionContextBanner({
  promotion,
  error,
}: {
  promotion: MePromotion | null;
  error: string | null;
}) {
  if (error) {
    return <div className="alert-box alert-warning mb-4">{error}</div>;
  }
  if (!promotion) {
    return <div className="card empty-state mb-4">Carregando promoção…</div>;
  }
  return (
    <div className="card mb-4">
      <div className="flex gap-4 items-center">
        {promotion.creative_url ? (
          <img
            src={promotion.creative_url}
            alt={promotion.name}
            className="promo-creative-thumb"
          />
        ) : (
          <div className="promo-creative-thumb promo-creative-placeholder" />
        )}
        <div className="flex-1">
          <p className="text-muted text-xs uppercase mb-1">Promoção</p>
          <h2 className="card-title mb-2">{promotion.name}</h2>
          <p className="text-secondary text-sm">{promotion.house_name}</p>
        </div>
      </div>
      {promotion.tiers.length > 0 && (
        <div className="mt-4">
          <p className="text-muted text-xs uppercase mb-2">Faixas de tickets</p>
          <table className="table-engine">
            <thead>
              <tr>
                <th>Depósito mínimo</th>
                <th>Tickets</th>
              </tr>
            </thead>
            <tbody>
              {promotion.tiers.map(t => (
                <tr key={t.min_deposit_cents}>
                  <td className="mono">R$ {(t.min_deposit_cents / 100).toFixed(2)}</td>
                  <td className="mono">{t.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ConversionFlow;
