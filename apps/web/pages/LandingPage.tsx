/**
 * Landing Page - Simple landing page with CTAs
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
      background: '#1a1a2e',
      color: '#fff',
      padding: '2rem',
    }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 700,
        marginBottom: '1rem',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}>
        Tipster Engine
      </h1>
      
      <p style={{
        fontSize: '1.25rem',
        color: '#a0a0b0',
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
          style={{
            background: 'transparent',
            border: '2px solid #FFD700',
            color: '#FFD700',
            padding: '1rem 2rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'all 0.2s',
          }}
        >
          Entrar
        </Link>
        
        <Link
          to="/signup"
          style={{
            background: '#FFD700',
            color: '#1a1a2e',
            padding: '1rem 2rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'all 0.2s',
          }}
        >
          Cadastrar
        </Link>
      </div>
    </div>
  );
}