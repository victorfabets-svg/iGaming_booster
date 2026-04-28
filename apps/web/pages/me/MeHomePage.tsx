/**
 * MeHomePage - User dashboard home
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';

export default function MeHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>
        Olá, {user?.display_name || 'bem-vindo'}!
      </h1>

      <div className="g-row">
        <div className="g-col-4">
          <div className="card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Enviar Comprovante
            </h3>
            <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Envie o comprovante do seu depósito para validar e receber tickets.
            </p>
            <button
              onClick={() => navigate('/me/upload')}
              className="btn btn-primary"
            >
              Enviar
            </button>
          </div>
        </div>

        <div className="g-col-4">
          <div className="card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Meus Números
            </h3>
            <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Veja seus números da sorte nos sorteios ativos.
            </p>
            <button
              onClick={() => navigate('/me/tickets')}
              className="btn btn-primary"
            >
              Ver números
            </button>
          </div>
        </div>

        <div className="g-col-4">
          <div className="card">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Sorteios
            </h3>
            <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Acompanhe os sorteios e seus prêmios.
            </p>
            <button
              onClick={() => navigate('/me/raffles')}
              className="btn btn-primary"
            >
              Ver sorteios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}