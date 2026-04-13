import React, { useEffect } from 'react';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import ProofUpload from '../components/ProofUpload';
import createApiClient from '../services/api';
import useApi from '../hooks/useApi';

const IndexPage: React.FC = () => {
  const api = createApiClient('');
  const healthApi = useApi();
  const statusApi = useApi();

  useEffect(() => {
    healthApi.execute(api.getHealth);
    statusApi.execute(api.getHealth);
  }, []);

  const loading = healthApi.loading || statusApi.loading;
  const error = healthApi.error || statusApi.error;
  const data = healthApi.data && statusApi.data;

  const handleSubmit = (file: File) => {
    // empty for now
  };

  return (
    <Layout>
      <Card>
        {loading && <p>Loading...</p>}
        {error && <p>Error</p>}
        {data && <p>Loaded</p>}
        <h1>Welcome</h1>
        <Button>Continue</Button>
        <ProofUpload onSubmit={handleSubmit} />
      </Card>
    </Layout>
  );
};

export default IndexPage;