/**
 * Landing Page — public marketing screen with CTAs.
 */

import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="auth-shell">
      <div className="landing-hero text-center">
        <h1 className="landing-title">Tipster Engine</h1>
        <p className="landing-subtitle">
          Potencialize seus lucros com predictions baseadas em dados. Acompanhe resultados em
          tempo real e ganhe prêmios exclusivos.
        </p>
        <div className="landing-cta flex gap-3 justify-center">
          <Link to="/login" className="btn btn-secondary">Entrar</Link>
          <Link to="/signup" className="btn btn-primary">Cadastrar</Link>
        </div>
      </div>
    </div>
  );
}
