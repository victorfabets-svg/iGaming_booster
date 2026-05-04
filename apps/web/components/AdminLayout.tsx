/**
 * Admin Layout — collapsible sidebar shell for /admin/*.
 * Default state = expanded (admin needs full labels).
 */

import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Building2,
  Megaphone,
  Tag,
  CreditCard,
  Lightbulb,
  MessageSquare,
  Link2,
  Users,
  Plug,
  Mail,
} from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import ThemeToggle from './ThemeToggle';

const STORAGE_KEY = 'sidebar_admin_expanded';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: <LayoutDashboard /> },
  { path: '/admin/houses', label: 'Casas Parceiras', icon: <Building2 /> },
  { path: '/admin/promocoes', label: 'Promoções', icon: <Megaphone /> },
  { path: '/admin/plans', label: 'Planos', icon: <Tag /> },
  { path: '/admin/subscriptions', label: 'Assinaturas', icon: <CreditCard /> },
  { path: '/admin/tips', label: 'Tips', icon: <Lightbulb /> },
  { path: '/admin/whatsapp', label: 'WhatsApp', icon: <MessageSquare /> },
  { path: '/admin/afiliados', label: 'Afiliados', icon: <Link2 /> },
  { path: '/admin/usuarios', label: 'Usuários', icon: <Users /> },
  { path: '/admin/integrations', label: 'Integrações', icon: <Plug /> },
  { path: '/admin/email-templates', label: 'Templates de Email', icon: <Mail /> },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
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

  const currentPath = location.pathname;

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
            <h2 className="brand-title">iGaming Booster</h2>
            <p className="brand-subtitle">Admin</p>
          </div>
        )}

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
                title={item.label}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {expanded ? (
          <div className="sidebar-footer">
            <p className="text-muted text-xs uppercase mb-1">Logado como</p>
            <p className="text-sm mb-3">{user?.email}</p>
            <ThemeToggle className="theme-toggle-sidebar-footer" />
            <button type="button" className="btn btn-primary full-width" onClick={handleLogout}>
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
        <Outlet />
      </main>
    </div>
  );
}
