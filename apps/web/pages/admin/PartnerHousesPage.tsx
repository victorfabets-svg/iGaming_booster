/**
 * Partner Houses Admin Page — list, create/edit casas parceiras + ticket-ratio config.
 */

import React, { useState, useEffect } from 'react';
import { adminApi, PartnerHouse, PartnerHouseInput } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function PartnerHousesPage() {
  const [houses, setHouses] = useState<PartnerHouse[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [showModal, setShowModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState<PartnerHouse | null>(null);

  useEffect(() => { loadHouses(); }, []);

  async function loadHouses() {
    setStatus('loading');
    const response = await adminApi.listPartnerHouses();
    if (response.success && response.data) {
      setHouses(response.data.houses);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  async function handleSave(input: PartnerHouseInput) {
    const response = await adminApi.createPartnerHouse(input);
    if (response.success) {
      setShowModal(false);
      setEditingHouse(null);
      loadHouses();
    }
  }

  const handleEdit = (house: PartnerHouse) => {
    setEditingHouse(house);
    setShowModal(true);
  };

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar casas parceiras.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Casas Parceiras</h1>
          <p className="page-subtitle">Configure casas, regras de OCR e taxa de tickets por depósito.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setEditingHouse(null); setShowModal(true); }}
        >
          + Nova Casa
        </button>
      </div>

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
                <th>Tickets/depósito</th>
                <th>Mín. R$/ticket</th>
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
                  <td className="mono">{house.tickets_per_deposit}</td>
                  <td className="mono">
                    {house.min_amount_per_ticket_cents != null
                      ? `R$ ${(house.min_amount_per_ticket_cents / 100).toFixed(2)}`
                      : '—'}
                  </td>
                  <td>
                    <span className={`badge ${house.active ? 'badge-success' : 'badge-gray'}`}>
                      {house.active ? 'ativa' : 'inativa'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="action-btn" onClick={() => handleEdit(house)}>
                      Editar
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
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingHouse(null); }}
        />
      )}
    </div>
  );
}

function HouseModal({
  house,
  onSave,
  onClose,
}: {
  house: PartnerHouse | null;
  onSave: (input: PartnerHouseInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    slug: house?.slug || '',
    name: house?.name || '',
    country: house?.country || '',
    currency: house?.currency || '',
    active: house?.active ?? true,
    tickets_per_deposit: house?.tickets_per_deposit ?? 1,
    min_amount_per_ticket_brl:
      house?.min_amount_per_ticket_cents != null
        ? (house.min_amount_per_ticket_cents / 100).toFixed(2)
        : '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const minBrlTrimmed = form.min_amount_per_ticket_brl.trim();
    const minCents =
      minBrlTrimmed === ''
        ? null
        : Math.round(Number(minBrlTrimmed.replace(',', '.')) * 100);
    onSave({
      slug: form.slug,
      name: form.name,
      country: form.country,
      currency: form.currency,
      active: form.active,
      tickets_per_deposit: form.tickets_per_deposit,
      min_amount_per_ticket_cents: minCents,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">{house ? 'Editar Casa' : 'Nova Casa'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Slug</label>
            <input
              className="input"
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
              required
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
            <label>País (2 letras)</label>
            <input
              className="input"
              value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value.toUpperCase() })}
              required
              maxLength={2}
            />
          </div>

          <div className="field">
            <label>Moeda (3 letras)</label>
            <input
              className="input"
              value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              required
              maxLength={3}
            />
          </div>

          <div className="field">
            <label>Tickets por depósito</label>
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              value={form.tickets_per_deposit}
              onChange={e => setForm({ ...form, tickets_per_deposit: Math.max(1, Number(e.target.value) || 1) })}
              required
            />
          </div>

          <div className="field">
            <label>Valor mínimo por ticket (R$)</label>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="(opcional — vazio = 1 ticket por depósito)"
              value={form.min_amount_per_ticket_brl}
              onChange={e => setForm({ ...form, min_amount_per_ticket_brl: e.target.value })}
            />
            <p className="field-help">
              Se preenchido, gera <code className="mono">floor(valor / mínimo) × tickets/depósito</code> tickets (mínimo 1).
            </p>
          </div>

          <div className="field">
            <label className="flex items-center gap-2 uppercase-off">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
              />
              <span>Casa ativa</span>
            </label>
          </div>

          <div className="flex gap-3 mt-4">
            <button type="submit" className="btn btn-primary">Salvar</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
