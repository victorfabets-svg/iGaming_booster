/**
 * MyRafflesPage — list raffles + my tickets per raffle.
 */

import React, { useEffect, useState } from 'react';
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
      if (response.success && response.data) setRaffles(response.data.raffles);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <div className="empty-state">Carregando…</div>;

  if (raffles.length === 0) {
    return (
      <div className="card empty-state">
        <h2 className="card-title mb-3">Nenhum sorteio disponível</h2>
        <p className="text-secondary">Aguarde novos sorteios em breve.</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sorteios</h1>
      </div>

      <div className="g-row">
        {raffles.map(raffle => (
          <div key={raffle.id} className="g-col-4">
            <div className={`card ${raffle.status === 'completed' ? 'card-highlight-success' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="card-title">{raffle.name}</h3>
                <span className={`badge ${raffle.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                  {raffle.status}
                </span>
              </div>
              <p className="text-secondary mb-2">
                Prêmio: <span className="text-success font-bold">{raffle.prize}</span>
              </p>
              <p className="text-secondary mb-2">Data: {formatDate(raffle.draw_date)}</p>
              <p className="text-secondary">
                Seus números: <span className="font-bold text-primary">{raffle.my_ticket_count}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
