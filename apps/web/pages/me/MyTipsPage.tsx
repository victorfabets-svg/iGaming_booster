/**
 * MyTipsPage - User tips
 */

import React from 'react';
import { useEffect, useState } from 'react';
import { meApi } from '../../services/me-api';

interface Tip {
  id: string;
  house: string;
  market: string;
  odds: number;
  status: string;
  created_at: string;
}

export default function MyTipsPage() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [locked, setLocked] = useState(false);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    meApi.getTips().then(response => {
      if (response.success && response.data) {
        setTips(response.data.tips);
        setLocked(response.data.locked);
        setReason(response.data.reason || '');
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <div style={{ color: '#fff' }}>Carregando...</div>;
  }

  if (locked) {
    return (
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
          Tips
        </h1>
        <div style={{
          background: '#0f0f1a',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid #333',
          textAlign: 'center',
        }}>
          <p style={{ color: '#FFD700', fontSize: '1.25rem', marginBottom: '1rem' }}>
            Assinatura requerida
          </p>
          <p style={{ color: '#a0a0b0' }}>
           Assine um plano premium para ter acesso às tips exclusivas.
          </p>
        </div>
      </div>
    );
  }

  if (tips.length === 0) {
    return (
      <div style={{ color: '#fff', textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Nenhuma tip disponível</h2>
        <p style={{ color: '#a0a0b0' }}>
          Novas tips em breve.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
        Tips Recentes
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tips.map(tip => (
          <div key={tip.id} style={{
            background: '#0f0f1a',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ color: '#fff', fontWeight: 600 }}>{tip.house}</p>
              <p style={{ color: '#a0a0b0', fontSize: '0.875rem' }}>{tip.market}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#FFD700', fontWeight: 600, fontSize: '1.25rem' }}>
                {tip.odds}x
              </p>
              <p style={{ color: '#a0a0b0', fontSize: '0.75rem' }}>
                {tip.status}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}