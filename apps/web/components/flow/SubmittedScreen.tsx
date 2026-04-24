import React from 'react';

export interface SubmittedScreenProps {
  proofId: string;
  onOpenHistory: () => void;
  onSubmitAnother: () => void;
}

export const SubmittedScreen: React.FC<SubmittedScreenProps> = ({
  proofId,
  onOpenHistory,
  onSubmitAnother,
}) => {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx={12} cy={12} r={11} fill="var(--color-success-primary)" />
        <path d="M7 12.5l3.5 3.5L17 9" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 style={{ marginBottom: 8 }}>Comprovante enviado</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Confira o status na aba <b>Histórico</b>.
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 24, fontFamily: 'monospace' }}>
        ID: {proofId}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
