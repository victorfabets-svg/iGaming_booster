/**
 * Tips Admin Page
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Tip } from '../../services/admin-api';

type TipStatusFilter = 'pending' | 'won' | 'lost' | 'void' | '';

export default function TipsPage() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [filter, setFilter] = useState<{ status?: TipStatusFilter }>({});

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
        <select className="input" style={{ width: 'auto' }} onChange={(e) => setFilter({ ...filter, status: (e.target.value as TipStatusFilter) || undefined })}>
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
                <th>External ID</th>
                <th>Casa</th>
                <th>Odds</th>
                <th>Status</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {tips.map(tip => (
                <tr key={tip.id}>
                  <td className="mono">{tip.external_id}</td>
                  <td>{tip.house_slug}</td>
                  <td className="mono">{tip.odds ?? '—'}</td>
                  <td>
                    <span className={`badge ${
                      tip.status === 'won' ? 'badge-success' :
                      tip.status === 'lost' ? 'badge-error' :
                      tip.status === 'pending' ? 'badge-warning' : 'badge-gray'
                    }`}>
                      {tip.status}
                    </span>
                  </td>
                  <td className="mono">{new Date(tip.created_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
