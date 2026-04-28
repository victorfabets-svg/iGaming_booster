/**
 * MyTicketsPage - User tickets
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meApi } from '../../services/me-api';

interface Ticket {
  id: string;
  raffle_id: string;
  raffle_name: string;
  ticket_number: number;
  status: string;
  created_at: string;
}

export default function MyTicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    meApi.getTickets().then(response => {
      if (response.success && response.data) {
        setTickets(response.data.tickets);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <div className="loading-state">Carregando...</div>;
  }

  if (tickets.length === 0) {
    return (
      <div className="card empty-state">
        <h2 className="card-title mb-3">Você ainda não tem números</h2>
        <p className="text-secondary mb-4">Envie um comprovante para participar dos sorteios.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/me/upload')}>
          Enviar Comprovante
        </button>
      </div>
    );
  }

  // Group by raffle
  const byRaffle = tickets.reduce((acc, ticket) => {
    const key = ticket.raffle_id;
    if (!acc[key]) {
      acc[key] = { name: ticket.raffle_name, tickets: [] };
    }
    acc[key].tickets.push(ticket);
    return acc;
  }, {} as Record<string, { name: string; tickets: Ticket[] }>);

  return (
    <div className="g-row">
      <div className="g-col-12">
        <div className="card">
          <h1 className="card-title">Meus Numeros</h1>
          <table className="table-engine">
            <thead>
              <tr>
                <th>Sorteio</th>
                <th>Numero</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byRaffle).map(([raffleId, { name, tickets: raffleTickets }]) =>
                raffleTickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td>{name}</td>
                    <td className="mono">{String(ticket.ticket_number).padStart(4, '0')}</td>
                    <td>
                      <span className={`badge ${ticket.status === 'won' ? 'badge-success' : ticket.status === 'pending' ? 'badge-warning' : 'badge-gray'}`}>
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
