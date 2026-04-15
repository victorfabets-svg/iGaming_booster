import React from 'react';
import { useSystemState } from '../hooks/useSystemState';

const TicketList: React.FC = () => {
  const { tickets, ticketsLoading, ticketsError } = useSystemState();

  if (ticketsLoading) {
    return (
      <div className="card">
        <h3 className="card-title">Bilhetes</h3>
        <div className="loading-state">
          <p>Carregando bilhetes...</p>
        </div>
      </div>
    );
  }

  if (ticketsError) {
    return (
      <div className="card">
        <h3 className="card-title">Bilhetes</h3>
        <div className="alert-box alert-error">
          <h4>Erro</h4>
          <p>{ticketsError}</p>
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
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
            <th>Número</th>
            <th>Raffle ID</th>
            <th>Criado em</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <span className="mono ticket-number">#{ticket.number.toString().padStart(4, '0')}</span>
              </td>
              <td>
                <span className="mono">{ticket.raffle_id}</span>
              </td>
              <td>{new Date(ticket.created_at).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TicketList;