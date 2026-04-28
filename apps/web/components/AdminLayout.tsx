/**
 * Admin Layout — sidebar shell for /admin/*.
 */

import React from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

interface NavItem { path: string; label: string; }

const navItems: NavItem[] = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/houses', label: 'Casas Parceiras' },
  { path: '/admin/plans', label: 'Planos' },
  { path: '/admin/subscriptions', label: 'Assinaturas' },
  { path: '/admin/tips', label: 'Tips' },
  { path: '/admin/whatsapp', label: 'WhatsApp' },
  { path: '/admin/integrations', label: 'Integrações' },
  { path: '/admin/email-templates', label: 'Templates de Email' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentPath = location.pathname;

  return (
    <div className="app-shell expanded">
      <aside className="sidebar expanded">
        <div className="sidebar-header">
          <h2 className="brand-title">iGaming Booster</h2>
          <p className="brand-subtitle">Admin</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const isActive = item.path === '/admin'
              ? currentPath === '/admin'
              : currentPath.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className="text-muted text-xs uppercase mb-1">Logado como</p>
          <p className="text-sm mb-3">{user?.email}</p>
          <button type="button" className="btn btn-primary full-width" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
