/**
 * Admin Layout - sidebar navigation for admin pages
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
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
  { path: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { path: '/admin/houses', label: 'Casas Parceiras', icon: 'layers' },
  { path: '/admin/plans', label: 'Planos', icon: 'card' },
  { path: '/admin/subscriptions', label: 'Assinaturas', icon: 'card' },
  { path: '/admin/tips', label: 'Tips', icon: 'target' },
  { path: '/admin/whatsapp', label: 'WhatsApp', icon: 'activity' },
  { path: '/admin/integrations', label: 'Integrações', icon: 'link' },
  { path: '/admin/email-templates', label: 'Templates de Email', icon: 'file' },
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
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-header" style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>iGaming Booster</h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Admin</p>
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
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{ display: 'block', padding: '0.75rem 1rem', margin: '0.25rem 0', textDecoration: 'none' }}
              >
                <span style={{ marginRight: '0.5rem' }}>•</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User info & logout */}
        <div className="sidebar-footer">
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Logado como:
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
            {user?.email}
          </p>
          <button
            onClick={handleLogout}
            className="btn"
            style={{
              width: '100%',
              background: 'var(--color-primary-primary)',
              color: '#fff',
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Render child route */}
        <Outlet />
      </main>
    </div>
  );
}