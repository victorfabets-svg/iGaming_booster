import { useState, useEffect, useRef, useCallback } from 'react';
import createApiClient, { Proof, Reward, Raffle, RaffleResult } from '../services/api';

const api = createApiClient('');

export interface SystemState {
  proof: Proof | null;
  rewards: Reward[];
  raffles: Raffle[];
  raffleResult: RaffleResult | null;
  loading: boolean;
  error: string | null;
}

const initialState: SystemState = {
  proof: null,
  rewards: [],
  raffles: [],
  raffleResult: null,
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
    clearError,
  };
}

export default useSystemState;