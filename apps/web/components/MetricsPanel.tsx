import React, { useEffect } from 'react';
import { useSystemState } from '../state/useSystemState';

// Helper to display values - preserves null as "N/A"
const displayValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return String(value);
};

const MetricsPanel: React.FC = () => {
  const { metrics, loading, error, loadMetrics } = useSystemState();

  useEffect(() => {
    // Metrics are loaded automatically by useSystemState with polling
    // This effect ensures initial load
  }, []);

  if (loading && !metrics) {
    return (
      <div className="card">
        <h3 className="card-title">Métricas do Sistema</h3>
        <div className="loading-state">
          <p>Carregando métricas...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="card">
        <h3 className="card-title">Métricas do Sistema</h3>
        <div className="alert-box alert-error">
          <p>Erro: {error}</p>
        </div>
      </div>
    );
  }

  if (!metrics || !metrics.summary) {
    return (
      <div className="card">
        <h3 className="card-title">Métricas do Sistema</h3>
        <div className="empty-state">
          <p>Sem dados disponíveis</p>
        </div>
      </div>
    );
  }

  const { summary } = metrics;

  return (
    <div className="card">
      <h3 className="card-title">Métricas do Sistema</h3>
      
      <div className="metrics-grid">
        {/* Proof Submissions */}
        <div className="metric-card">
          <span className="metric-label">Provas Enviadas</span>
          <span className="metric-value">{displayValue(summary.proof_submissions)}</span>
        </div>

        {/* Validations */}
        <div className="metric-card">
          <span className="metric-label">Validações Aprovadas</span>
          <span className="metric-value success">{displayValue(summary.validations?.approved)}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Validações Rejeitadas</span>
          <span className="metric-value error">{displayValue(summary.validations?.rejected)}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Validações em Revisão</span>
          <span className="metric-value warning">{displayValue(summary.validations?.manual_review)}</span>
        </div>

        {/* Rewards */}
        <div className="metric-card">
          <span className="metric-label">Recompensas Concedidas</span>
          <span className="metric-value success">{displayValue(summary.rewards?.granted)}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Recompensas Bloqueadas</span>
          <span className="metric-value error">{displayValue(summary.rewards?.blocked)}</span>
        </div>

        {/* Tickets */}
        <div className="metric-card">
          <span className="metric-label">Bilhetes Gerados</span>
          <span className="metric-value">{displayValue(summary.tickets_generated)}</span>
        </div>

        {/* Raffle */}
        <div className="metric-card">
          <span className="metric-label">Sorteios Executados</span>
          <span className="metric-value">{displayValue(summary.raffle_executions)}</span>
        </div>

        {/* Fraud */}
        <div className="metric-card">
          <span className="metric-label">Sinais de Fraude</span>
          <span className="metric-value fraud">{displayValue(summary.fraud_signals)}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsPanel;