/**
 * Theme Toggle — sun/moon button that flips dark↔light.
 *
 * Two visual modes:
 *  - default: pill with icon + label (use in headers, top bars)
 *  - compact: icon-only square (use in collapsed sidebars)
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../state/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const label = isLight ? 'Modo escuro' : 'Modo claro';
  const Icon = isLight ? Moon : Sun;

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''} ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <Icon size={compact ? 16 : 14} aria-hidden />
      {!compact && <span>{label}</span>}
    </button>
  );
}
