/**
 * MyRafflesPage - User raffles
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    return <div className="loading-state">Carregando...</div>;
  }

  if (raffles.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Nenhum sorteio disponivel</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Aguarde novos sorteios em breve.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Sorteios</h1>
      <div className="g-row">
        {raffles.map(raffle => (
          <div key={raffle.id} className={`g-col-4 ${raffle.status === 'completed' ? 'card card-highlight-success' : 'card'}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{raffle.name}</h3>
              <span className={`badge ${raffle.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                {raffle.status}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Premio: <span style={{ color: 'var(--color-success-primary)', fontWeight: 600 }}>{raffle.prize}</span>
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
             Data: {formatDate(raffle.draw_date)}
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Seus numeros: {raffle.my_ticket_count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
