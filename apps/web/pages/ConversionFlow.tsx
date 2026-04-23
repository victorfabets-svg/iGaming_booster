import React from 'react';
import useProofFlow from '../state/useProofFlow';
import UploadScreen from '../components/flow/UploadScreen';
import ProcessingScreen from '../components/flow/ProcessingScreen';
import ApprovedScreen from '../components/flow/ApprovedScreen';
import RejectedScreen from '../components/flow/RejectedScreen';
import ManualReviewScreen from '../components/flow/ManualReviewScreen';
import ErrorScreen from '../components/flow/ErrorScreen';

const ConversionFlow: React.FC = () => {
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
    case 'polling':
      return <ProcessingScreen proofId={flow.proofId ?? ''} />;
    case 'approved':
      return (
        <ApprovedScreen
          onReset={flow.reset}
          confidenceScore={flow.confidenceScore}
        />
      );
    case 'rejected':
      return (
        <RejectedScreen
          onReset={flow.reset}
          confidenceScore={flow.confidenceScore}
        />
      );
    case 'manual_review':
      return <ManualReviewScreen onReset={flow.reset} />;
    case 'timeout':
      return (
        <ErrorScreen
          title="Tempo esgotado"
          description="A análise demorou mais que o esperado. Tente retomar em alguns instantes."
          onRetry={flow.retry}
          onReset={flow.reset}
          canRetry={true}
        />
      );
    case 'error':
      return (
        <ErrorScreen
          title="Falha no envio"
          description={flow.error ?? 'Não foi possível concluir a operação.'}
          onRetry={flow.retry}
          onReset={flow.reset}
          canRetry={flow.proofId !== null}
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