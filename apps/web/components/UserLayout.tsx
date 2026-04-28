/**
 * User Layout - Sidebar and header for authenticated user pages
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

const menuItems = [
  { path: '/me', label: 'Início', icon: '🏠' },
  { path: '/me/upload', label: 'Enviar Comprovante', icon: '📤' },
  { path: '/me/historico', label: 'Histórico', icon: '📋' },
  { path: '/me/tickets', label: 'Meus Números', icon: '🎱' },
  { path: '/me/raffles', label: 'Sorteios', icon: '🎁' },
  { path: '/me/subscription', label: 'Assinatura', icon: '⭐' },
  { path: '/me/tips', label: 'Tips', icon: '📊' },
  { path: '/me/profile', label: 'Perfil', icon: '👤' },
];

export default function UserLayout() {
  const navigate = useNavigate();
  const { user, logout, isEmailVerified } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 style={{ color: 'var(--color-primary-primary)', fontSize: '1.25rem', marginBottom: '2rem' }}>
          Tipster Engine
        </h2>

        <nav style={{ flex: 1 }}>
          {menuItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/me'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span>•</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="btn"
          style={{
            background: 'transparent',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
          }}
        >
          Sair
        </button>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Header */}
        <header className="global-header">
          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {user?.display_name || user?.email}
          </div>
        </header>

        {/* Email verification banner */}
        {!isEmailVerified && (
          <div className="alert-box alert-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <span>Confirme seu email para acessar todos os recursos.</span>
            <button
              onClick={() => navigate('/me/verify')}
              className="btn"
              style={{
                background: 'var(--color-primary-primary)',
                color: '#fff',
              }}
            >
              Reenviar email
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}