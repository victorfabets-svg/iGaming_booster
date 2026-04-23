import React from 'react';

export interface ApprovedScreenProps {
  onReset: () => void;
  confidenceScore: number | null;
}

export const ApprovedScreen: React.FC<ApprovedScreenProps> = ({ onReset, confidenceScore }) => {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx={12} cy={12} r={11} fill="var(--color-success-primary)" />
        <path d="M7 12.5l3.5 3.5L17 9" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 style={{ marginBottom: 8 }}>Comprovante aprovado</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Tudo certo. Recompensa liberada.
      </p>
      {confidenceScore !== null && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>
          Confiança: {confidenceScore.toFixed(2)}
        </p>
      )}
      <button className="btn btn-primary" onClick={onReset}>
        Enviar outro
      </button>
    </div>
  );
};

export default ApprovedScreen;