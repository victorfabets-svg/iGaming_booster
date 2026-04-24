import { useCallback, useEffect, useReducer, useRef } from 'react';
import createApiClient from '../services/api';
import { track } from '../lib/tracking';

const api = createApiClient('');

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60_000;

type TerminalStatus = 'approved' | 'rejected' | 'manual_review';

export type ProofFlowPhase =
  | 'idle'
  | 'submitting'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'manual_review'
  | 'timeout'
  | 'error';

export interface UseProofFlowReturn {
  phase: ProofFlowPhase;
  proofId: string | null;
  error: string | null;
  isNew: boolean | null;
  submittedAt: string | null;
  confidenceScore: number | null;
  submit: (file: File) => Promise<void>;
  reset: () => void;
}

interface State {
  phase: ProofFlowPhase;
  proofId: string | null;
  error: string | null;
  isNew: boolean | null;
  submittedAt: string | null;
  confidenceScore: number | null;
}

type Action =
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_OK'; proofId: string; isNew: boolean | null; submittedAt: string | null }
  | { type: 'SUBMIT_FAIL'; error: string }
  | { type: 'POLL_UPDATE'; status: TerminalStatus; confidenceScore: number | null }
  | { type: 'POLL_TIMEOUT' }
  | { type: 'RESET' };

const INITIAL: State = {
  phase: 'idle',
  proofId: null,
  error: null,
  isNew: null,
  submittedAt: null,
  confidenceScore: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SUBMIT_START':
      return { ...INITIAL, phase: 'submitting' };
    case 'SUBMIT_OK':
      return {
        ...state,
        phase: 'submitted',
        proofId: action.proofId,
        isNew: action.isNew,
        submittedAt: action.submittedAt,
        confidenceScore: null,
        error: null,
      };
    case 'SUBMIT_FAIL':
      return { ...state, phase: 'error', error: action.error };
    case 'POLL_UPDATE':
      if (state.phase !== 'submitted') return state;
      return {
        ...state,
        phase: action.status,
        confidenceScore: action.confidenceScore,
      };
    case 'POLL_TIMEOUT':
      if (state.phase !== 'submitted') return state;
      return { ...state, phase: 'timeout' };
    case 'RESET':
      return INITIAL;
    default:
      return state;
  }
}

export function useProofFlow(): UseProofFlowReturn {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const intervalRef = useRef<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    deadlineRef.current = null;
  }, []);

  useEffect(() => {
    if (state.phase !== 'submitted' || !state.proofId) {
      stopPolling();
      return;
    }
    if (intervalRef.current !== null) return;

    const proofId = state.proofId;
    deadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    const tick = async () => {
      if (deadlineRef.current !== null && Date.now() >= deadlineRef.current) {
        stopPolling();
        track('proof_poll_timeout', { proof_id: proofId });
        dispatch({ type: 'POLL_TIMEOUT' });
        return;
      }
      try {
        const proof = await api.getProof(proofId);
        const status = proof.status;
        if (status === 'approved' || status === 'rejected' || status === 'manual_review') {
          stopPolling();
          const confidence = proof.confidence_score ?? null;
          track(`proof_${status}` as const, { proof_id: proofId, confidence_score: confidence });
          dispatch({ type: 'POLL_UPDATE', status, confidenceScore: confidence });
        }
      } catch (err) {
        console.warn('[useProofFlow] poll failed:', err);
      }
    };

    intervalRef.current = window.setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      stopPolling();
    };
  }, [state.phase, state.proofId, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const submit = useCallback(async (file: File) => {
    dispatch({ type: 'SUBMIT_START' });
    try {
      const res = await api.submitProof(file);
      track('proof_submitted', { proof_id: res.proof_id, is_new: res.is_new });
      dispatch({
        type: 'SUBMIT_OK',
        proofId: res.proof_id,
        isNew: res.is_new ?? null,
        submittedAt: res.submitted_at ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      track('upload_failed', { error: message });
      dispatch({ type: 'SUBMIT_FAIL', error: message });
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    dispatch({ type: 'RESET' });
  }, [stopPolling]);

  return {
    phase: state.phase,
    proofId: state.proofId,
    error: state.error,
    isNew: state.isNew,
    submittedAt: state.submittedAt,
    confidenceScore: state.confidenceScore,
    submit,
    reset,
  };
}

export default useProofFlow;
