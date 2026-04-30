/**
 * Partner Houses Admin Page — canonical houses management.
 * Now using core.houses (canonical source).
 */

import React, { useState, useEffect } from 'react';
import { adminApi, CoreHouse, CoreHouseCreateInput, CoreHouseUpdateInput } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function PartnerHousesPage() {
  const [houses, setHouses] = useState<CoreHouse[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [showModal, setShowModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState<CoreHouse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => { loadHouses(); }, []);

  async function loadHouses() {
    setStatus('loading');
    const response = await adminApi.listCoreHouses();
    if (response.success && response.data) {
      setHouses(response.data.houses);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  async function handleSave(input: CoreHouseCreateInput | CoreHouseUpdateInput) {
    setFormError(null);
    let response;
    if (editingHouse) {
      response = await adminApi.updateCoreHouse(editingHouse.slug, input as CoreHouseUpdateInput);
    } else {
      response = await adminApi.createCoreHouse(input as CoreHouseCreateInput);
    }
    if (response.success) {
      setShowModal(false);
      setEditingHouse(null);
      loadHouses();
    } else {
      setFormError(response.error?.message || 'Erro ao salvar casa.');
    }
  }

  const handleEdit = (house: CoreHouse) => {
    setEditingHouse(house);
    setFormError(null);
    setShowModal(true);
  };

  async function handleDelete(house: CoreHouse) {
    const confirmed = window.confirm(
      `Excluir definitivamente a casa "${house.name}" (${house.slug})?\n\nA ação será bloqueada se a casa estiver em uso por afiliado, OCR ou promoção.`
    );
    if (!confirmed) return;
    setDeleteError(null);
    const response = await adminApi.deleteCoreHouse(house.slug);
    if (response.success) {
      loadHouses();
    } else {
      setDeleteError(response.error?.message || 'Erro ao excluir casa.');
    }
  }

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar casas.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Casas Parceiras</h1>
          <p className="page-subtitle">Cadastro canônico das casas de aposta — tickets/depósito agora ficam por promoção.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setEditingHouse(null); setFormError(null); setShowModal(true); }}
        >
          + Nova Casa
        </button>
      </div>

      {deleteError && (
        <div className="alert-box alert-error mb-3">{deleteError}</div>
      )}

      <div className="card">
        {houses.length === 0 ? (
          <div className="empty-state">Nenhuma casa cadastrada ainda.</div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Nome</th>
                <th>País</th>
                <th>Moeda</th>
                <th>Deposit URL</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {houses.map(house => (
                <tr key={house.id}>
                  <td className="mono">{house.slug}</td>
                  <td>{house.name}</td>
                  <td>{house.country}</td>
                  <td>{house.currency}</td>
                  <td className="mono">{house.deposit_url.length > 30 ? house.deposit_url.slice(0, 30) + '…' : house.deposit_url}</td>
                  <td>
                    <span className={`badge ${house.active ? 'badge-success' : 'badge-gray'}`}>
                      {house.active ? 'ativa' : 'inativa'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="action-btn" onClick={() => handleEdit(house)}>
                      Editar
                    </button>
                    {' '}
                    <button type="button" className="action-btn" onClick={() => handleDelete(house)}>
                      Excluir
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
          house={editingHouse}
          error={formError}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingHouse(null); setFormError(null); }}
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
  house: CoreHouse | null;
  error: string | null;
  onSave: (input: CoreHouseCreateInput | CoreHouseUpdateInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    slug: house?.slug || '',
    name: house?.name || '',
    country: house?.country || 'BR',
    currency: house?.currency || 'BRL',
    deposit_url: house?.deposit_url || '',
    signup_url: house?.signup_url || '',
    active: house?.active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      slug: form.slug,
      name: form.name,
      country: form.country,
      currency: form.currency,
      deposit_url: form.deposit_url,
      signup_url: form.signup_url || undefined,
      active: form.active,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">{house ? 'Editar Casa' : 'Nova Casa'}</h2>
        {error && <div className="alert-box alert-error mb-3">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Slug</label>
            <input
              className="input"
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
              required
              disabled={!!house}
            />
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
            <label>País</label>
            <input
              className="input"
              value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value.toUpperCase() })}
              required
              maxLength={2}
            />
          </div>
          <div className="field">
            <label>Moeda</label>
            <input
              className="input"
              value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              required
              maxLength={3}
            />
          </div>
          <div className="field">
            <label>Deposit URL</label>
            <input
              className="input"
              type="url"
              value={form.deposit_url}
              onChange={e => setForm({ ...form, deposit_url: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Signup URL (opcional)</label>
            <input
              className="input"
              type="url"
              value={form.signup_url}
              onChange={e => setForm({ ...form, signup_url: e.target.value })}
            />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
              />
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
