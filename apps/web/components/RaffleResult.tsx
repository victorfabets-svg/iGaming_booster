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
          <p>Aguardando execução do sorteio</p>
        </div>
      </div>
    );
  }

  // Determine user outcome
  const hasWinner = raffleResult.winner_user_id !== null;
  const isWinner = userId && raffleResult.winner_user_id === userId;
  
  // Outcome states
  const getOutcome = () => {
    if (isWinner) {
      return { 
        emoji: '🎉', 
        message: 'Você ganhou!', 
        class: 'outcome-won' 
      };
    }
    if (hasWinner && userId) {
      return { 
        emoji: '😢', 
        message: 'Você não ganhou', 
        class: 'outcome-lost' 
      };
    }
    if (hasWinner) {
      return { 
        emoji: '✓', 
        message: 'Sorteio realizado', 
        class: 'outcome-completed' 
      };
    }
    return { 
      emoji: '⏳', 
      message: 'Aguardando resultado', 
      class: 'outcome-pending' 
    };
  };

  const outcome = getOutcome();

  return (
    <div className="card">
      <h3 className="card-title">Resultado do Sorteio</h3>
      
      {/* Primary Outcome Display - BIG and centered */}
      <div className={`outcome-display ${outcome.class}`}>
        <span className="outcome-emoji">{outcome.emoji}</span>
        <span className="outcome-message">{outcome.message}</span>
      </div>

      {/* Optional Details */}
      <div className="result-details">
        <div className="detail-row">
          <span className="detail-label">Número Sorteado:</span>
          <span className="detail-value mono winning-number-lg">
            #{raffleResult.result_number.toString().padStart(4, '0')}
          </span>
        </div>
        
        {raffleResult.prize && (
          <div className="detail-row">
            <span className="detail-label">Prêmio:</span>
            <span className="detail-value prize-value-lg">{raffleResult.prize}</span>
          </div>
        )}
        
        <div className="detail-row">
          <span className="detail-label">Sorteio:</span>
          <span className="detail-value mono">{raffleResult.raffle_name || raffleResult.raffle_id}</span>
        </div>
        
        {raffleResult.winner_user_id && (
          <div className="detail-row">
            <span className="detail-label">Vencedor:</span>
            <span className="detail-value mono">{raffleResult.winner_user_id}</span>
          </div>
        )}
        
        <div className="detail-row">
          <span className="detail-label">Data:</span>
          <span className="detail-value">{new Date(raffleResult.executed_at).toLocaleString('pt-BR')}</span>
        </div>
      </div>
    </div>
  );
};

export default RaffleResult;