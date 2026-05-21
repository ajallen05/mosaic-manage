import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/Layout/DashboardLayout.jsx';
import useAppStore from '../store/useAppStore.js';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const setActiveTab = useAppStore(s => s.setActiveTab);

  // Switch to the social tab when returning from OAuth so that SocialConnections
  // mounts and can handle the ?connected / ?error params (and show the toast).
  useEffect(() => {
    if (searchParams.get('connected') || searchParams.get('error')) {
      setActiveTab('social');
    }
  }, []);

  return <DashboardLayout />;
}
