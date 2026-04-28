/**
 * Integrations Admin Page (read-only)
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState, useEffect } from 'react';
import { adminApi, IntegrationConfig } from '../../services/admin-api';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    setStatus('loading');
    const response = await adminApi.listIntegrations();
    if (response.success && response.data) {
      setIntegrations(response.data.integrations);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  if (status === 'loading') return <div className="loading-state">Carregando...</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrações</h1>
          <p className="page-subtitle">
            Credenciais são gerenciadas pelo Render. Use os links abaixo para editar.
          </p>
        </div>
      </div>

      <div className="g-row">
        {integrations.map(integration => (
          <div key={integration.key} className="g-col-4">
            <IntegrationCard integration={integration} />
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationConfig }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h3 className="card-title-sm">{integration.label}</h3>
        <span className={`badge badge-${integration.configured ? 'success' : 'gray'}`}>
          {integration.configured ? 'configurado' : 'não configurado'}
        </span>
      </div>
      <p className="text-secondary text-sm mb-2">{integration.description}</p>
      {integration.masked_value && (
        <p className="mono text-muted text-xs mb-2">{integration.masked_value}</p>
      )}
      <p className="text-muted text-xs mono">{integration.key}</p>
      <a href={integration.edit_url} target="_blank" rel="noopener noreferrer" className="btn-link">
        Editar no Render →
      </a>
    </div>
  );
}
