/**
 * Users Admin Page — list users and change roles.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminUser } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';
type RoleFilter = 'user' | 'admin' | 'affiliate' | '';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setStatus('loading');
    setError(null);
    const response = await adminApi.listUsers({
      role: roleFilter || undefined,
      q: searchQuery || undefined,
      limit: 50,
    });
    if (response.success && response.data) {
      setUsers(response.data.users);
      setStatus('success');
    } else {
      setStatus('error');
      setError(response.error?.message || 'Erro ao carregar usuários.');
    }
  }, [roleFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  async function handleRoleChange(userId: string, newRole: 'user' | 'admin' | 'affiliate') {
    setError(null);
    const response = await adminApi.updateUserRole(userId, newRole);
    if (response.success) {
      loadUsers();
    } else {
      const code = response.error?.code;
      if (code === 'FORBIDDEN_SELF_ROLE_CHANGE') {
        setError('Você não pode alterar a própria role.');
      } else if (code === 'LAST_ADMIN') {
        setError('Não é possível remover o último admin do sistema.');
      } else {
        setError(response.error?.message || 'Erro ao alterar role.');
      }
    }
  }

  const handleEditRole = (user: AdminUser) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-error';
      case 'affiliate': return 'badge-warning';
      default: return 'badge-gray';
    }
  };

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-subtitle">Gerencie usuários do sistema.</p>
        </div>
      </div>

      {error && (
        <div className="alert-box alert-error mb-4">{error}</div>
      )}

      <div className="filter-bar mb-4">
        <label className="text-xs uppercase text-secondary">
          Buscar por email
          <input
            className="input"
            placeholder="email@example.com"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </label>
        <label className="text-xs uppercase text-secondary">
          Role
          <select
            className="input"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="">Todos</option>
            <option value="user">Usuário</option>
            <option value="affiliate">Afiliado</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>

      <div className="card">
        {users.length === 0 ? (
          <div className="empty-state">Nenhum usuário encontrado.</div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nome</th>
                <th>Role</th>
                <th>Verificado</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td className="mono">{user.email}</td>
                  <td>{user.display_name || '—'}</td>
                  <td>
                    <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                      {user.role === 'admin' ? 'Admin' : user.role === 'affiliate' ? 'Afiliado' : 'Usuário'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning'}`}>
                      {user.email_verified ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="mono">{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <button type="button" className="action-btn" onClick={() => handleEditRole(user)}>
                      Mudar role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && editingUser && (
        <RoleModal
          user={editingUser}
          onSave={handleRoleChange}
          onClose={() => { setShowModal(false); setEditingUser(null); }}
        />
      )}
    </div>
  );
}

function RoleModal({
  user,
  onSave,
  onClose,
}: {
  user: AdminUser;
  onSave: (userId: string, role: 'user' | 'admin' | 'affiliate') => void;
  onClose: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'affiliate'>(user.role);
  const [confirmRole, setConfirmRole] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (confirmRole !== user.role) {
      setModalError('Confirmação digitada diferente da role atual.');
      return;
    }
    if (confirmRole === selectedRole) {
      setModalError('A nova role deve ser diferente da atual.');
      return;
    }
    onSave(user.id, selectedRole);
    onClose();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'affiliate': return 'Afiliado';
      default: return 'Usuário';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="card-title mb-4">Mudar Role</h2>
        <p className="mb-4">Usuario: <strong>{user.email}</strong></p>
        <p className="mb-4">Role atual: <span className="badge badge-gray">{getRoleLabel(user.role)}</span></p>

        {modalError && <div className="alert-box alert-error mb-3">{modalError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nova role</label>
            <select
              className="input"
              value={selectedRole}
              onChange={e => { setSelectedRole(e.target.value as 'user' | 'admin' | 'affiliate'); setModalError(null); }}
            >
              <option value="user">Usuário</option>
              <option value="affiliate">Afiliado</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="field">
            <label>Digite a role atual ({getRoleLabel(user.role)}) para confirmar</label>
            <input
              className="input"
              value={confirmRole}
              onChange={e => { setConfirmRole(e.target.value); setModalError(null); }}
              placeholder={getRoleLabel(user.role)}
              required
            />
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