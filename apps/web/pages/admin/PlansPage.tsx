/**
 * Plans Admin Page
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Plan, PlanInput } from '../../services/admin-api';

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
    const response = editingPlan
      ? await adminApi.updatePlan(editingPlan.slug, {
          name: input.name,
          description: input.description,
          price_cents: input.price_cents,
          metadata: input.metadata,
        })
      : await adminApi.createPlan(input);

    if (response.success) {
      setShowModal(false);
      setEditingPlan(null);
      loadPlans();
    } else {
      setFormError(response.error?.message || 'Erro ao salvar plano.');
    }
  }

  function handleEdit(plan: Plan) {
    setEditingPlan(plan);
    setFormError(null);
    setShowModal(true);
  }

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar.</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Planos</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setEditingPlan(null); setFormError(null); setShowModal(true); }}
        >
          + Novo Plano
        </button>
      </div>

      <div className="card">
        {plans.length === 0 ? (
          <div className="empty-state">Nenhum plano encontrado.</div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Nome</th>
                <th>Preço</th>
                <th>Cobrança</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td className="mono">{plan.slug}</td>
                  <td>{plan.name}</td>
                  <td className="mono">{(plan.price_cents / 100).toFixed(2)} {plan.currency}</td>
                  <td>{plan.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}</td>
                  <td>
                    <span className={`badge ${plan.active ? 'badge-success' : 'badge-gray'}`}>
                      {plan.active ? 'ativo' : 'inativo'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="action-btn" onClick={() => handleEdit(plan)}>
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
        <PlanModal
          plan={editingPlan}
          error={formError}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingPlan(null); setFormError(null); }}
        />
      )}
    </div>
  );
}

function PlanModal({
  plan,
  error,
  onSave,
  onClose,
}: {
  plan: Plan | null;
  error: string | null;
  onSave: (input: PlanInput) => void;
  onClose: () => void;
}) {
  const editing = !!plan;
  const [form, setForm] = useState({
    slug: plan?.slug || '',
    name: plan?.name || '',
    description: plan?.description || '',
    price_brl: plan ? (plan.price_cents / 100).toFixed(2) : '',
    currency: plan?.currency || 'BRL',
    billing_cycle: plan?.billing_cycle || 'monthly',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(form.price_brl.replace(',', '.')) * 100);
    onSave({
      slug: form.slug,
      name: form.name,
      description: form.description.trim() || undefined,
      price_cents: priceCents,
      currency: form.currency,
      billing_cycle: form.billing_cycle as 'monthly' | 'annual',
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">{editing ? 'Editar Plano' : 'Novo Plano'}</h2>
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
              placeholder="premium-mensal"
            />
            {editing && <p className="field-help">Slug não pode ser alterado.</p>}
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
            <label>Descrição (opcional)</label>
            <input
              className="input"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Preço (R$)</label>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="29.90"
              value={form.price_brl}
              onChange={e => setForm({ ...form, price_brl: e.target.value })}
              required
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
              disabled={editing}
            />
          </div>

          <div className="field">
            <label>Ciclo de cobrança</label>
            <select
              className="input"
              value={form.billing_cycle}
              onChange={e => setForm({ ...form, billing_cycle: e.target.value as 'monthly' | 'annual' })}
              disabled={editing}
            >
              <option value="monthly">Mensal</option>
              <option value="annual">Anual</option>
            </select>
            {editing && <p className="field-help">Ciclo não pode ser alterado.</p>}
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
