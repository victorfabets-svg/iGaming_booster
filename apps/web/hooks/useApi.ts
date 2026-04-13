import { useState } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (request: () => Promise<T>) => Promise<void>;
}

const useApi = <T,>(): UseApiResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (request: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await request();
      setData(result);
    } catch (err) {
      setError('Error');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
};

export default useApi;