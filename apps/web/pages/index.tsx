import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import ProofUpload from '../components/ProofUpload';
import createApiClient from '../services/api';
import useApi from '../hooks/useApi';

const IndexPage: React.FC = () => {
  const api = createApiClient('');
  const uploadApi = useApi();

  const [proofId, setProofId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = (file: File) => {
    uploadApi.execute(() => api.submitProof(file));
  };

  useEffect(() => {
    if (uploadApi.data) {
      uploadApi.data.json().then((json: any) => {
        setProofId(json?.proof_id ?? null);
        setStatus(json?.status ?? null);
      }).catch(() => {})
    }
  }, [uploadApi.data]);

  return (
    <Layout>
      <Card>
        <h1>Welcome</h1>
        <Button>Continue</Button>
        {uploadApi.loading && <p>Uploading...</p>}
        {uploadApi.error && <p>Upload failed</p>}
        {proofId && <p>Comprovante enviado</p>}
        {status && <p>Status: em análise</p>}
        <ProofUpload onSubmit={handleSubmit} loading={uploadApi.loading} />
      </Card>
    </Layout>
  );
};

export default IndexPage;