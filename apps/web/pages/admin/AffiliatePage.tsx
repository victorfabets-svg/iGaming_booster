/**
 * Affiliate Admin Page — funnel analytics + houses CRUD + campaigns CRUD.
 * Three tabs share the same /admin/afiliados route.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  AffiliateCampaign,
  AffiliateCampaignCreateInput,
  AffiliateFunnelRow,
  AffiliateHouse,
  AffiliateHouseCreateInput,
  AffiliateHouseUpdateInput,
} from '../../services/admin-api';

type Tab = 'funnel' | 'houses' | 'campaigns';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function AffiliatePage() {
  const [tab, setTab] = useState<Tab>('funnel');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Afiliados</h1>
          <p className="page-subtitle">
            Funil de conversão, casas parceiras e campanhas de tracking.
          </p>
        </div>
      </div>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab-item ${tab === 'funnel' ? 'active' : ''}`}
          onClick={() => setTab('funnel')}
        >
          Funil
        </button>
        <button
          type="button"
          className={`tab-item ${tab === 'houses' ? 'active' : ''}`}
          onClick={() => setTab('houses')}
        >
          Casas
        </button>
        <button
          type="button"
          className={`tab-item ${tab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setTab('campaigns')}
        >
          Campanhas
        </button>
      </div>

      {tab === 'funnel' && <FunnelTab />}
      {tab === 'houses' && <HousesTab />}
      {tab === 'campaigns' && <CampaignsTab />}
    </div>
  );
}

// ============================================================================
// Funnel Tab
// ============================================================================

function FunnelTab() {
  const [from, setFrom] = useState(todayISO(-7));
  const [to, setTo] = useState(todayISO(0));
  const [house, setHouse] = useState<string>('');
  const [houses, setHouses] = useState<AffiliateHouse[]>([]);
  const [rows, setRows] = useState<AffiliateFunnelRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listAffiliateHouses().then(res => {
      if (res.success && res.data) setHouses(res.data.houses);
    });
  }, []);

  useEffect(() => {
    setStatus('loading');
    setErrorMsg(null);
    adminApi.getAffiliateFunnel({ from, to, house: house || undefined }).then(res => {
      if (res.success && res.data) {
        setRows(res.data.funnel);
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(res.error?.message || 'Erro desconhecido');
      }
    });
  }, [from, to, house]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        clicks: acc.clicks + r.clicks,
        registers: acc.registers + r.registers,
        first_proof: acc.first_proof + r.first_proof,
        approved: acc.approved + r.approved,
        rewards: acc.rewards + r.rewards,
      }),
      { clicks: 0, registers: 0, first_proof: 0, approved: 0, rewards: 0 }
    );
  }, [rows]);

  function pct(num: number, denom: number): string {
    if (!denom) return '—';
    return `${((num / denom) * 100).toFixed(1)}%`;
  }

  return (
    <div>
      <div className="filter-bar mb-4">
        <label className="text-xs uppercase text-secondary">
          De
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="text-xs uppercase text-secondary">
          Até
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label className="text-xs uppercase text-secondary">
          Casa
          <select value={house} onChange={e => setHouse(e.target.value)}>
            <option value="">Todas</option>
            {houses.map(h => (
              <option key={h.slug} value={h.slug}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="g-row mb-4">
        <div className="g-col-2-4">
          <KpiCard label="Cliques" value={totals.clicks} />
        </div>
        <div className="g-col-2-4">
          <KpiCard
            label="Cadastros"
            value={totals.registers}
            sub={`taxa ${pct(totals.registers, totals.clicks)}`}
          />
        </div>
        <div className="g-col-2-4">
          <KpiCard
            label="1ª Prova"
            value={totals.first_proof}
            sub={`taxa ${pct(totals.first_proof, totals.registers)}`}
          />
        </div>
        <div className="g-col-2-4">
          <KpiCard
            label="Aprovadas"
            value={totals.approved}
            sub={`taxa ${pct(totals.approved, totals.first_proof)}`}
          />
        </div>
      </div>

      <div className="card">
        {status === 'loading' && <div className="empty-state">Carregando funil…</div>}
        {status === 'error' && (
          <div className="alert-box alert-error">
            Erro ao carregar funil{errorMsg ? `: ${errorMsg}` : ''}.
          </div>
        )}
        {status === 'success' && rows.length === 0 && (
          <div className="empty-state">Sem dados no período selecionado.</div>
        )}
        {status === 'success' && rows.length > 0 && (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Casa</th>
                <th>Cliques</th>
                <th>Cadastros</th>
                <th>1ª Prova</th>
                <th>Aprovadas</th>
                <th>Recompensas</th>
                <th>Click→Cadastro</th>
                <th>Cadastro→Aprovada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.slug}>
                  <td>{r.name}</td>
                  <td className="mono">{r.clicks}</td>
                  <td className="mono">{r.registers}</td>
                  <td className="mono">{r.first_proof}</td>
                  <td className="mono">{r.approved}</td>
                  <td className="mono">{r.rewards}</td>
                  <td className="mono">{pct(r.registers, r.clicks)}</td>
                  <td className="mono">{pct(r.approved, r.registers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-secondary text-xs uppercase mb-2">{label}</p>
      <p className="kpi-value">{value}</p>
      {sub && <p className="text-muted text-xs mt-2">{sub}</p>}
    </div>
  );
}

// ============================================================================
// Houses Tab
// ============================================================================

function HousesTab() {
  const [houses, setHouses] = useState<AffiliateHouse[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AffiliateHouse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setStatus('loading');
    adminApi.listAffiliateHouses().then(res => {
      if (res.success && res.data) {
        setHouses(res.data.houses);
        setStatus('success');
      } else {
        setStatus('error');
      }
    });
  }
  useEffect(load, []);

  async function handleCreate(input: AffiliateHouseCreateInput) {
    setFormError(null);
    const res = await adminApi.createAffiliateHouse(input);
    if (res.success) {
      setShowModal(false);
      setEditing(null);
      load();
    } else {
      setFormError(res.error?.message || 'Erro ao criar casa');
    }
  }

  async function handleUpdate(slug: string, input: AffiliateHouseUpdateInput) {
    setFormError(null);
    const res = await adminApi.updateAffiliateHouse(slug, input);
    if (res.success) {
      setShowModal(false);
      setEditing(null);
      load();
    } else {
      setFormError(res.error?.message || 'Erro ao atualizar casa');
    }
  }

  async function handleToggleActive(house: AffiliateHouse) {
    const res = await adminApi.updateAffiliateHouse(house.slug, { active: !house.active });
    if (res.success) load();
  }

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error')
    return <div className="alert-box alert-error">Erro ao carregar casas.</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-secondary text-sm">
          {houses.length} casa{houses.length === 1 ? '' : 's'} cadastrada
          {houses.length === 1 ? '' : 's'}.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setFormError(null);
            setShowModal(true);
          }}
        >
          + Nova Casa
        </button>
      </div>

      <div className="card">
        {houses.length === 0 ? (
          <div className="empty-state">Nenhuma casa cadastrada.</div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Nome</th>
                <th>Domínio</th>
                <th>CPA (R$)</th>
                <th>RevShare</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {houses.map(h => (
                <tr key={h.id}>
                  <td className="mono">{h.slug}</td>
                  <td>{h.name}</td>
                  <td className="mono">{h.domain}</td>
                  <td className="mono">{h.cpa_brl.toFixed(2)}</td>
                  <td className="mono">{h.revshare_pct.toFixed(2)}%</td>
                  <td>
                    <span className={`badge ${h.active ? 'badge-success' : 'badge-gray'}`}>
                      {h.active ? 'ativa' : 'inativa'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => {
                        setEditing(h);
                        setFormError(null);
                        setShowModal(true);
                      }}
                    >
                      Editar
                    </button>
                    {' '}
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => handleToggleActive(h)}
                    >
                      {h.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <HouseModal
          house={editing}
          error={formError}
          onSave={(input, slug) => {
            if (slug) handleUpdate(slug, input);
            else handleCreate(input as AffiliateHouseCreateInput);
          }}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
            setFormError(null);
          }}
        />
      )}
    </div>
  );
}

function HouseModal({
  house,
  error,
  onSave,
  onClose,
}: {
  house: AffiliateHouse | null;
  error: string | null;
  onSave: (input: AffiliateHouseCreateInput | AffiliateHouseUpdateInput, slug?: string) => void;
  onClose: () => void;
}) {
  const editing = !!house;
  const [form, setForm] = useState({
    slug: house?.slug || '',
    name: house?.name || '',
    domain: house?.domain || '',
    base_url: house?.base_url || '',
    cpa_brl: house?.cpa_brl ?? 0,
    revshare_pct: house?.revshare_pct ?? 0,
    active: house?.active ?? false,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      const update: AffiliateHouseUpdateInput = {
        name: form.name,
        domain: form.domain,
        base_url: form.base_url,
        cpa_brl: Number(form.cpa_brl),
        revshare_pct: Number(form.revshare_pct),
        active: form.active,
      };
      onSave(update, house!.slug);
    } else {
      const create: AffiliateHouseCreateInput = {
        slug: form.slug,
        name: form.name,
        domain: form.domain,
        base_url: form.base_url,
        cpa_brl: Number(form.cpa_brl),
        revshare_pct: Number(form.revshare_pct),
        active: form.active,
      };
      onSave(create);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">{editing ? 'Editar Casa' : 'Nova Casa'}</h2>
        {error && <div className="alert-box alert-error mb-3">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Slug</label>
            <input
              className="input"
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
              required
              disabled={editing}
              placeholder="bet365"
            />
            {editing && (
              <p className="field-help">Slug não pode ser alterado após criação.</p>
            )}
          </div>
          <div className="field">
            <label>Nome</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Domínio</label>
            <input
              className="input"
              value={form.domain}
              onChange={e => setForm({ ...form, domain: e.target.value })}
              required
              placeholder="bet365.com"
            />
          </div>
          <div className="field">
            <label>URL base</label>
            <input
              className="input"
              type="url"
              value={form.base_url}
              onChange={e => setForm({ ...form, base_url: e.target.value })}
              required
              placeholder="https://www.bet365.com/"
            />
          </div>
          <div className="field">
            <label>CPA (R$)</label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={form.cpa_brl}
              onChange={e => setForm({ ...form, cpa_brl: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>RevShare (%)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.revshare_pct}
              onChange={e => setForm({ ...form, revshare_pct: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label className="flex items-center gap-2 uppercase-off">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
              />
              <span>Casa ativa (recebe cliques)</span>
            </label>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Campaigns Tab
// ============================================================================

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<AffiliateCampaign[]>([]);
  const [houses, setHouses] = useState<AffiliateHouse[]>([]);
  const [houseFilter, setHouseFilter] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function loadCampaigns() {
    setStatus('loading');
    adminApi.listAffiliateCampaigns(houseFilter || undefined).then(res => {
      if (res.success && res.data) {
        setCampaigns(res.data.campaigns);
        setStatus('success');
      } else {
        setStatus('error');
      }
    });
  }

  useEffect(() => {
    adminApi.listAffiliateHouses().then(res => {
      if (res.success && res.data) setHouses(res.data.houses);
    });
  }, []);

  useEffect(loadCampaigns, [houseFilter]);

  async function handleCreate(input: AffiliateCampaignCreateInput) {
    setFormError(null);
    const res = await adminApi.createAffiliateCampaign(input);
    if (res.success) {
      setShowModal(false);
      loadCampaigns();
    } else {
      setFormError(res.error?.message || 'Erro ao criar campanha');
    }
  }

  function buildLink(c: AffiliateCampaign) {
    return `${API_BASE}/r/c/${c.slug}`;
  }

  async function copyLink(c: AffiliateCampaign) {
    try {
      await navigator.clipboard.writeText(buildLink(c));
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard may be unavailable; ignore silently
    }
  }

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error')
    return <div className="alert-box alert-error">Erro ao carregar campanhas.</div>;

  return (
    <div>
      <div className="filter-bar mb-4">
        <label className="text-xs uppercase text-secondary">
          Casa
          <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)}>
            <option value="">Todas</option>
            {houses.map(h => (
              <option key={h.slug} value={h.slug}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex-1" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormError(null);
            setShowModal(true);
          }}
          disabled={houses.length === 0}
        >
          + Nova Campanha
        </button>
      </div>

      <div className="card">
        {campaigns.length === 0 ? (
          <div className="empty-state">
            {houseFilter
              ? 'Nenhuma campanha para esta casa.'
              : 'Nenhuma campanha cadastrada.'}
          </div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Casa</th>
                <th>Slug</th>
                <th>Label</th>
                <th>Link de tracking</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td className="mono">{c.redirect_house_slug || 'Signup'}</td>
                  <td className="mono">{c.slug}</td>
                  <td>{c.label || '—'}</td>
                  <td className="mono text-xs">{buildLink(c)}</td>
                  <td>
                    <button type="button" className="action-btn" onClick={() => copyLink(c)}>
                      {copiedId === c.id ? 'Copiado!' : 'Copiar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CampaignModal
          houses={houses}
          defaultHouseSlug={houseFilter || undefined}
          error={formError}
          onSave={handleCreate}
          onClose={() => {
            setShowModal(false);
            setFormError(null);
          }}
        />
      )}
    </div>
  );
}

function CampaignModal({
  houses,
  defaultHouseSlug,
  error,
  onSave,
  onClose,
}: {
  houses: AffiliateHouse[];
  defaultHouseSlug?: string;
  error: string | null;
  onSave: (input:AffiliateCampaignCreateInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    slug: '',
    label: '',
    owner_user_id: '',
    redirect_type: defaultHouseSlug ? 'house' : 'signup',
    redirect_house_slug: defaultHouseSlug || '',
    tagged_house_slugs: [] as string[],
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      alert('Slug deve ter apenas letras minúsculas, números e hifens.');
      return;
    }
    const input: AffiliateCampaignCreateInput = {
      slug: form.slug,
      label: form.label.trim() || undefined,
      owner_user_id: form.owner_user_id || undefined,
      redirect_house_slug: form.redirect_type === 'house' ? form.redirect_house_slug : undefined,
      tagged_house_slugs: form.tagged_house_slugs.length > 0 ? form.tagged_house_slugs : undefined,
    };
    onSave(input);
  }

  const toggleTagged = (slug: string) => {
    setForm(f => ({
      ...f,
      tagged_house_slugs: f.tagged_house_slugs.includes(slug)
        ? f.tagged_house_slugs.filter(s => s !== slug)
        : [...f.tagged_house_slugs, slug],
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">Nova Campanha</h2>
        {error && <div className="alert-box alert-error mb-3">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Slug</label>
            <input
              className="input"
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
              required
              placeholder="instagram-bio"
            />
            <p className="field-help">
              Link: <code className="mono">/r/c/{form.slug || '[slug]'}</code>
            </p>
          </div>
          <div className="field">
            <label>Label (opcional)</label>
            <input
              className="input"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="Bio do Instagram"
            />
          </div>
          <div className="field">
            <label>Dono (opcional)</label>
            <select
              className="input"
              value={form.owner_user_id}
              onChange={e => setForm({ ...form, owner_user_id: e.target.value })}
            >
              <option value="">Sem dono</option>
            </select>
          </div>
          <div className="field">
            <label>Tipo de redirect</label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="redirect_type"
                checked={form.redirect_type === 'signup'}
                onChange={() => setForm({ ...form, redirect_type: 'signup' })}
              />
              <span>Página de cadastro</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="redirect_type"
                checked={form.redirect_type === 'house'}
                onChange={() => setForm({ ...form, redirect_type: 'house' })}
              />
              <span>Casa específica</span>
            </label>
          </div>
          {form.redirect_type === 'house' && (
            <div className="field">
              <label>Casa de redirect</label>
              <select
                className="input"
                value={form.redirect_house_slug}
                onChange={e => setForm({ ...form, redirect_house_slug: e.target.value })}
              >
                <option value="">Selecione...</option>
                {houses.map(h => (
                  <option key={h.slug} value={h.slug}>
                    {h.name} ({h.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Casas tagueadas (opcional)</label>
            <div className="flex flex-wrap gap-1">
              {houses.map(h => (
                <label key={h.slug} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={form.tagged_house_slugs.includes(h.slug)}
                    onChange={() => toggleTagged(h.slug)}
                  />
                  <span>{h.slug}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="btn btn-primary">
              Criar
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
