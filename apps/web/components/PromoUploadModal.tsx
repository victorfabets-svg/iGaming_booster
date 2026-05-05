/**
 * PromoUploadModal — authenticated proof upload tied to a specific promotion.
 *
 * Used from the /me dashboard when a logged-in user hits "Enviar comprovante"
 * on a promo card. Sends multipart to POST /proofs with promotion_id; on
 * success, links the user to /me/historico ("Comprovantes") so they can
 * follow validation progress.
 *
 * Standalone proof upload (no promotion) was removed — every proof must now
 * come through a promotion since proofs without a promo emit zero tickets.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import createApiClient from '../services/api';
import { MePromotion } from '../services/me-api';

interface PromoUploadModalProps {
  promo: MePromotion;
  onClose: () => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 5 * 1024 * 1024;

const api = createApiClient('');

export default function PromoUploadModal({ promo, onClose }: PromoUploadModalProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
    if (!file) {
      setError('Envie um print claro do comprovante.');
      return;
    }
    setLoading(true);
    try {
      await api.submitProof(file, promo.id);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content claim-modal" onClick={e => e.stopPropagation()}>
          <button type="button" className="claim-modal-close" onClick={onClose} aria-label="Fechar">×</button>
          <h2 className="card-title">Comprovante recebido</h2>
          <p className="claim-modal-success">
            Estamos validando seu comprovante para a promoção <strong>{promo.name}</strong>.
            Acompanhe o status em <strong>Comprovantes</strong>.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary full-width"
              onClick={() => { onClose(); navigate('/me/historico'); }}
            >
              Ver comprovantes
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
          </div>
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
            <strong>{promo.name}</strong>
            <span className="text-muted"> — {promo.house_name}</span>
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

          {error && <div className="alert-box alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary full-width btn-lg" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar comprovante'}
          </button>
        </form>
      </div>
    </div>
  );
}
