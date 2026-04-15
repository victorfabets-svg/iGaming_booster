import React, { useEffect, useState } from 'react';
import Sidebar, { SectionId } from '../components/Sidebar';
import Header from '../components/Header';
import HistoricoSection from './sections/HistoricoSection';
import SystemFlow from './SystemFlow';
import createApiClient from '../services/api';

const api = createApiClient('');

const IndexPage: React.FC = () => {
  const [section, setSection] = useState<SectionId>('systemflow');
  const [expanded, setExpanded] = useState<boolean>(false);

  const [health, setHealth] = useState<'healthy' | 'degraded' | 'unknown'>('unknown');
  const [latency, setLatency] = useState<number | null>(null);

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
        {section === 'historico' && <HistoricoSection />}
        {section === 'systemflow' && <SystemFlow />}
      </main>
    </div>
  );
};

export default IndexPage;