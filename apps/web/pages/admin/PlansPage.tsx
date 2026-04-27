/**
 * Plans Admin Page
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Plan, PlanInput, PlanUpdate } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setStatus('loading');
    const response = await adminApi.listPlans();
    if (response.success && response.data) {
      setPlans(response.data.plans);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  async function handleSave(input: PlanInput) {
    const response = await adminApi.createPlan(input);
    if (response.success) {
      setShowModal(false);
      setEditingPlan(null);
      loadPlans();
    }
  }

  async function handleDeactivate(slug: string) {
    if (!confirm(`Desativar plano ${slug}?`)) return;
    await adminApi.deactivatePlan(slug);
    loadPlans();
  }

  async function handleReactivate(slug: string) {
    await adminApi.reactivatePlan(slug);
    loadPlans();
  }

  if (status === 'loading') return <div>Carregando...</div>;
  if (status === 'error') return <div>Erro ao carregar</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Planos</h1>
        <button
          onClick={() => {
            setEditingPlan(null);
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
          + Novo Plano
        </button>
      </div>

      {plans.length === 0 ? (
        <p>Nenhum plano encontrado.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Slug</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nome</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Preço</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ciclo</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ativo</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>
                  <code>{plan.slug}</code>
                </td>
                <td style={{ padding: '0.75rem' }}>{plan.name}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {formatCurrency(plan.price_cents, plan.currency)}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {plan.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {plan.active ? '✅' : '❌'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {plan.active ? (
                    <button onClick={() => handleDeactivate(plan.slug)}>Desativar</button>
                  ) : (
                    <button onClick={() => handleReactivate(plan.slug)}>Reativar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <PlanModal
          plan={editingPlan}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingPlan(null);
          }}
        />
      )}
    </div>
  );
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function PlanModal({
  plan,
  onSave,
  onClose,
}: {
  plan: Plan | null;
  onSave: (input: PlanInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    slug: plan?.slug || '',
    name: plan?.name || '',
    description: plan?.description || '',
    price_cents: plan?.price_cents || 0,
    currency: plan?.currency || 'BRL',
    billing_cycle: plan?.billing_cycle || 'monthly' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      slug: form.slug,
      name: form.name,
      description: form.description,
      price_cents: form.price_cents,
      currency: form.currency,
      billing_cycle: form.billing_cycle,
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
        <h2 style={{ margin: '0 0 1rem' }}>{plan ? 'Editar Plano' : 'Novo Plano'}</h2>
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
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Preço ( centavos)</label>
            <input
              type="number"
              value={form.price_cents}
              onChange={(e) => setForm({ ...form, price_cents: parseInt(e.target.value) || 0 })}
              required
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Ciclo</label>
            <select
              value={form.billing_cycle}
              onChange={(e) =>
                setForm({ ...form, billing_cycle: e.target.value as 'monthly' | 'annual' })
              }
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            >
              <option value="monthly">Mensal</option>
              <option value="annual">Anual</option>
            </select>
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