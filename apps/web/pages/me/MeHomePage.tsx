/**
 * MeHomePage — user dashboard home with quick-action cards.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';

export default function MeHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Olá, {user?.display_name || 'bem-vindo'}!</h1>
      </div>

      <div className="g-row">
        <ActionCard
          title="Enviar Comprovante"
          body="Envie o comprovante do seu depósito para validar e receber tickets."
          cta="Enviar"
          onClick={() => navigate('/me/upload')}
        />
        <ActionCard
          title="Meus Números"
          body="Veja seus números da sorte nos sorteios ativos."
          cta="Ver números"
          onClick={() => navigate('/me/tickets')}
        />
        <ActionCard
          title="Sorteios"
          body="Acompanhe os sorteios e seus prêmios."
          cta="Ver sorteios"
          onClick={() => navigate('/me/raffles')}
        />
      </div>
    </div>
  );
}

function ActionCard({ title, body, cta, onClick }: {
  title: string; body: string; cta: string; onClick: () => void;
}) {
  return (
    <div className="g-col-4">
      <div className="card">
        <h3 className="card-title mb-3">{title}</h3>
        <p className="text-secondary mb-4">{body}</p>
        <button type="button" className="btn btn-primary" onClick={onClick}>{cta}</button>
      </div>
    </div>
  );
}
