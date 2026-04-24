import { useCallback, useReducer } from 'react';
import createApiClient from '../services/api';
import { track } from '../lib/tracking';

const api = createApiClient('');

export type ProofFlowPhase =
  | 'idle'
  | 'submitting'
  | 'submitted'
  | 'error';

export interface UseProofFlowReturn {
  phase: ProofFlowPhase;
  proofId: string | null;
  error: string | null;
  isNew: boolean | null;
  submittedAt: string | null;
  submit: (file: File) => Promise<void>;
  reset: () => void;
}

interface State {
  phase: ProofFlowPhase;
  proofId: string | null;
  error: string | null;
  isNew: boolean | null;
  submittedAt: string | null;
}

type Action =
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_OK'; proofId: string; isNew: boolean | null; submittedAt: string | null }
  | { type: 'SUBMIT_FAIL'; error: string }
  | { type: 'RESET' };

const INITIAL: State = {
  phase: 'idle',
  proofId: null,
  error: null,
  isNew: null,
  submittedAt: null,
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
        error: null,
      };
    case 'SUBMIT_FAIL':
      return { ...state, phase: 'error', error: action.error };
    case 'RESET':
      return INITIAL;
    default:
      return state;
  }
}

export function useProofFlow(): UseProofFlowReturn {
  const [state, dispatch] = useReducer(reducer, INITIAL);

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
    dispatch({ type: 'RESET' });
  }, []);

  return {
    phase: state.phase,
    proofId: state.proofId,
    error: state.error,
    isNew: state.isNew,
    submittedAt: state.submittedAt,
    submit,
    reset,
  };
}

export default useProofFlow;
