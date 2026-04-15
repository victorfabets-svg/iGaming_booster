import React from 'react';
import { useSystemState } from '../state/useSystemState';

// Event type to label mapping
const EVENT_LABELS: Record<string, string> = {
  'proof_submitted': 'Comprovante enviado',
  'proof_validated': 'Comprovante validado',
  'proof_rejected': 'Comprovante rejeitado',
  'reward_created': 'Recompensa criada',
  'reward_granted': 'Recompensa concedida',
  'numbers_generated': 'Números gerados',
  'raffle_draw_executed': 'Sorteio realizado',
};

const getEventLabel = (eventType: string): string => {
  return EVENT_LABELS[eventType] || eventType;
};

const EventTimeline: React.FC = () => {
  const { events, loading, error, loadEvents } = useSystemState();

  // Sort events by timestamp DESC (most recent first)
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return dateB - dateA;
  });

  if (loading) {
    return (
      <div className="card">
        <h3 className="card-title">Linha do Tempo</h3>
        <div className="loading-state">
          <p>Carregando eventos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3 className="card-title">Linha do Tempo</h3>
        <div className="alert-box alert-error">
          <p>Erro: {error}</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Linha do Tempo</h3>
        <div className="empty-state">
          <p>Nenhum evento disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">Linha do Tempo</h3>
      
      <div className="timeline-container">
        {sortedEvents.map((event, index) => (
          <div key={event.id} className="timeline-item">
            <div className="timeline-marker">
              <span className="timeline-dot"></span>
              {index < sortedEvents.length - 1 && <span className="timeline-line"></span>}
            </div>
            <div className="timeline-content">
              <span className="timeline-timestamp">
                {new Date(event.timestamp).toLocaleString('pt-BR')}
              </span>
              <span className="timeline-label">
                {getEventLabel(event.event_type)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventTimeline;