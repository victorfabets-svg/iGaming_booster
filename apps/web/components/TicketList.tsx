import React from 'react';

const TicketList: React.FC = () => {
  // Tickets are not yet available via API
  // They will be generated after a reward is granted
  // Showing empty state as per backend reality
  
  return (
    <div className="card">
      <h3 className="card-title">Bilhetes</h3>
      <div className="empty-state">
        <p>Os bilhetes serão exibidos após a recompensa ser concedida</p>
      </div>
    </div>
  );
};

export default TicketList;