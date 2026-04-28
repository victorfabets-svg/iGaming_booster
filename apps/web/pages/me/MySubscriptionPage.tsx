/**
 * MySubscriptionPage - User subscription
 */

import React from 'react';

export default function MySubscriptionPage() {
  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: '#fff' }}>
        Assinatura
      </h1>
      
      <div style={{
        background: '#0f0f1a',
        padding: '2rem',
        borderRadius: '12px',
        border: '1px solid #333',
        textAlign: 'center',
      }}>
        <p style={{ color: '#a0a0b0', marginBottom: '1rem' }}>
          Em breve você podrá assinar um plano premium!
        </p>
        <p style={{ color: '#a0a0b0', fontSize: '0.875rem' }}>
          Assinantes têm acesso a tips exclusivas e outros benefícios.
        </p>
      </div>
    </div>
  );
}