import React from 'react';

export interface ErrorScreenProps {
  title: string;
  description: string;
  onRetry: () => void;
  onReset: () => void;
  canRetry: boolean;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ title, description, onRetry, onReset, canRetry }) => {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx={12} cy={12} r={11} fill="var(--color-error-primary)" />
        <path d="M12 7v6M12 16.5v0.5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <h2 style={{ marginBottom: 8 }}>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{description}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        {canRetry && (
          <button className="btn btn-primary" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
        <button className="btn btn-secondary" onClick={onReset}>
          Voltar ao início
        </button>
      </div>
    </div>
  );
};

export default ErrorScreen;