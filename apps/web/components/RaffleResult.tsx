import React from 'react';
import { useSystemState } from '../hooks/useSystemState';

interface RaffleResultProps {
  userId?: string;
}

const RaffleResult: React.FC<RaffleResultProps> = ({ userId }) => {
  const { results, resultsLoading, resultsError } = useSystemState();

  if (resultsLoading) {
    return (
      <div className="card">
        <h3 className="card-title">Resultado do Sorteio</h3>
        <div className="loading-state">
          <p>Carregando resultados...</p>
        </div>
      </div>
    );
  }

  if (resultsError) {
    return (
      <div className="card">
        <h3 className="card-title">Resultado do Sorteio</h3>
        <div className="alert-box alert-error">
          <h4>Erro</h4>
          <p>{resultsError}</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Resultado do Sorteio</h3>
        <div className="empty-state">
          <p>Nenhum resultado encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">Resultado do Sorteio</h3>
      <div className="result-list">
        {results.map((result) => {
          const isWinner = userId && result.winner_user_id === userId;
          const userStatus = isWinner ? 'won' : result.winner_user_id ? 'lost' : 'pending';

          return (
            <div key={result.id} className="result-item">
              <div className="result-header">
                <span className="result-title">Número Sorteado</span>
                <span className={`badge ${userStatus === 'won' ? 'badge-success' : userStatus === 'lost' ? 'badge-error' : 'badge-warning'}`}>
                  {userStatus === 'won' ? 'Vencedor' : userStatus === 'lost' ? 'Perdedor' : 'Pendente'}
                </span>
              </div>
              <div className="winning-number">
                #{result.winning_number.toString().padStart(4, '0')}
              </div>
              <div className="result-details">
                <div className="detail-row">
                  <span className="detail-label">ID do Sorteio:</span>
                  <span className="detail-value mono">{result.raffle_id}</span>
                </div>
                {result.winner_user_id && (
                  <div className="detail-row">
                    <span className="detail-label">Vencedor:</span>
                    <span className="detail-value mono">{result.winner_user_id}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Executado em:</span>
                  <span className="detail-value">{new Date(result.executed_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RaffleResult;