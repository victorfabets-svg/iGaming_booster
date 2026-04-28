/**
 * Tips Admin Page
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Tip, TipFilters } from '../../services/admin-api';

export default function TipsPage() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [filter, setFilter] = useState<TipFilters>({});

  useEffect(() => {
    loadTips();
  }, [filter]);

  async function loadTips() {
    setStatus('loading');
    const response = await adminApi.listTips(filter);
    if (response.success && response.data) {
      setTips(response.data.tips);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  if (status === 'loading') return <div className="loading-state">Carregando...</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar</div>;

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Tips</h1>
      
      <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
        <select className="input" style={{ width: 'auto' }} onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}>
          <option value="">Todos</option>
          <option value="pending">Pending</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      <div className="card">
        {tips.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Nenhuma tip encontrada.</p>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Casa</th>
                <th>Mercado</th>
                <th>Pick</th>
                <th>Odds</th>
                <th>Status</th>
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
                      tip.result === 'lost' ? 'badge-error' : 'badge-warning'
                    }`}>
                      {tip.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
