import React from 'react';
import { useSystemState } from '../state/useSystemState';

// TicketList displays tickets - currently using rewards as data source
// since tickets are linked to rewards in the backend
const TicketList: React.FC = () => {
  const { rewards, loading, error } = useSystemState();

  if (loading) {
    return (
      <div className="card">
        <h3 className="card-title">Bilhetes</h3>
        <div className="loading-state">
          <p>Carregando bilhetes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3 className="card-title">Bilhetes</h3>
        <div className="alert-box alert-error">
          <h4>Erro</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (rewards.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Bilhetes</h3>
        <div className="empty-state">
          <p>Nenhum bilhete encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">Bilhetes</h3>
      <table className="table-engine">
        <thead>
          <tr>
            <th>ID</th>
            <th>Reward ID</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rewards.map((reward) => (
            <tr key={reward.id}>
              <td>
                <span className="mono ticket-number">#{reward.id}</span>
              </td>
              <td>
                <span className="mono">{reward.proof_id}</span>
              </td>
              <td>
                <span className={`badge badge-${reward.status === 'granted' ? 'success' : 'warning'}`}>
                  {reward.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TicketList;