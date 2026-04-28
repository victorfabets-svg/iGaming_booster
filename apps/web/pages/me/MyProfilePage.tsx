/**
 * MyProfilePage - User profile management
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState } from 'react';
import { useAuth } from '../../state/AuthContext';

export default function MyProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <div className="g-row">
      <div className="g-col-6">
        <div className="card">
          <h1 className="card-title">Editar Perfil</h1>
          <form onSubmit={handleSubmit}>
            <div className="filter-group" style={{ marginBottom: '1rem' }}>
              <label className="filter-label">Email</label>
              <input className="input" value={user?.email || ''} disabled />
            </div>
            <div className="filter-group" style={{ marginBottom: '1rem' }}>
              <label className="filter-label">Nome</label>
              <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
      <div className="g-col-6">
        <div className="card">
          <h1 className="card-title">Alterar Senha</h1>
          <form>
            <div className="filter-group" style={{ marginBottom: '1rem' }}>
              <label className="filter-label">Senha Atual</label>
              <input className="input" type="password" />
            </div>
            <div className="filter-group" style={{ marginBottom: '1rem' }}>
              <label className="filter-label">Nova Senha</label>
              <input className="input" type="password" />
            </div>
            <button type="submit" className="btn btn-primary">Alterar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
