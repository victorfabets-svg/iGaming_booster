import React from 'react';
import { useSystemState } from '../hooks/useSystemState';

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'active':
      return 'badge-success';
    case 'executed':
      return 'badge-blue';
    case 'closed':
      return 'badge-gray';
    default:
      return 'badge-gray';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'executed':
      return 'Executado';
    case 'closed':
      return 'Fechado';
    default:
      return status;
  }
};

const RafflePanel: React.FC = () => {
  const { raffles, rafflesLoading, rafflesError } = useSystemState();

  if (rafflesLoading) {
    return (
      <div className="card">
        <h3 className="card-title">Sorteio</h3>
        <div className="loading-state">
          <p>Carregando sorteios...</p>
        </div>
      </div>
    );
  }

  if (rafflesError) {
    return (
      <div className="card">
        <h3 className="card-title">Sorteio</h3>
        <div className="alert-box alert-error">
          <h4>Erro</h4>
          <p>{rafflesError}</p>
        </div>
      </div>
    );
  }

  if (raffles.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Sorteio</h3>
        <div className="empty-state">
          <p>Nenhum sorteio encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">Sorteio</h3>
      <div className="raffle-list">
        {raffles.map((raffle) => (
          <div key={raffle.id} className="raffle-item">
            <div className="raffle-header">
              <span className="raffle-name">{raffle.name}</span>
              <span className={`badge ${statusBadgeClass(raffle.status)}`}>
                {statusLabel(raffle.status)}
              </span>
            </div>
            <div className="raffle-details">
              <div className="detail-row">
                <span className="detail-label">Prêmio:</span>
                <span className="detail-value prize-value">{raffle.prize}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Data do Sorteio:</span>
                <span className="detail-value">{new Date(raffle.draw_date).toLocaleString('pt-BR')}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Números Totais:</span>
                <span className="detail-value">{raffle.total_numbers}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RafflePanel;