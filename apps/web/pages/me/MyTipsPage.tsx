/**
 * MyTipsPage - User tips view
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useEffect, useState } from 'react';
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
      <div className="card auth-card text-center">
        <h1 className="card-title mb-3">Tips Bloqueadas</h1>
        <div className="alert-box alert-warning">
          Você precisa de uma assinatura ativa para ver os tips.
        </div>
      </div>
    );
  }

  if (tips.length === 0) {
    return (
      <div className="card empty-state">Nenhuma tip disponível no momento.</div>
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
                <th>Odds</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tips.map(tip => (
                <tr key={tip.id}>
                  <td>{tip.house}</td>
                  <td>{tip.market}</td>
                  <td className="mono">{tip.odds}</td>
                  <td>
                    <span className={`badge ${
                      tip.status === 'won' ? 'badge-success' :
                      tip.status === 'lost' ? 'badge-error' :
                      tip.status === 'pending' ? 'badge-warning' : 'badge-gray'
                    }`}>
                      {tip.status}
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
