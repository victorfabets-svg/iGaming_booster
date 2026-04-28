/**
 * Landing Page - Simple landing page with CTAs
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background-primary)',
      color: 'var(--text-primary)',
      padding: '2rem',
    }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 700,
        marginBottom: '1rem',
        fontFamily: 'var(--font-display)',
      }}>
        Tipster Engine
      </h1>
      
      <p style={{
        fontSize: '1.25rem',
        color: 'var(--text-secondary)',
        marginBottom: '3rem',
        maxWidth: '500px',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        Potencialize seus lucros com predictions baseadas em dados. 
        Acompanhe resultados em tempo real eGanhe prêmios exclusivos.
      </p>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link
          to="/login"
          className="btn"
          style={{
            border: '2px solid var(--color-primary-primary)',
            color: 'var(--color-primary-primary)',
          }}
        >
          Entrar
        </Link>
        
        <Link
          to="/signup"
          className="btn btn-primary"
        >
          Cadastrar
        </Link>
      </div>
    </div>
  );
}