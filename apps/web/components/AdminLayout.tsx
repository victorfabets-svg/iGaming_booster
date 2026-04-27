/**
 * Admin Layout - sidebar navigation for admin pages
 */

import React from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: '📊' },
  { path: '/admin/houses', label: 'Casas Parceiras', icon: '🏠' },
  { path: '/admin/plans', label: 'Planos', icon: '📋' },
  { path: '/admin/subscriptions', label: 'Assinaturas', icon: '💳' },
  { path: '/admin/tips', label: 'Tips', icon: '🎯' },
  { path: '/admin/whatsapp', label: 'WhatsApp', icon: '💬' },
  { path: '/admin/integrations', label: 'Integrações', icon: '🔗' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get pathname without leading slash for active check
  const currentPath = location.pathname;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '240px',
          background: '#1a1a2e',
          color: '#fff',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>iGaming Booster</h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#888' }}>Admin</p>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {navItems.map((item) => {
            const isActive = item.path === '/admin' 
              ? currentPath === '/admin' 
              : currentPath.startsWith(item.path);
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  display: 'block',
                  padding: '0.75rem 1rem',
                  margin: '0.25rem 0',
                  color: isActive ? '#00d4ff' : '#bbb',
                  background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User info & logout */}
        <div style={{ padding: '1rem', borderTop: '1px solid #333' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#888' }}>
            Logado como:
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
            {user?.email}
          </p>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', background: '#f5f5f5' }}>
        {/* Render child route */}
        <Outlet />
      </main>
    </div>
  );
}