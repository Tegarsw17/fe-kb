// Routes: which page shows for which URL.

import { useEffect } from 'react';
import { t } from '@kebun/shared';
import { useStore } from './lib/store';
import { useRoute } from './lib/router';
import { Layout } from './components/Layout';
import { Toasts } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Garden from './pages/Garden';
import Trees, { TreeDetail } from './pages/Trees';
import Schedules from './pages/Schedules';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import Records from './pages/Records';
import Harvest from './pages/Harvest';
import Stock from './pages/Stock';
import Finance from './pages/Finance';
import Weather from './pages/Weather';
import Users from './pages/Users';
import Settings from './pages/Settings';

function Page() {
  const { parts } = useRoute();
  const s = useStore();
  switch (parts[0]) {
    case undefined: return <Dashboard />;
    case 'garden': return <Garden />;
    case 'trees': return parts[1] ? <TreeDetail id={parts[1]} /> : <Trees />;
    case 'schedules': return <Schedules />;
    case 'tasks': return <Tasks />;
    case 'reports': return <Reports />;
    case 'records': return <Records />;
    case 'harvest': return <Harvest />;
    case 'stock': return <Stock />;
    case 'finance': return s.isOwner ? <Finance /> : <Dashboard />;
    case 'weather': return <Weather />;
    case 'users': return s.isOwner ? <Users /> : <Dashboard />;
    case 'settings': return <Settings />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const s = useStore();
  useEffect(() => { document.documentElement.lang = s.lang; document.title = t('app.name'); }, [s.lang]);

  if (!s.authReady) return <div className="splash"><img src="./icon.svg" width={64} height={64} alt="" /></div>;
  if (!s.me) return <><Login /><Toasts /></>;
  return (
    <>
      <Layout><Page /></Layout>
      <Toasts />
    </>
  );
}
