import React from 'react';

export interface RejectedScreenProps {
  onReset: () => void;
  confidenceScore: number | null;
}

export const RejectedScreen: React.FC<RejectedScreenProps> = ({ onReset, confidenceScore }) => {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx={12} cy={12} r={11} fill="var(--color-error-primary)" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <h2 style={{ marginBottom: 8 }}>Comprovante rejeitado</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Não foi possível validar este comprovante.
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

export default RejectedScreen;