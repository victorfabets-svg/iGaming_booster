/**
 * Affiliate Campaigns Page — list my campaigns.
 */

import React, { useState, useEffect } from 'react';
import { affiliateApi, MyCampaign } from '../../services/affiliate-api';

type PageStatus = 'loading' | 'success' | 'error';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function AffiliateCampaignsPage() {
  const [campaigns, setCampaigns] = useState<MyCampaign[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setStatus('loading');
    const response = await affiliateApi.getMyCampaigns();
    if (response.success && response.data) {
      setCampaigns(response.data.campaigns);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  const copyLink = async (slug: string) => {
    const url = `${API_BASE}/r/c/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback(slug);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyFeedback(slug);
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar campanhas.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Minhas Campanhas</h1>
          <p className="page-subtitle">Suas campanhas de afiliado.</p>
        </div>
      </div>

      <div className="card">
        {campaigns.length === 0 ? (
          <div className="empty-state">
            Você ainda não tem campanhas. Solicite ao admin.
          </div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Label</th>
                <th>Destino</th>
                <th>Casas Tagueadas</th>
                <th>Criada em</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(campaign => (
                <tr key={campaign.id}>
                  <td className="mono">{campaign.slug}</td>
                  <td>{campaign.label || '—'}</td>
                  <td>
                    {campaign.redirect_house_slug || 'Cadastro'}
                  </td>
                  <td>
                    {campaign.tagged_house_slugs.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {campaign.tagged_house_slugs.map(slug => (
                          <span key={slug} className="badge badge-gray">{slug}</span>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="mono">
                    {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => copyLink(campaign.slug)}
                    >
                      {copyFeedback === campaign.slug ? 'Copiado!' : 'Copiar'}
                    </button>
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