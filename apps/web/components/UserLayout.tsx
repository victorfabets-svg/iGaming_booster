/**
 * User Layout - Sidebar and header for authenticated user pages
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a2e' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        background: '#0f0f1a',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h2 style={{ color: '#FFD700', fontSize: '1.25rem', marginBottom: '2rem' }}>
          Tipster Engine
        </h2>

        <nav style={{ flex: 1 }}>
          {menuItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/me'}
              style={({ isActive }) => ({
                display: 'block',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? '#FFD700' : '#a0a0b0',
                background: isActive ? '#1a1a2e' : 'transparent',
                transition: 'all 0.2s',
              })}
            >
              <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            padding: '0.75rem',
            background: 'transparent',
            border: '1px solid #333',
            color: '#a0a0b0',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Sair
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          padding: '1rem 2rem',
          background: '#0f0f1a',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ color: '#fff', fontWeight: 500 }}>
            {user?.display_name || user?.email}
          </div>
        </header>

        {/* Email verification banner */}
        {!isEmailVerified && (
          <div style={{
            padding: '0.75rem 2rem',
            background: '#FFD700',
            color: '#1a1a2e',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>Confirme seu email para acessar todos os recursos.</span>
            <button
              onClick={() => navigate('/me/verify')}
              style={{
                background: '#1a1a2e',
                color: '#FFD700',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
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