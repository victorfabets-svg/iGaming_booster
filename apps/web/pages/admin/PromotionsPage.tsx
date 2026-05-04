/**
 * Promotions Admin Page — CRUD for promotions, tiers, and repescagem functionality.
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Promotion, PromotionCreateInput, PromotionUpdateInput, CoreHouse, PromotionTier } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [houses, setHouses] = useState<CoreHouse[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showRepescagemModal, setShowRepescagemModal] = useState(false);
  const [repescagemTarget, setRepescagemTarget] = useState<Promotion | null>(null);
  const [repescagemLoading, setRepescagemLoading] = useState(false);
  const [repescagemResult, setRepescagemResult] = useState<{ count: number; date: string } | null>(null);
  const [featurePending, setFeaturePending] = useState<string | null>(null);
  const [featureConfirm, setFeatureConfirm] = useState<{ target: Promotion; current: Promotion } | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setStatus('loading');
    const [promosRes, housesRes] = await Promise.all([
      adminApi.listPromotions(),
      adminApi.listCoreHouses(),
    ]);
    if (promosRes.success && promosRes.data && housesRes.success && housesRes.data) {
      setPromotions(promosRes.data.promotions);
      setHouses(housesRes.data.houses);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  async function handleSave(input: PromotionCreateInput | PromotionUpdateInput) {
    setFormError(null);
    let response;
    if (editingPromotion) {
      response = await adminApi.updatePromotion(editingPromotion.slug, input as PromotionUpdateInput);
    } else {
      response = await adminApi.createPromotion(input as PromotionCreateInput);
    }
    if (response.success) {
      setShowModal(false);
      setEditingPromotion(null);
      loadData();
    } else {
      setFormError(response.error?.message || 'Erro ao salvar promoção.');
    }
  }

  const handleEdit = (promo: Promotion) => {
    setEditingPromotion(promo);
    setFormError(null);
    setShowModal(true);
  };

  const handleToggleFeatured = (promo: Promotion) => {
    if (promo.is_featured) {
      void applyFeatured(promo.slug, false);
      return;
    }
    const current = promotions.find(p => p.is_featured && p.id !== promo.id);
    if (current) {
      setFeatureConfirm({ target: promo, current });
      return;
    }
    void applyFeatured(promo.slug, true);
  };

  const applyFeatured = async (slug: string, featured: boolean) => {
    setFeaturePending(slug);
    try {
      const res = await adminApi.setPromotionFeatured(slug, featured);
      if (res.success) {
        setFeatureConfirm(null);
        loadData();
      } else {
        setFormError(res.error?.message || 'Erro ao alterar destaque.');
      }
    } finally {
      setFeaturePending(null);
    }
  };

  const handleApplyRepescagem = async (promo: Promotion) => {
    setRepescagemTarget(promo);
    setShowRepescagemModal(true);
    setRepescagemLoading(true);
    setRepescagemResult(null);
    try {
      const result = await adminApi.applyRepescagem(promo.slug);
      if (result.success && result.data) {
        setRepescagemResult({
          count: result.data.invitations_created,
          date: result.data.applied_at,
        });
        loadData();
      } else {
        setFormError(result.error?.message || 'Erro ao aplicar repescagem.');
      }
    } finally {
      setRepescagemLoading(false);
    }
  };

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar promoções.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Promoções</h1>
          <p className="page-subtitle">Gerencie promoções, tiers e repescagem.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setEditingPromotion(null); setFormError(null); setShowModal(true); }}>
          + Nova Promoção
        </button>
      </div>

      <div className="card">
        {promotions.length === 0 ? (
          <div className="empty-state">Nenhuma promoção cadastrada ainda.</div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Casa</th>
                <th>Período</th>
                <th>Sorteio</th>
                <th>Repescagem</th>
                <th>Tiers</th>
                <th>Status</th>
                <th>Destaque</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => (
                <tr key={promo.id}>
                  <td>{promo.name}</td>
                  <td>{promo.house_name}</td>
                  <td className="mono">
                    {new Date(promo.starts_at).toLocaleDateString('pt-BR')} → {new Date(promo.ends_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="mono">{new Date(promo.draw_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    {promo.repescagem ? (
                      promo.repescagem_applied_at ? (
                        <span className="badge badge-gray">aplicada {new Date(promo.repescagem_applied_at).toLocaleDateString('pt-BR')}</span>
                      ) : (
                        <span className="badge badge-warning">ativa</span>
                      )
                    ) : (
                      <span className="badge badge-gray">—</span>
                    )}
                  </td>
                  <td className="mono">{promo.tiers.length}</td>
                  <td>
                    <span className={`badge ${promo.active ? 'badge-success' : 'badge-gray'}`}>
                      {promo.active ? 'ativa' : 'inativa'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`action-btn ${promo.is_featured ? 'is-featured' : ''}`}
                      disabled={featurePending === promo.slug || (!promo.active && !promo.is_featured)}
                      title={promo.is_featured ? 'Promoção em destaque na landing' : !promo.active ? 'Ative a promoção antes de destacar' : 'Marcar como destaque'}
                      onClick={() => handleToggleFeatured(promo)}
                    >
                      {promo.is_featured ? '★ destacada' : '☆ destacar'}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="action-btn" onClick={() => handleEdit(promo)}>Editar</button>
                    {promo.repescagem && !promo.repescagem_applied_at && (
                      <button type="button" className="action-btn" onClick={() => handleApplyRepescagem(promo)}>Aplicar repescagem</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <PromotionModal
          promotion={editingPromotion}
          houses={houses}
          error={formError}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingPromotion(null); setFormError(null); }}
        />
      )}

      {featureConfirm && (
        <div className="modal-overlay" onClick={() => setFeatureConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="card-title mb-4">Substituir promoção em destaque?</h2>
            <p className="mb-4">
              <strong>{featureConfirm.current.name}</strong> está atualmente em destaque na landing.
              Marcar <strong>{featureConfirm.target.name}</strong> vai removê-la imediatamente.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={featurePending !== null}
                onClick={() => applyFeatured(featureConfirm.target.slug, true)}
              >
                {featurePending ? 'Aplicando…' : 'Substituir'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setFeatureConfirm(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showRepescagemModal && (
        <RepescagemModal
          promotion={repescagemTarget}
          loading={repescagemLoading}
          result={repescagemResult}
          onConfirm={handleApplyRepescagem}
          onClose={() => { setShowRepescagemModal(false); setRepescagemTarget(null); setRepescagemResult(null); }}
        />
      )}
    </div>
  );
}

function PromotionModal({
  promotion,
  houses,
  error,
  onSave,
  onClose,
}: {
  promotion: Promotion | null;
  houses: CoreHouse[];
  error: string | null;
  onSave: (input: PromotionCreateInput | PromotionUpdateInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    slug: promotion?.slug || '',
    name: promotion?.name || '',
    description: promotion?.description || '',
    creative_url: promotion?.creative_url || '',
    house_slug: promotion?.house_slug || (houses.length > 0 ? houses[0].slug : ''),
    prize: '',
    total_numbers: 1000,
    starts_at: promotion?.starts_at ? new Date(promotion.starts_at).toISOString().slice(0, 16) : '',
    ends_at: promotion?.ends_at ? new Date(promotion.ends_at).toISOString().slice(0, 16) : '',
    draw_at: promotion?.draw_at ? new Date(promotion.draw_at).toISOString().slice(0, 16) : '',
    tiers: promotion?.tiers || [{ min_deposit_cents: 10000, tickets: 1 }],
    repescagem_source_slugs: promotion?.repescagem_source_slugs || [],
    repescagem_enabled: promotion?.repescagem || false,
    active: promotion?.active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [startsDate, startsTime] = form.starts_at.split('T');
    const [endsDate, endsTime] = form.ends_at.split('T');
    const [drawDate, drawTime] = form.draw_at.split('T');

    const baseInput = {
      name: form.name,
      description: form.description || undefined,
      creative_url: form.creative_url || undefined,
      house_slug: form.house_slug,
      starts_at: new Date(`${startsDate}T${startsTime}`).toISOString(),
      ends_at: new Date(`${endsDate}T${endsTime}`).toISOString(),
      draw_at: new Date(`${drawDate}T${drawTime}`).toISOString(),
      tiers: form.tiers,
      repescagem_source_slugs: form.repescagem_enabled ? form.repescagem_source_slugs : undefined,
      active: form.active,
    };

    if (promotion) {
      // Edit: raffle is immutable, can't change prize/total_numbers
      onSave(baseInput as PromotionUpdateInput);
    } else {
      const createInput: PromotionCreateInput = {
        ...baseInput,
        slug: form.slug,
        prize: form.prize,
        total_numbers: form.total_numbers,
      };
      onSave(createInput);
    }
  };

  const addTier = () => {
    setForm({ ...form, tiers: [...form.tiers, { min_deposit_cents: 0, tickets: 1 }] });
  };

  const removeTier = (index: number) => {
    const newTiers = form.tiers.filter((_, i) => i !== index);
    setForm({ ...form, tiers: newTiers });
  };

  const updateTier = (index: number, field: 'min_deposit_cents' | 'tickets', value: number) => {
    const newTiers = [...form.tiers];
    newTiers[index][field] = value;
    setForm({ ...form, tiers: newTiers });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">{promotion ? 'Editar Promoção' : 'Nova Promoção'}</h2>
        {error && <div className="alert-box alert-error mb-3">{error}</div>}
        <form onSubmit={handleSubmit}>
          {!promotion && (
            <div className="field">
              <label>Slug</label>
              <input className="input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} required />
            </div>
          )}
          <div className="field">
            <label>Nome</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Descrição</label>
            <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label>URL da Criatividade</label>
            <input className="input" type="url" value={form.creative_url} onChange={e => setForm({ ...form, creative_url: e.target.value })} />
          </div>
          <div className="field">
            <label>Casa</label>
            <select className="input" value={form.house_slug} onChange={e => setForm({ ...form, house_slug: e.target.value })} required>
              <option value="">Selecione...</option>
              {houses.map(h => <option key={h.id} value={h.slug}>{h.name}</option>)}
            </select>
          </div>
          {!promotion && (
            <>
              <div className="field">
                <label>Prêmio</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Ex: Hilux SRX 2026 Zero KM"
                  value={form.prize}
                  onChange={e => setForm({ ...form, prize: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Total de Cotas</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={form.total_numbers}
                  onChange={e => setForm({ ...form, total_numbers: Math.max(1, parseInt(e.target.value, 10) || 0) })}
                  required
                />
              </div>
            </>
          )}
          <div className="field">
            <label>Início</label>
            <input className="input" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required />
          </div>
          <div className="field">
            <label>Fim</label>
            <input className="input" type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} required />
          </div>
          <div className="field">
            <label>Data do Sorteio</label>
            <input className="input" type="datetime-local" value={form.draw_at} onChange={e => setForm({ ...form, draw_at: e.target.value })} required />
          </div>
          <div className="field">
            <label>Tiers</label>
            {form.tiers.map((tier, idx) => (
              <div key={idx} className="g-row g-col-2-4 mb-2">
                <input className="input" type="number" placeholder="Mín. R$" value={(tier.min_deposit_cents / 100).toFixed(2)} onChange={e => updateTier(idx, 'min_deposit_cents', Math.round(Number(e.target.value.replace(',', '.')) * 100))} />
                <input className="input" type="number" placeholder="Tickets" value={tier.tickets} onChange={e => updateTier(idx, 'tickets', parseInt(e.target.value, 10))} />
                <button type="button" className="btn btn-ghost" onClick={() => removeTier(idx)}>×</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={addTier}>+ adicionar tier</button>
          </div>
          <div className="field">
            <label>
              <input type="checkbox" checked={form.repescagem_enabled} onChange={e => setForm({ ...form, repescagem_enabled: e.target.checked, repescagem_source_slugs: e.target.checked ? form.repescagem_source_slugs : [] })} />
              {' '}Habilitar repescagem
            </label>
          </div>
          <div className="field">
            <label>
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              {' '}Ativa
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary">Salvar</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RepescagemModal({
  promotion,
  loading,
  result,
  onConfirm,
  onClose,
}: {
  promotion: Promotion | null;
  loading: boolean;
  result: { count: number; date: string } | null;
  onConfirm: (promo: Promotion) => void;
  onClose: () => void;
}) {
  if (!promotion) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">Aplicar Repescagem</h2>
        <p className="mb-4">Esta ação vai emitir novo ticket para todos os usuários que se cadastraram em promoção anterior. A ação não pode ser revertida. Tem certeza que deseja prosseguir?</p>
        {result && <div className="alert-box alert-success mb-3">{result.count} convites criados em {new Date(result.date).toLocaleString('pt-BR')}</div>}
        <div className="flex gap-2">
          {result ? (
            <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" disabled={loading} onClick={() => onConfirm(promotion)}>{loading ? 'Aplicando...' : 'SIM'}</button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>NÃO</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}