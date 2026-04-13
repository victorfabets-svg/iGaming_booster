import React from 'react';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';

const IndexPage: React.FC = () => {
  return (
    <Layout>
      <Card>
        <h1>Welcome</h1>
        <Button>Continue</Button>
      </Card>
    </Layout>
  );
};

export default IndexPage;