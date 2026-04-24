import React from 'react';

export interface SubmittedScreenProps {
  proofId: string;
  isNew: boolean | null;
  submittedAt: string | null;
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

export const SubmittedScreen: React.FC<SubmittedScreenProps> = ({
  proofId,
  isNew,
  submittedAt,
  onOpenHistory,
  onSubmitAnother,
}) => {
  const timestamp = formatBrasiliaTime(submittedAt);
  const isDuplicate = isNew === false;

  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx={12} cy={12} r={11} fill={isDuplicate ? 'var(--color-warning-primary)' : 'var(--color-success-primary)'} />
        {isDuplicate ? (
          <path d="M12 7v5l3 2" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M7 12.5l3.5 3.5L17 9" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <h2 style={{ marginBottom: 8 }}>
        {isDuplicate ? 'Comprovante já recebido' : 'Comprovante enviado'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
        {isDuplicate
          ? 'Este arquivo já havia sido enviado antes. Nenhum registro novo foi criado.'
          : 'Confira o status na aba Histórico.'}
      </p>
      {timestamp && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          {isDuplicate ? 'Recebido em' : 'Enviado em'}: {timestamp}
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
