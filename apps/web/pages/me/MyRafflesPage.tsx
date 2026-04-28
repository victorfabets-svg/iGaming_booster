/**
 * MyRafflesPage - User raffles
 */

import React from 'react';
import { useEffect, useState } from 'react';
import { meApi } from '../../services/me-api';

interface Raffle {
  id: string;
  name: string;
  prize: string;
  draw_date: string;
  status: string;
  my_ticket_count: number;
}

export default function MyRafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    meApi.getRaffles().then(response => {
      if (response.success && response.data) {
        setRaffles(response.data.raffles);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <div style={{ color: '#fff' }}>Carregando...</div>;
  }

  if (raffles.length === 0) {
    return (
      <div style={{ color: '#fff', textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Nenhum sorteio disponível</h2>
        <p style={{ color: '#a0a0b0' }}>
          Aguarde novos sorteios em breve.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
        Sorteios
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {raffles.map(raffle => (
          <div key={raffle.id} style={{
            background: '#0f0f1a',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #333',
          }}>
            <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>{raffle.name}</h3>
            <p style={{ color: '#FFD700', fontWeight: 600, marginBottom: '1rem' }}>
              Prêmio: {raffle.prize}
            </p>
            <div style={{ color: '#a0a0b0', fontSize: '0.875rem' }}>
              <p>Data do sorteio: {formatDate(raffle.draw_date)}</p>
              <p>Seus números: {raffle.my_ticket_count}</p>
              <p>Status: {raffle.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}