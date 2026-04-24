import React from 'react';

export type SubmittedStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'manual_review'
  | 'timeout';

export interface SubmittedScreenProps {
  proofId: string;
  isNew: boolean | null;
  submittedAt: string | null;
  status: SubmittedStatus;
  confidenceScore: number | null;
  onOpenHistory: () => void;
  onSubmitAnother: () => void;
}

const BRT = 'America/Sao_Paulo';

function formatBrasiliaTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    timeZone: BRT,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

interface Visual {
  iconColor: string;
  iconPath: React.ReactNode;
  title: string;
  description: string;
  badge: { label: string; cls: string } | null;
  timestampLabel: string;
}

const CHECK_PATH = (
  <path d="M7 12.5l3.5 3.5L17 9" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
);
const CLOCK_PATH = (
  <path d="M12 7v5l3 2" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
);
const CROSS_PATH = (
  <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
);

function getVisual(status: SubmittedStatus, isDuplicate: boolean): Visual {
  if (status === 'approved') {
    return {
      iconColor: 'var(--color-success-primary)',
      iconPath: CHECK_PATH,
      title: 'Comprovante aprovado',
      description: 'Validação concluída com sucesso.',
      badge: { label: 'Aprovado', cls: 'badge badge-success' },
      timestampLabel: 'Enviado em',
    };
  }
  if (status === 'rejected') {
    return {
      iconColor: 'var(--color-error-primary)',
      iconPath: CROSS_PATH,
      title: 'Comprovante rejeitado',
      description: 'Não foi possível validar este comprovante. Veja detalhes no Histórico.',
      badge: { label: 'Rejeitado', cls: 'badge badge-error' },
      timestampLabel: 'Enviado em',
    };
  }
  if (status === 'manual_review') {
    return {
      iconColor: 'var(--color-warning-primary)',
      iconPath: CLOCK_PATH,
      title: 'Em revisão',
      description: 'Seu comprovante está em revisão manual. Avisaremos por aqui ou no Histórico.',
      badge: { label: 'Revisão manual', cls: 'badge badge-purple' },
      timestampLabel: 'Enviado em',
    };
  }
  if (status === 'timeout') {
    return {
      iconColor: 'var(--color-success-primary)',
      iconPath: CHECK_PATH,
      title: 'Comprovante recebido',
      description: 'A validação está demorando mais do que o normal — confira o andamento no Histórico.',
      badge: null,
      timestampLabel: 'Enviado em',
    };
  }
  // status === 'submitted'
  if (isDuplicate) {
    return {
      iconColor: 'var(--color-warning-primary)',
      iconPath: CLOCK_PATH,
      title: 'Comprovante já recebido',
      description: 'Este arquivo já havia sido enviado antes. Nenhum registro novo foi criado.',
      badge: null,
      timestampLabel: 'Recebido em',
    };
  }
  return {
    iconColor: 'var(--color-success-primary)',
    iconPath: CHECK_PATH,
    title: 'Comprovante enviado',
    description: 'Confira o status na aba Histórico.',
    badge: { label: 'Em análise…', cls: 'badge badge-warning' },
    timestampLabel: 'Enviado em',
  };
}

export const SubmittedScreen: React.FC<SubmittedScreenProps> = ({
  proofId,
  isNew,
  submittedAt,
  status,
  confidenceScore,
  onOpenHistory,
  onSubmitAnother,
}) => {
  const timestamp = formatBrasiliaTime(submittedAt);
  const isDuplicate = isNew === false;
  const v = getVisual(status, isDuplicate);

  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx={12} cy={12} r={11} fill={v.iconColor} />
        {v.iconPath}
      </svg>
      <h2 style={{ marginBottom: 8 }}>{v.title}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>{v.description}</p>
      {v.badge && (
        <p style={{ marginBottom: 8 }}>
          <span className={v.badge.cls}>{v.badge.label}</span>
        </p>
      )}
      {status === 'approved' && confidenceScore != null && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
          Confiança: {confidenceScore.toFixed(2)}
        </p>
      )}
      {timestamp && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          {v.timestampLabel}: {timestamp}
        </p>
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 24, fontFamily: 'monospace' }}>
        ID: {proofId}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onOpenHistory}>
          Abrir Histórico
        </button>
        <button className="btn btn-secondary" onClick={onSubmitAnother}>
          Enviar outro
        </button>
      </div>
    </div>
  );
};

export default SubmittedScreen;
