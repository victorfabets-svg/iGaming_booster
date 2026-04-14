import React from 'react';

interface Props { tone: 'error' | 'warning'; title: string; description?: string; }

const AlertCard: React.FC<Props> = ({ tone, title, description }) => (
  <div className={`alert-box alert-${tone}`}>
    <h4>{title}</h4>
    {description && <p>{description}</p>}
  </div>
);

export default AlertCard;
