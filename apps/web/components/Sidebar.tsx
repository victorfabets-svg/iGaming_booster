import React from 'react';
import Icon from './Icon';

export type SectionId = 'historico' | 'systemflow';

interface NavItem { id: SectionId; label: string; icon: React.ComponentProps<typeof Icon>['name']; }

const NAV: NavItem[] = [
  { id: 'historico', label: 'Histórico', icon: 'history' },
  { id: 'systemflow', label: 'Fluxo Sistema', icon: 'flow' },
];

interface SidebarProps {
  active: SectionId;
  expanded: boolean;
  onSelect: (id: SectionId) => void;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ active, expanded, onSelect, onToggle }) => (
  <aside className={`sidebar${expanded ? ' expanded' : ''}`}>
    <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
      <Icon name="chevron-right" size={16} />
    </button>

    <div className="avatar-container">
      <img src="https://i.pravatar.cc/100?u=dashboard-user" alt="User" />
    </div>

    <nav>
      {NAV.map(item => (
        <button
          key={item.id}
          className={`nav-item${active === item.id ? ' active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>

    <div className="sidebar-footer">
      <button className="nav-item"><Icon name="settings" size={22} /><span>Configurações</span></button>
      <button className="nav-item"><Icon name="logout" size={22} /><span>Sair</span></button>
    </div>
  </aside>
);

export default Sidebar;
