/**
 * Integrations Admin Page (read-only)
 */

import React, { useState, useEffect } from 'react';
import { adminApi, IntegrationConfig } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');

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

  if (status === 'loading') return <div>Carregando...</div>;
  if (status === 'error') return <div>Erro ao carregar</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>Integrações</h1>
      <p style={{ margin: '0 0 1.5rem', color: '#666' }}>
        Credenciais de integração são gerenciadas pelo Render. Use os links abaixo para editar.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
        }}
      >
        {integrations.map((integration) => (
          <IntegrationCard key={integration.key} integration={integration} />
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationConfig }) {
  const categoryColors: Record<string, string> = {
    ocr: '#0066cc',
    whatsapp: '#25c1a1',
    tipster: '#f59e0b',
    subscription: '#8b5cf6',
    storage: '#10b981',
    security: '#ef4444',
  };

  return (
    <div
      style={{
        background: '#fff',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{integration.label}</h3>
        <span
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            background: categoryColors[integration.category] || '#666',
            color: '#fff',
            borderRadius: '4px',
          }}
        >
          {integration.category}
        </span>
      </div>

      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#666' }}>
        {integration.description}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          fontSize: '0.875rem',
        }}
      >
        <span>{integration.configured ? '✅ Configurado' : '⚠️ Não configurado'}</span>
        {integration.masked_value && (
          <code
            style={{
              background: '#f5f5f5',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}
          >
            {integration.masked_value}
          </code>
        )}
      </div>

      {/* JWT_SECRET never shows masked_value - just show configured */}
      {integration.key === 'JWT_SECRET' && integration.configured && (
        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.75rem' }}>
          Valor oculto por segurança
        </div>
      )}

      <a
        href={integration.edit_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          background: '#0066cc',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
        }}
      >
        Editar no Render →
      </a>
    </div>
  );
}