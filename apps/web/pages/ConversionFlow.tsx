import React from 'react';
import useProofFlow from '../state/useProofFlow';
import UploadScreen from '../components/flow/UploadScreen';
import SubmittedScreen from '../components/flow/SubmittedScreen';
import ErrorScreen from '../components/flow/ErrorScreen';

export interface ConversionFlowProps {
  onOpenHistory: () => void;
}

const ConversionFlow: React.FC<ConversionFlowProps> = ({ onOpenHistory }) => {
  const flow = useProofFlow();

  switch (flow.phase) {
    case 'idle':
    case 'submitting':
      return (
        <UploadScreen
          onSubmit={flow.submit}
          isSubmitting={flow.phase === 'submitting'}
        />
      );
    case 'submitted':
    case 'approved':
    case 'rejected':
    case 'manual_review':
    case 'timeout':
      return (
        <SubmittedScreen
          proofId={flow.proofId ?? ''}
          isNew={flow.isNew}
          submittedAt={flow.submittedAt}
          status={flow.phase}
          confidenceScore={flow.confidenceScore}
          onOpenHistory={onOpenHistory}
          onSubmitAnother={flow.reset}
        />
      );
    case 'error':
      return (
        <ErrorScreen
          title="Falha no envio"
          description={flow.error ?? 'Não foi possível concluir a operação.'}
          onRetry={flow.retry}
          onReset={flow.reset}
          canRetry={flow.canRetry}
        />
      );
    default: {
      const _exhaustive: never = flow.phase;
      void _exhaustive;
      return null;
    }
  }
};

export default ConversionFlow;
