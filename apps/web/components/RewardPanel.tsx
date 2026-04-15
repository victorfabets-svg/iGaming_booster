import React from 'react';
import { useSystemState } from '../hooks/useSystemState';

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'granted':
      return 'badge-success';
    case 'pending':
      return 'badge-warning';
    case 'expired':
      return 'badge-error';
    default:
      return 'badge-gray';
  }
};

const RewardPanel: React.FC = () => {
  const { rewards, rewardsLoading, rewardsError } = useSystemState();

  if (rewardsLoading) {
    return (
      <div className="card">
        <h3 className="card-title">Recompensa</h3>
        <div className="loading-state">
          <p>Carregando recompensas...</p>
        </div>
      </div>
    );
  }

  if (rewardsError) {
    return (
      <div className="card">
        <h3 className="card-title">Recompensa</h3>
        <div className="alert-box alert-error">
          <h4>Erro</h4>
          <p>{rewardsError}</p>
        </div>
      </div>
    );
  }

  if (rewards.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Recompensa</h3>
        <div className="empty-state">
          <p>Nenhuma recompensa encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">Recompensa</h3>
      <div className="reward-list">
        {rewards.map((reward) => (
          <div key={reward.id} className="reward-item">
            <div className="reward-header">
              <span className="badge">{reward.id}</span>
              <span className={`badge ${statusBadgeClass(reward.status)}`}>
                {reward.status === 'granted' ? 'Concedida' : reward.status === 'pending' ? 'Pendente' : 'Expirada'}
              </span>
            </div>
            <div className="reward-details">
              <div className="detail-row">
                <span className="detail-label">Proof ID:</span>
                <span className="detail-value mono">{reward.proof_id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Criado em:</span>
                <span className="detail-value">{new Date(reward.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tipo:</span>
                <span className="detail-value">{reward.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RewardPanel;