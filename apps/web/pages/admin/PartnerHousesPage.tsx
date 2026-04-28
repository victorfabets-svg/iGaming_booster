/**
 * Partner Houses Admin Page
 */

import React, { useState, useEffect } from 'react';
import { adminApi, PartnerHouse, PartnerHouseInput } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function PartnerHousesPage() {
  const [houses, setHouses] = useState<PartnerHouse[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [showModal, setShowModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState<PartnerHouse | null>(null);

  useEffect(() => {
    loadHouses();
  }, []);

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
    const response = editingHouse
      ? await adminApi.createPartnerHouse(input)
      : await adminApi.createPartnerHouse(input);

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

  const handleDelete = async (slug: string) => {
    if (!confirm(`Excluir casa ${slug}?`)) return;
    // Toggle active for now
    await adminApi.createPartnerHouse({
      slug,
      name: '',
      country: 'XX',
      currency: 'XXX',
      active: false,
    });
    loadHouses();
  };

  if (status === 'loading') return <div>Carregando...</div>;
  if (status === 'error') return <div>Erro ao carregar</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Casas Parceiras</h1>
        <button
          onClick={() => {
            setEditingHouse(null);
            setShowModal(true);
          }}
          style={{
            padding: '0.5rem 1rem',
            background: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          + Nova Casa
        </button>
      </div>

      {houses.length === 0 ? (
        <p>Nenhuma casa encontrada.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Slug</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nome</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>País</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Moeda</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ativa</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {houses.map((house) => (
              <tr key={house.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>
                  <code>{house.slug}</code>
                </td>
                <td style={{ padding: '0.75rem' }}>{house.name}</td>
                <td style={{ padding: '0.75rem' }}>{house.country}</td>
                <td style={{ padding: '0.75rem' }}>{house.currency}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {house.active ? '✅' : '❌'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleEdit(house)}
                    style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem' }}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <HouseModal
          house={editingHouse}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingHouse(null);
          }}
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <h2 style={{ margin: '0 0 1rem' }}>
          {house ? 'Editar Casa' : 'Nova Casa'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Slug</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>País (2 letras)</label>
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              required
              maxLength={2}
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Moeda (3 letras)</label>
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              required
              maxLength={3}
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Tickets por depósito
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.tickets_per_deposit}
              onChange={(e) =>
                setForm({ ...form, tickets_per_deposit: Math.max(1, Number(e.target.value) || 1) })
              }
              required
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Valor mínimo por ticket (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="(opcional — deixe vazio para 1 ticket por depósito)"
              value={form.min_amount_per_ticket_brl}
              onChange={(e) =>
                setForm({ ...form, min_amount_per_ticket_brl: e.target.value })
              }
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
              Se preenchido, gera <code>floor(valor / mínimo) × tickets por depósito</code> tickets (mínimo 1).
            </small>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />{' '}
              Ativa
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.5rem',
                background: '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: '#ccc',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}