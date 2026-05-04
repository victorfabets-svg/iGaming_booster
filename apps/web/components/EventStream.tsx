import React from 'react';

export interface StreamEvent {
  type: 'proof_submitted' | 'proof_validated' | 'proof_rejected' | 'reward_granted';
  user: string;
  time?: string;
}

const badgeForType = (t: StreamEvent['type']) => {
  switch (t) {
    case 'proof_submitted': return { cls: 'badge badge-gray', style: undefined };
    case 'proof_validated': return { cls: 'badge badge-success', style: undefined };
    case 'proof_rejected': return { cls: 'badge badge-error', style: undefined };
    case 'reward_granted': return { cls: 'badge badge-warning', style: undefined };
  }
};

const EventStream: React.FC<{ events: StreamEvent[] }> = ({ events }) => (
  <div className="card g-col-4">
    <h3 className="card-title">Fluxo de Eventos</h3>
    <div className="event-stream">
      {events.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sem eventos recentes.</p>}
      {events.map((e, i) => {
        const b = badgeForType(e.type);
        return (
          <div className="e-row" key={i}>
            <span className={b.cls} style={b.style}>{e.type}</span>
            <span className="e-desc">{e.user}</span>
            {e.time && <span className="e-time">{e.time}</span>}
          </div>
        );
      })}
    </div>
  </div>
);

export default EventStream;
