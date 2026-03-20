import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { am } from '@/lib/appmetrica';

export default function AppMetricaTracker() {
  const location = useLocation();

  useEffect(() => {
    am.hit(location.pathname);
  }, [location.pathname]);

  return null;
}
