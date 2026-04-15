import { useState, useEffect, useRef, useCallback } from 'react';
import createApiClient, { Proof, Reward, Raffle, RaffleResult, MetricsResponse, SystemEvent } from '../services/api';

const api = createApiClient('');

export interface SystemState {
  proof: Proof | null;
  rewards: Reward[];
  raffles: Raffle[];
  raffleResult: RaffleResult | null;
  metrics: MetricsResponse | null;
  events: SystemEvent[];
  loading: boolean;
  error: string | null;
}

const initialState: SystemState = {
  proof: null,
  rewards: [],
  raffles: [],
  raffleResult: null,
  metrics: null,
  events: [],
  loading: false,
  error: null,
};

export function useSystemState() {
  const [state, setState] = useState<SystemState>(initialState);
  const pollingRef = useRef<number | null>(null);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const loadProof = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const proof = await api.getProof(id);
      setState(prev => ({ ...prev, proof, loading: false }));
      
      // Start polling if status is not approved or rejected
      if (proof.status !== 'approved' && proof.status !== 'rejected') {
        startPolling(id);
      } else {
        stopPolling();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load proof';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const startPolling = useCallback((proofId: string) => {
    stopPolling();
    
    pollingRef.current = window.setInterval(async () => {
      try {
        const proof = await api.getProof(proofId);
        setState(prev => ({ ...prev, proof }));
        
        // Stop polling if status is approved or rejected
        if (proof.status === 'approved' || proof.status === 'rejected') {
          stopPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const loadRewards = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const rewards = await api.getRewards();
      setState(prev => ({ ...prev, rewards, loading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load rewards';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const loadRaffles = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raffles = await api.getRaffles();
      setState(prev => ({ ...prev, raffles, loading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load raffles';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const loadRaffleResult = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const raffleResult = await api.getRaffleResult(id);
      setState(prev => ({ ...prev, raffleResult, loading: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load raffle result';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const metrics = await api.getMetrics();
      setState(prev => ({ ...prev, metrics }));
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetch('/events');
      if (response.ok) {
        const events = await response.json();
        setState(prev => ({ ...prev, events }));
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }, []);

  // Load metrics on mount and poll every 10 seconds
  useEffect(() => {
    loadMetrics();
    const metricsInterval = window.setInterval(loadMetrics, 10000);
    return () => {
      window.clearInterval(metricsInterval);
    };
  }, [loadMetrics]);

  // Load events on mount and poll every 8 seconds (optional)
  useEffect(() => {
    loadEvents();
    const eventsInterval = window.setInterval(loadEvents, 8000);
    return () => {
      window.clearInterval(eventsInterval);
    };
  }, [loadEvents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    ...state,
    loadProof,
    loadRewards,
    loadRaffles,
    loadRaffleResult,
    loadMetrics,
    loadEvents,
    clearError,
  };
}

export default useSystemState;