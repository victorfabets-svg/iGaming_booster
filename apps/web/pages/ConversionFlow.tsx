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
      return (
        <SubmittedScreen
          proofId={flow.proofId ?? ''}
          onOpenHistory={onOpenHistory}
          onSubmitAnother={flow.reset}
        />
      );
    case 'error':
      return (
        <ErrorScreen
          title="Falha no envio"
          description={flow.error ?? 'Não foi possível concluir a operação.'}
          onRetry={flow.reset}
          onReset={flow.reset}
          canRetry={false}
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
