import { useCallback, useEffect, useReducer, useRef } from 'react';
import createApiClient from '../services/api';

const api = createApiClient('');

export type ProofFlowPhase =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'approved'
  | 'rejected'
  | 'manual_review'
  | 'error'
  | 'timeout';

export interface UseProofFlowReturn {
  phase: ProofFlowPhase;
  proofId: string | null;
  error: string | null;
  confidenceScore: number | null;
  submit: (file: File) => Promise<void>;
  retry: () => void;
  reset: () => void;
}

interface State {
  phase: ProofFlowPhase;
  proofId: string | null;
  error: string | null;
  confidenceScore: number | null;
}

type Action =
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_OK'; proofId: string }
  | { type: 'SUBMIT_FAIL'; error: string }
  | { type: 'POLL_RESUME' }
  | { type: 'POLL_UPDATE'; status: string; confidenceScore: number | null }
  | { type: 'POLL_TIMEOUT' }
  | { type: 'POLL_FAIL'; error: string }
  | { type: 'RESET' };

const INITIAL: State = {
  phase: 'idle',
  proofId: null,
  error: null,
  confidenceScore: null,
};

const TERMINAL_STATUSES = new Set(['approved', 'rejected', 'manual_review']);
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SUBMIT_START':
      return { ...INITIAL, phase: 'submitting' };
    case 'SUBMIT_OK':
      return { ...state, phase: 'polling', proofId: action.proofId, error: null };
    case 'SUBMIT_FAIL':
      return { ...state, phase: 'error', error: action.error };
    case 'POLL_RESUME':
      return { ...state, phase: 'polling', error: null };
    case 'POLL_UPDATE':
      if (action.status === 'approved')
        return { ...state, phase: 'approved', confidenceScore: action.confidenceScore };
      if (action.status === 'rejected')
        return { ...state, phase: 'rejected', confidenceScore: action.confidenceScore };
      if (action.status === 'manual_review')
        return { ...state, phase: 'manual_review', confidenceScore: action.confidenceScore };
      return state; // pending/processing — mantém polling
    case 'POLL_TIMEOUT':
      return { ...state, phase: 'timeout' };
    case 'POLL_FAIL':
      return { ...state, phase: 'error', error: action.error };
    case 'RESET':
      return INITIAL;
    default:
      return state;
  }
}

export function useProofFlow(): UseProofFlowReturn {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (proofId: string) => {
      clearTimers();
      timeoutRef.current = window.setTimeout(() => {
        clearTimers();
        dispatch({ type: 'POLL_TIMEOUT' });
      }, POLL_TIMEOUT_MS);
      intervalRef.current = window.setInterval(async () => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        try {
          const proof = await api.getProof(proofId);
          const status = proof.status ?? 'pending';
          const confidence = proof.confidence_score ?? null;
          if (TERMINAL_STATUSES.has(status)) {
            clearTimers();
          }
          dispatch({ type: 'POLL_UPDATE', status, confidenceScore: confidence });
        } catch (err) {
          clearTimers();
          const message = err instanceof Error ? err.message : 'Polling failed';
          dispatch({ type: 'POLL_FAIL', error: message });
        }
      }, POLL_INTERVAL_MS);
    },
    [clearTimers]
  );

  const submit = useCallback(
    async (file: File) => {
      clearTimers();
      dispatch({ type: 'SUBMIT_START' });
      try {
        const res = await api.submitProof(file);
        dispatch({ type: 'SUBMIT_OK', proofId: res.proof_id });
        startPolling(res.proof_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        dispatch({ type: 'SUBMIT_FAIL', error: message });
      }
    },
    [clearTimers, startPolling]
  );

  const retry = useCallback(() => {
    if (state.proofId && (state.phase === 'timeout' || state.phase === 'error')) {
      dispatch({ type: 'POLL_RESUME' });
      startPolling(state.proofId);
      return;
    }
    clearTimers();
    dispatch({ type: 'RESET' });
  }, [state.phase, state.proofId, startPolling, clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    dispatch({ type: 'RESET' });
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    phase: state.phase,
    proofId: state.proofId,
    error: state.error,
    confidenceScore: state.confidenceScore,
    submit,
    retry,
    reset,
  };
}

export default useProofFlow;