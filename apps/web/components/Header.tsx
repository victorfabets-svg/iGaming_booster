import React from 'react';
import Icon from './Icon';

interface HeaderProps {
  health: 'healthy' | 'degraded' | 'unknown';
  latencyMs?: number | null;
  healthError?: string | null;
}

const Header: React.FC<HeaderProps> = ({ health, latencyMs, healthError }) => {
  const dotColor =
    health === 'healthy' ? 'var(--color-success-primary)' :
    health === 'degraded' ? 'var(--color-error-primary)' :
    'var(--color-warning-primary)';

  const healthLabel =
    health === 'healthy' ? 'Sistema Saudável' :
    health === 'degraded' ? 'Sistema Degradado' : 'Status desconhecido';

  return (
    <header className="global-header">
      {healthError && (
        <div className="error-banner" style={{ 
          padding: '8px 16px', 
          backgroundColor: 'var(--color-error-primary)', 
          color: 'white',
          marginBottom: 8,
          borderRadius: 4
        }}>
          <Icon name="alert" size={14} />
          <span style={{ marginLeft: 8 }}>Erro: {healthError}</span>
        </div>
      )}
      <div className="header-controls">
        <div className="selector"><Icon name="calendar" size={14} /> Período ▼</div>
        <div className="selector"><Icon name="target" size={14} /> Campanha ▼</div>
        <div className="selector"><Icon name="link" size={14} /> Origem ▼</div>
        <div className="selector"><Icon name="pin" size={14} /> Localização ▼</div>
      </div>
      <div className="system-status">
        <div className="status-pill"><span className="dot" style={{ color: dotColor }} /> {healthLabel}</div>
        <div className="status-pill"><Icon name="activity" size={14} /> Latência: {latencyMs != null ? `${latencyMs}ms` : '—'}</div>
        <div className="status-pill"><Icon name="layers" size={14} /> Fila: Normal</div>
      </div>
    </header>
  );
};

export default Header;