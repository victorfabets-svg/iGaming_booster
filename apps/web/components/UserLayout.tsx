/**
 * User Layout — sidebar shell for /me/*.
 */

import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

const menuItems = [
  { path: '/me', label: 'Início' },
  { path: '/me/upload', label: 'Enviar Comprovante' },
  { path: '/me/historico', label: 'Histórico' },
  { path: '/me/tickets', label: 'Meus Números' },
  { path: '/me/raffles', label: 'Sorteios' },
  { path: '/me/subscription', label: 'Assinatura' },
  { path: '/me/tips', label: 'Tips' },
  { path: '/me/profile', label: 'Perfil' },
];

export default function UserLayout() {
  const navigate = useNavigate();
  const { user, logout, isEmailVerified } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell expanded">
      <aside className="sidebar expanded">
        <div className="sidebar-header">
          <h2 className="brand-title">Tipster Engine</h2>
          <p className="brand-subtitle">Minha Conta</p>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/me'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="text-muted text-xs uppercase mb-1">Logado como</p>
          <p className="text-sm mb-3">{user?.display_name || user?.email}</p>
          <button type="button" className="btn btn-ghost full-width" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        {!isEmailVerified && (
          <div className="verify-banner">
            <span>Confirme seu email para acessar todos os recursos.</span>
            <button
              type="button"
              className="btn-link"
              onClick={() => navigate('/me/verify')}
            >
              Reenviar email →
            </button>
          </div>
        )}

        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
