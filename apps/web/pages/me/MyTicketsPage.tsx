/**
 * MyTicketsPage - User tickets
 */

import React from 'react';
import { useEffect, useState } from 'react';
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
    return <div style={{ color: '#fff' }}>Carregando...</div>;
  }

  if (tickets.length === 0) {
    return (
      <div style={{ color: '#fff', textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Você ainda não tem números</h2>
        <p style={{ color: '#a0a0b0' }}>
          Envie um comprovante para participar dos sorteios.
        </p>
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
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
        Meus Números
      </h1>

      {Object.entries(byRaffle).map(([raffleId, { name, tickets }]) => (
        <div key={raffleId} style={{
          background: '#0f0f1a',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #333',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ color: '#FFD700', marginBottom: '1rem' }}>{name}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {tickets.map(t => (
              <span
                key={t.id}
                style={{
                  background: t.status === 'winner' ? '#FFD700' : '#1a1a2e',
                  color: t.status === 'winner' ? '#1a1a2e' : '#fff',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                #{t.ticket_number}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}