/**
 * MeHomePage - User dashboard home
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';

export default function MeHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
        Olá, {user?.display_name || 'bem-vindo'}!
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div style={{
          background: '#0f0f1a',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #333',
        }}>
          <h3 style={{ color: '#a0a0b0', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Enviar Comprovante
          </h3>
          <p style={{ color: '#fff', marginBottom: '1rem' }}>
            Envie o comprovante do seu depósito para validar e receber tickets.
          </p>
          <button
            onClick={() => navigate('/me/upload')}
            style={{
              background: '#FFD700',
              color: '#1a1a2e',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Enviar
          </button>
        </div>

        <div style={{
          background: '#0f0f1a',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #333',
        }}>
          <h3 style={{ color: '#a0a0b0', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Meus Números
          </h3>
          <p style={{ color: '#fff', marginBottom: '1rem' }}>
            Veja seus números da sorte nos sorteios ativos.
          </p>
          <button
            onClick={() => navigate('/me/tickets')}
            style={{
              background: '#FFD700',
              color: '#1a1a2e',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ver números
          </button>
        </div>

        <div style={{
          background: '#0f0f1a',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #333',
        }}>
          <h3 style={{ color: '#a0a0b0', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Sorteios
          </h3>
          <p style={{ color: '#fff', marginBottom: '1rem' }}>
            Acompanhe os sorteios e seus prêmios.
          </p>
          <button
            onClick={() => navigate('/me/raffles')}
            style={{
              background: '#FFD700',
              color: '#1a1a2e',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ver sorteios
          </button>
        </div>
      </div>
    </div>
  );
}