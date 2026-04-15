import React, { useEffect } from 'react';
import { useSystemState } from '../state/useSystemState';

interface RaffleResultProps {
  userId?: string;
}

const RaffleResult: React.FC<RaffleResultProps> = ({ userId }) => {
  const { raffleResult, loading, error, loadRaffleResult, raffles } = useSystemState();

  useEffect(() => {
    // Load raffle result when we have an active raffle
    if (raffles.length > 0) {
      const activeRaffle = raffles.find(r => r.status === 'active' || r.status === 'executed');
      if (activeRaffle) {
        loadRaffleResult(activeRaffle.id);
      }
    }
  }, [raffles, loadRaffleResult]);

  if (loading) {
    return (
      <div className="card">
        <h3 className="card-title">Resultado do Sorteio</h3>
        <div className="loading-state">
          <p>Carregando resultados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3 className="card-title">Resultado do Sorteio</h3>
        <div className="alert-box alert-error">
          <h4>Erro</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!raffleResult) {
    return (
      <div className="card">
        <h3 className="card-title">Resultado do Sorteio</h3>
        <div className="empty-state">
          <p>Nenhum resultado encontrado</p>
        </div>
      </div>
    );
  }

  const isWinner = userId && raffleResult.winner_user_id === userId;
  const userStatus = isWinner ? 'won' : raffleResult.winner_user_id ? 'lost' : 'pending';

  return (
    <div className="card">
      <h3 className="card-title">Resultado do Sorteio</h3>
      <div className="result-list">
        <div className="result-item">
          <div className="result-header">
            <span className="result-title">Número Sorteado</span>
            <span className={`badge ${userStatus === 'won' ? 'badge-success' : userStatus === 'lost' ? 'badge-error' : 'badge-warning'}`}>
              {userStatus === 'won' ? 'Vencedor' : userStatus === 'lost' ? 'Perdedor' : 'Pendente'}
            </span>
          </div>
          <div className="winning-number">
            #{raffleResult.result_number.toString().padStart(4, '0')}
          </div>
          <div className="result-details">
            <div className="detail-row">
              <span className="detail-label">ID do Sorteio:</span>
              <span className="detail-value mono">{raffleResult.raffle_id}</span>
            </div>
            {raffleResult.winner_user_id && (
              <div className="detail-row">
                <span className="detail-label">Vencedor:</span>
                <span className="detail-value mono">{raffleResult.winner_user_id}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Executado em:</span>
              <span className="detail-value">{new Date(raffleResult.executed_at).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaffleResult;