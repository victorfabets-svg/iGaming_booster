import React from 'react';

export interface ProcessingScreenProps {
  proofId: string;
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ proofId }) => {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <div
        aria-label="Processando"
        style={{
          width: 48,
          height: 48,
          margin: '0 auto 16px',
          border: '4px solid var(--text-muted)',
          borderTopColor: 'var(--color-warning-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <h2 style={{ marginBottom: 8 }}>Analisando comprovante</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 0 }}>
        Isso leva alguns segundos.
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 16, fontFamily: 'monospace' }}>
        ID: {proofId}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ProcessingScreen;