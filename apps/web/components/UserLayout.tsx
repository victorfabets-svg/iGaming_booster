/**
 * User Layout — collapsible sidebar shell for /me/*.
 * Default state = collapsed (icon-only) so promotions get max viewport.
 */

import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Upload,
  History,
  Ticket,
  Trophy,
  CreditCard,
  Lightbulb,
  User,
} from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import ThemeToggle from './ThemeToggle';

const STORAGE_KEY = 'sidebar_user_expanded';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const menuItems: NavItem[] = [
  { path: '/me', label: 'Início', icon: <Home /> },
  { path: '/me/upload', label: 'Enviar Comprovante', icon: <Upload /> },
  { path: '/me/historico', label: 'Histórico', icon: <History /> },
  { path: '/me/tickets', label: 'Meus Números', icon: <Ticket /> },
  { path: '/me/raffles', label: 'Sorteios', icon: <Trophy /> },
  { path: '/me/subscription', label: 'Assinatura', icon: <CreditCard /> },
  { path: '/me/tips', label: 'Tips', icon: <Lightbulb /> },
  { path: '/me/profile', label: 'Perfil', icon: <User /> },
];

export default function UserLayout() {
  const navigate = useNavigate();
  const { user, logout, isEmailVerified } = useAuth();
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(expanded));
    } catch {
      /* localStorage may be unavailable */
    }
  }, [expanded]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`app-shell ${expanded ? 'expanded' : ''}`}>
      <aside className={`sidebar ${expanded ? 'expanded' : ''}`}>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {expanded && (
          <div className="sidebar-header">
            <h2 className="brand-title">Tipster Engine</h2>
            <p className="brand-subtitle">Minha Conta</p>
          </div>
        )}

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/me'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {expanded ? (
          <div className="sidebar-footer">
            <p className="text-muted text-xs uppercase mb-1">Logado como</p>
            <p className="text-sm mb-3">{user?.display_name || user?.email}</p>
            <ThemeToggle className="theme-toggle-sidebar-footer" />
            <button type="button" className="btn btn-ghost full-width" onClick={handleLogout}>
              Sair
            </button>
          </div>
        ) : (
          <div className="sidebar-footer-compact">
            <ThemeToggle compact />
          </div>
        )}
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
