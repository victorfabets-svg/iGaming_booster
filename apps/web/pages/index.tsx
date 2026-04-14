import React, { useEffect, useMemo, useState } from 'react';
import Sidebar, { SectionId } from '../components/Sidebar';
import Header from '../components/Header';
import OverviewSection from './sections/OverviewSection';
import FunnelSection from './sections/FunnelSection';
import PaymentsSection from './sections/PaymentsSection';
import RiskSection from './sections/RiskSection';
import CampaignsSection from './sections/CampaignsSection';
import HistoricoSection from './sections/HistoricoSection';
import createApiClient, { ValidationStats, FunnelStats } from '../services/api';
import type { ProofRow } from '../components/ProofTable';
import type { StreamEvent } from '../components/EventStream';

const api = createApiClient('');

const IndexPage: React.FC = () => {
  const [section, setSection] = useState<SectionId>('overview');
  const [expanded, setExpanded] = useState<boolean>(false);

  const [health, setHealth] = useState<'healthy' | 'degraded' | 'unknown'>('unknown');
  const [latency, setLatency] = useState<number | null>(null);

  const [validation, setValidation] = useState<ValidationStats>({ approved: 0, rejected: 0, manual_review: 0 });
  const [funnel, setFunnel] = useState<FunnelStats>({ clicks: 0, signups: 0, proofs_submitted: 0, proofs_validated: 0 });
  const [proofs, setProofs] = useState<ProofRow[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadId, setLastUploadId] = useState<string | null>(null);
  const [lastUploadStatus, setLastUploadStatus] = useState<string | null>(null);

  // Health pulse
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const h = await api.getHealth();
        if (cancelled) return;
        setHealth(h.status === 'ok' ? 'healthy' : 'degraded');
        setLatency(h.latencyMs ?? null);
      } catch {
        if (!cancelled) { setHealth('degraded'); setLatency(null); }
      }
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Initial data
  useEffect(() => {
    api.getValidationStats().then(setValidation).catch(() => {});
    api.getFunnelStats().then(setFunnel).catch(() => {});
    api.getRecentProofs().then(setProofs).catch(() => {});
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await api.submitProof(file);
      setLastUploadId(res.proof_id);
      setLastUploadStatus(res.status);
      // Optimistic insert at top of proofs table
      setProofs(prev => [
        {
          id: res.proof_id,
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          user: 'test-user',
          amount: null,
          status: (res.status as ProofRow['status']) || 'pending',
          confidence: null,
          risk: null,
          campaign: null,
          type: 'original',
        },
        ...prev,
      ]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setUploading(false);
    }
  };

  const events = useMemo<StreamEvent[]>(() => {
    return proofs.slice(0, 8).map(p => ({
      type: p.status === 'approved' ? 'proof_validated'
          : p.status === 'rejected' ? 'proof_rejected'
          : 'proof_submitted',
      user: p.user,
      time: p.date.split(' ')[1],
    }));
  }, [proofs]);

  return (
    <div className={`app-shell${expanded ? ' expanded' : ''}`}>
      <div className="bg-image-container" />
      <Sidebar
        active={section}
        expanded={expanded}
        onSelect={setSection}
        onToggle={() => setExpanded(v => !v)}
      />
      <main className="main-content">
        <Header health={health} latencyMs={latency} />
        {section === 'overview'  && <OverviewSection validation={validation} funnel={funnel} />}
        {section === 'funnel'    && <FunnelSection validation={validation} funnel={funnel} />}
        {section === 'payments'  && <PaymentsSection />}
        {section === 'risk'      && <RiskSection />}
        {section === 'campaigns' && <CampaignsSection events={events} />}
        {section === 'historico' && (
          <HistoricoSection
            proofs={proofs}
            onUpload={handleUpload}
            uploading={uploading}
            uploadError={uploadError}
            lastUploadId={lastUploadId}
            lastUploadStatus={lastUploadStatus}
          />
        )}
      </main>
    </div>
  );
};

export default IndexPage;
