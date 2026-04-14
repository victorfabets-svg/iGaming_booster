import React from 'react';
import EventStream, { StreamEvent } from '../../components/EventStream';

interface Props { events: StreamEvent[]; }

const CampaignsSection: React.FC<Props> = ({ events }) => (
  <section>
    <div className="g-row">
      <div className="card g-col-8" style={{ overflowX: 'auto' }}>
        <h3 className="card-title">Controle de Campanhas</h3>
        <table className="table-engine">
          <thead>
            <tr><th>Campanha</th><th>Cliques</th><th>FTD</th><th>Aprovação</th><th>Receita</th><th>EPC</th><th>Risco</th><th>Ações</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>FB-23</td>
              <td>4.200</td><td>320</td>
              <td style={{ color: 'var(--color-error-primary)' }}>62%</td>
              <td>R$ 3.200</td><td>0,76</td>
              <td><span className="badge badge-error">Alto</span></td>
              <td><button className="action-btn">Pausar</button></td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>TT-Promo</td>
              <td>6.100</td><td>590</td>
              <td style={{ color: 'var(--color-success-primary)' }}>86%</td>
              <td>R$ 9.100</td><td>1,49</td>
              <td><span className="badge badge-success">Baixo</span></td>
              <td><button className="action-btn" style={{ color: 'var(--color-success-primary)', borderColor: 'var(--color-success-primary)' }}>Escalar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <EventStream events={events} />
    </div>
  </section>
);

export default CampaignsSection;
