/**
 * MyTipsPage - User tips view
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useEffect, useState } from 'react';
import { meApi } from '../../services/me-api';

interface Tip {
  id: string;
  house_name: string;
  market: string;
  pick: string;
  odds: number;
  result: string;
  created_at: string;
}

export default function MyTipsPage() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    meApi.getTips().then(response => {
      if (response.success && response.data) {
        setTips(response.data.tips || []);
      } else if (response.error?.code === 'SUBSCRIPTION_REQUIRED') {
        setHasAccess(false);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <div className="loading-state">Carregando...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="card-title">Tips Bloqueadas</h1>
        <div className="alert-box alert-warning">
          Subscribe to access tips.
        </div>
      </div>
    );
  }

  if (tips.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Nenhuma tip disponivel.</p>
      </div>
    );
  }

  return (
    <div className="g-row">
      <div className="g-col-12">
        <div className="card">
          <h1 className="card-title">Tips Recentes</h1>
          <table className="table-engine">
            <thead>
              <tr>
                <th>Casa</th>
                <th>Mercado</th>
                <th>Pick</th>
                <th>Odds</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {tips.map(tip => (
                <tr key={tip.id}>
                  <td>{tip.house_name}</td>
                  <td>{tip.market}</td>
                  <td>{tip.pick}</td>
                  <td className="mono">{tip.odds}</td>
                  <td>
                    <span className={`badge ${
                      tip.result === 'won' ? 'badge-success' : 
                      tip.result === 'lost' ? 'badge-error' : 
                      tip.result === 'pending' ? 'badge-warning' : 'badge-gray'
                    }`}>
                      {tip.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
