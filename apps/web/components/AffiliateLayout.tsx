/**
 * Affiliate Layout — sidebar shell for /afiliado/*.
 */

import React from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

interface NavItem { path: string; label: string; }

const navItems: NavItem[] = [
  { path: '/afiliado', label: 'Dashboard' },
  { path: '/afiliado/campanhas', label: 'Minhas Campanhas' },
];

export default function AffiliateLayout() {
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
          <p className="brand-subtitle">Afiliado</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const isActive = item.path === '/afiliado'
              ? currentPath === '/afiliado'
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