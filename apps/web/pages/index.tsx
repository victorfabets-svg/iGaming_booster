import React, { useEffect } from 'react';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import createApiClient from '../services/api';
import useApi from '../hooks/useApi';

const IndexPage: React.FC = () => {
  const api = createApiClient('');
  const { data, loading, error, execute } = useApi();

  useEffect(() => {
    execute(api.getHealth);
  }, []);

  return (
    <Layout>
      <Card>
        {loading && <p>Loading...</p>}
        {error && <p>Error</p>}
        {data && <p>Loaded</p>}
        <h1>Welcome</h1>
        <Button>Continue</Button>
      </Card>
    </Layout>
  );
};

export default IndexPage;