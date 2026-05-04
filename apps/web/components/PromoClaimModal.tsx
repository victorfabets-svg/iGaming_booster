/**
 * PromoClaimModal — landing-side proof submission flow.
 *
 * Renders the modal from the design (drag-drop + name/email/cpf/whatsapp
 * + "Enviar comprovante" / "Fazer depósito"). Submits multipart to
 * POST /public/promotions/:slug/claim. On success, switches to a
 * "verifique seu email" confirmation state.
 */

import React, { useCallback, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface PromoClaimContext {
  promo_slug: string;
  promo_name: string;
  house_name: string;
  tier_min_deposit_cents?: number;
  tier_tickets?: number;
}

interface PromoClaimModalProps {
  context: PromoClaimContext;
  onClose: () => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 5 * 1024 * 1024;

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function PromoClaimModal({ context, onClose }: PromoClaimModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<{ email: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError('Arquivo grande demais — máximo 5MB.');
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) { setError('Envie um print claro do comprovante.'); return; }
    if (!name.trim()) { setError('Informe seu nome completo.'); return; }
    if (!email.trim()) { setError('Informe um e-mail válido.'); return; }
    if (whatsapp.replace(/\D/g, '').length < 10) { setError('Informe um WhatsApp válido (DDD + número).'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('email', email.trim());
      fd.append('name', name.trim());
      fd.append('whatsapp', whatsapp.replace(/\D/g, ''));
      if (context.tier_min_deposit_cents !== undefined) {
        fd.append('tier_min_deposit_cents', String(context.tier_min_deposit_cents));
      }

      const res = await fetch(
        `${API_BASE}/public/promotions/${encodeURIComponent(context.promo_slug)}/claim`,
        { method: 'POST', body: fd, credentials: 'include' }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) {
        setError(body?.error?.message || 'Falha ao enviar. Tente novamente.');
        setLoading(false);
        return;
      }
      const data = body?.success === true ? body.data : body;
      setSubmitted({ email: data?.email || email });
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const depositHref = `${API_BASE}/r/p/${encodeURIComponent(context.promo_slug)}/deposit`;

  if (submitted) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content claim-modal" onClick={e => e.stopPropagation()}>
          <button type="button" className="claim-modal-close" onClick={onClose} aria-label="Fechar">×</button>
          <h2 className="card-title">Confirme seu e-mail</h2>
          <p className="claim-modal-success">
            Comprovante recebido. Enviamos um link para <strong>{submitted.email}</strong>.
            Confirme o e-mail para acessar suas cotas.
          </p>
          <p className="text-muted text-sm">
            Se aprovado, suas cotas vão aparecer automaticamente na sua dashboard.
          </p>
          <button type="button" className="btn btn-primary full-width" onClick={onClose}>Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content claim-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="claim-modal-close" onClick={onClose} aria-label="Fechar">×</button>

        <header className="claim-modal-header">
          <h2 className="card-title">Enviar comprovante</h2>
          <p className="claim-modal-subtitle">
            <strong>{context.promo_name}</strong>
            <span className="text-muted"> — {context.house_name}</span>
            {context.tier_min_deposit_cents !== undefined && (
              <>
                <br />
                <span className="claim-modal-tier">
                  Depósito mínimo {formatBRL(context.tier_min_deposit_cents)}
                  {context.tier_tickets ? ` → ${context.tier_tickets} cotas` : ''}
                </span>
              </>
            )}
          </p>
        </header>

        <form onSubmit={onSubmit} className="claim-modal-form">
          <label
            className={`claim-dropzone ${dragOver ? 'is-drag' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
              hidden
            />
            <div className="claim-dropzone-icon" aria-hidden>↑</div>
            {file ? (
              <>
                <div className="claim-dropzone-title">{file.name}</div>
                <div className="claim-dropzone-sub">{(file.size / 1024).toFixed(0)} KB · clique para trocar</div>
              </>
            ) : (
              <>
                <div className="claim-dropzone-title">Arraste o comprovante</div>
                <div className="claim-dropzone-sub">JPG · PNG · WEBP · PDF (até 5MB)</div>
              </>
            )}
          </label>

          <div className="field">
            <label htmlFor="claim-name">Nome completo</label>
            <input id="claim-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="João Silva" autoComplete="name" />
          </div>

          <div className="field">
            <label htmlFor="claim-email">E-mail</label>
            <input id="claim-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
          </div>

          <div className="field">
            <label htmlFor="claim-whatsapp">WhatsApp</label>
            <input id="claim-whatsapp" className="input" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" autoComplete="tel" />
          </div>

          {error && <div className="alert-box alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary full-width btn-lg" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar comprovante'}
          </button>

          <a href={depositHref} className="btn btn-secondary full-width" target="_blank" rel="noopener noreferrer">
            Fazer depósito
          </a>

          <p className="claim-modal-foot text-muted text-xs">
            🔒 Pagamento criptografado · Validação por IA · Suporte 24h
          </p>
        </form>
      </div>
    </div>
  );
}
