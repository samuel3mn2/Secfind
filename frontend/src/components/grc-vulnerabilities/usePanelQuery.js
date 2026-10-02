import { useEffect, useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/dashboard/vulnerabilidades`;

export const usePanelQuery = (endpoint, query, revision = 0) => {
  const [result, setResult] = useState({ data: null, key: '', loading: true, error: '' });
  const [retry, setRetry] = useState(0);
  const key = `${endpoint}?${query}`;
  useEffect(() => {
    const controller = new AbortController();
    setResult(prev => ({ ...prev, loading: true, error: '' }));
    axios.get(`${API}/${key}`, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ data, key, loading: false, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ data: null, key, loading: false,
        error: error.response?.status === 403 ? 'No tienes permiso para consultar estos datos.' : 'No se pudieron cargar los datos.' });
    });
    return () => controller.abort();
  }, [key, revision, retry]);
  return { ...result, loading: result.loading || result.key !== key,
    data: result.key === key ? result.data : null, retry: () => setRetry(value => value + 1) };
};