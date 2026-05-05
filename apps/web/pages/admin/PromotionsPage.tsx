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
    creative_type: (promotion?.creative_type || 'image') as 'image' | 'video',
    cta_label: promotion?.cta_label || '',
    cta_url: promotion?.cta_url || '',
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

  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleCreativeUpload = async (file: File | null) => {
    if (!file) return;
    setLocalError(null);
    setUploading(true);
    try {
      const res = await adminApi.uploadPromotionCreative(file);
      if (!res.success || !res.data) {
        setLocalError(res.error?.message || 'Falha no upload.');
        return;
      }
      setForm(f => ({
        ...f,
        creative_url: res.data!.url,
        creative_type: res.data!.creative_type,
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Date sanity in PT-BR before sending — backend re-checks the same
    // invariants but its message is in English (e.g. "draw_at must be
    // >= ends_at"); duplicate the check here so the operator gets a
    // clear, localised message and never reaches that branch.
    const startsAt = form.starts_at ? new Date(form.starts_at) : null;
    const endsAt = form.ends_at ? new Date(form.ends_at) : null;
    const drawAt = form.draw_at ? new Date(form.draw_at) : null;

    if (!startsAt || !endsAt || !drawAt) {
      setLocalError('Preencha início, fim e data do sorteio.');
      return;
    }
    if (endsAt < startsAt) {
      setLocalError('A data de fim precisa ser igual ou posterior à de início.');
      return;
    }
    if (drawAt < endsAt) {
      setLocalError('A data do sorteio precisa ser igual ou posterior ao fim da promoção (o sorteio acontece quando a promoção termina).');
      return;
    }

    const baseInput = {
      name: form.name,
      description: form.description || undefined,
      creative_url: form.creative_url || undefined,
      creative_type: form.creative_type,
      cta_label: form.cta_label.trim() || undefined,
      cta_url: form.cta_url.trim() || undefined,
      house_slug: form.house_slug,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      draw_at: drawAt.toISOString(),
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
        {(localError || error) && <div className="alert-box alert-error mb-3">{localError || error}</div>}
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
            <label>Criatividade (imagem ou vídeo)</label>
            <input
              type="file"
              className="input"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              disabled={uploading}
              onChange={e => handleCreativeUpload(e.target.files?.[0] ?? null)}
            />
            <p className="text-muted text-xs" style={{ marginTop: 4 }}>
              JPG, PNG, WEBP, GIF, MP4, WEBM ou MOV — até 10MB. {uploading ? 'Enviando…' : 'O arquivo é enviado direto para o R2.'}
            </p>
            {form.creative_url && (
              <div style={{ marginTop: 8 }}>
                {form.creative_type === 'video' ? (
                  <video src={form.creative_url} muted playsInline controls style={{ maxWidth: 240, borderRadius: 6 }} />
                ) : (
                  <img src={form.creative_url} alt="Pré-visualização" style={{ maxWidth: 240, borderRadius: 6 }} />
                )}
                <div className="text-muted text-xs mono" style={{ wordBreak: 'break-all', marginTop: 4 }}>{form.creative_url}</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 4 }}
                  onClick={() => setForm(f => ({ ...f, creative_url: '' }))}
                >
                  Remover
                </button>
              </div>
            )}
          </div>
          <div className="field">
            <label>Tipo da Criatividade</label>
            <select
              className="input"
              value={form.creative_type}
              onChange={e => setForm({ ...form, creative_type: e.target.value as 'image' | 'video' })}
            >
              <option value="image">Imagem</option>
              <option value="video">Vídeo (sem áudio)</option>
            </select>
            <p className="text-muted text-xs" style={{ marginTop: 4 }}>
              Detectado automaticamente no upload. Ajuste manualmente apenas se usar URL externa.
            </p>
          </div>
          <div className="field">
            <label>URL externa da Criatividade (opcional)</label>
            <input
              className="input"
              type="url"
              placeholder="https://...mp4 ou https://...jpg (apenas se não for usar upload)"
              value={form.creative_url}
              onChange={e => setForm({ ...form, creative_url: e.target.value })}
            />
            <p className="text-muted text-xs" style={{ marginTop: 4 }}>
              Use apenas se já hospedar o criativo em CDN próprio (Cloudflare, Vercel Blob, etc). O upload acima preenche este campo automaticamente.
            </p>
          </div>
          <div className="field">
            <label>Texto do Botão (CTA)</label>
            <input
              className="input"
              type="text"
              placeholder='Ex: "Participar agora", "Falar no WhatsApp"'
              value={form.cta_label}
              onChange={e => setForm({ ...form, cta_label: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Link do Botão (CTA)</label>
            <input
              className="input"
              type="text"
              placeholder="https://wa.me/..., https://casa.com/deposit, /me"
              value={form.cta_url}
              onChange={e => setForm({ ...form, cta_url: e.target.value })}
            />
            <p className="text-muted text-xs" style={{ marginTop: 4 }}>
              Aceita link absoluto (https://…) ou caminho interno (/…). Deixe ambos vazios para usar o fluxo padrão de cadastro.
            </p>
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
            <input
              className="input"
              type="datetime-local"
              value={form.starts_at}
              onChange={e => {
                const v = e.target.value;
                setForm(f => ({
                  ...f,
                  starts_at: v,
                  // If ends_at falls behind starts_at, push it forward; same for draw_at.
                  ends_at: f.ends_at && f.ends_at < v ? v : f.ends_at,
                  draw_at: f.draw_at && f.draw_at < v ? v : f.draw_at,
                }));
              }}
              required
            />
          </div>
          <div className="field">
            <label>Fim</label>
            <input
              className="input"
              type="datetime-local"
              min={form.starts_at || undefined}
              value={form.ends_at}
              onChange={e => {
                const v = e.target.value;
                setForm(f => ({
                  ...f,
                  ends_at: v,
                  // Draw must be >= ends; if it slipped, snap forward.
                  draw_at: f.draw_at && f.draw_at < v ? v : f.draw_at,
                }));
              }}
              required
            />
            <p className="text-muted text-xs" style={{ marginTop: 4 }}>
              Quando a promoção encerra para receber depósitos.
            </p>
          </div>
          <div className="field">
            <label>Data do Sorteio</label>
            <input
              className="input"
              type="datetime-local"
              min={form.ends_at || form.starts_at || undefined}
              value={form.draw_at}
              onChange={e => setForm({ ...form, draw_at: e.target.value })}
              required
            />
            <p className="text-muted text-xs" style={{ marginTop: 4 }}>
              Quando o sorteio será executado — precisa ser igual ou posterior ao fim.
            </p>
          </div>
          <div className="field">
            <label>Tiers</label>
            <div className="tier-row tier-row-header">
              <span>Depósito mínimo (R$)</span>
              <span>Cotas</span>
              <span />
            </div>
            {form.tiers.map((tier, idx) => (
              <div key={idx} className="tier-row mb-2">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={(tier.min_deposit_cents / 100).toFixed(2)}
                  onChange={e => updateTier(idx, 'min_deposit_cents', Math.round(Number(e.target.value.replace(',', '.')) * 100))}
                />
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Cotas"
                  value={tier.tickets}
                  onChange={e => updateTier(idx, 'tickets', parseInt(e.target.value, 10) || 1)}
                />
                <button
                  type="button"
                  className="btn btn-ghost tier-remove"
                  onClick={() => removeTier(idx)}
                  aria-label="Remover tier"
                >×</button>
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
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Enviando arquivo…' : 'Salvar'}
            </button>
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