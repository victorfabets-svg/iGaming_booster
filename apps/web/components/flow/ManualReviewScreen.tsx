import React from 'react';

export interface ManualReviewScreenProps {
  onReset: () => void;
}

export const ManualReviewScreen: React.FC<ManualReviewScreenProps> = ({ onReset }) => {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx={12} cy={12} r={11} fill="var(--color-warning-primary)" />
        <path d="M12 7v5l3 2" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 style={{ marginBottom: 8 }}>Em análise manual</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Nossa equipe vai revisar seu comprovante. Você receberá uma notificação em breve.
      </p>
      <button className="btn btn-primary" onClick={onReset}>
        Enviar outro
      </button>
    </div>
  );
};

export default ManualReviewScreen;