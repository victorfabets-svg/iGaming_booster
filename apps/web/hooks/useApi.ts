import { useState, useEffect } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const useApi = <T,>(request: string): UseApiResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Placeholder - real implementation would be in services/
        setData(null);
      } catch (err) {
        setError('Error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [request]);

  return { data, loading, error };
};

export default useApi;