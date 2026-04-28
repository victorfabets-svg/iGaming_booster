/**
 * Plans Admin Page
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Plan, PlanInput } from '../../services/admin-api';

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
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
    if (editingPlan) {
      await adminApi.updatePlan(editingPlan.id, input);
    } else {
      await adminApi.createPlan(input);
    }
    setShowModal(false);
    setEditingPlan(null);
    loadPlans();
  }

  function handleEdit(plan: Plan) {
    setEditingPlan(plan);
    setShowModal(true);
  }

  if (status === 'loading') return <div className="loading-state">Carregando...</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar</div>;

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Planos</h1>
        <button className="btn btn-primary" onClick={() => { setEditingPlan(null); setShowModal(true); }}>
          + Novo Plano
        </button>
      </div>

      <div className="card">
        {plans.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum plano encontrado.</p>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preco</th>
                <th>Periodo</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td>{plan.name}</td>
                  <td className="mono">{plan.price}</td>
                  <td>{plan.period_days} dias</td>
                  <td>
                    <span className={`badge ${plan.active ? 'badge-success' : 'badge-gray'}`}>
                      {plan.active ? 'ativo' : 'inativo'}
                    </span>
                  </td>
                  <td>
                    <button className="action-btn" onClick={() => handleEdit(plan)}>Editar</button>
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
