import React, { useEffect } from 'react';
import { useSystemState } from '../state/useSystemState';

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
          <span className="metric-value">{summary.proof_submissions}</span>
        </div>

        {/* Validations */}
        <div className="metric-card">
          <span className="metric-label">Validações Aprovadas</span>
          <span className="metric-value success">{summary.validations?.approved ?? 0}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Validações Rejeitadas</span>
          <span className="metric-value error">{summary.validations?.rejected ?? 0}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Validações em Revisão</span>
          <span className="metric-value warning">{summary.validations?.manual_review ?? 0}</span>
        </div>

        {/* Rewards */}
        <div className="metric-card">
          <span className="metric-label">Recompensas Concedidas</span>
          <span className="metric-value success">{summary.rewards?.granted ?? 0}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Recompensas Bloqueadas</span>
          <span className="metric-value error">{summary.rewards?.blocked ?? 0}</span>
        </div>

        {/* Tickets */}
        <div className="metric-card">
          <span className="metric-label">Bilhetes Gerados</span>
          <span className="metric-value">{summary.tickets_generated ?? 0}</span>
        </div>

        {/* Raffle */}
        <div className="metric-card">
          <span className="metric-label">Sorteios Executados</span>
          <span className="metric-value">{summary.raffle_executions ?? 0}</span>
        </div>

        {/* Fraud */}
        <div className="metric-card">
          <span className="metric-label">Sinais de Fraude</span>
          <span className="metric-value fraud">{summary.fraud_signals ?? 0}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsPanel;