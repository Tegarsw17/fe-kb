// Entry point: pick the data backend, sign in automatically in demo mode, render.

import { createRoot } from 'react-dom/client';
import { DemoRepo } from '@kebun/shared';
import { createRepo } from './lib/backend';
import { StoreProvider } from './lib/store';
import App from './App';
import './styles.css';

const repo = createRepo();

async function boot() {
  // Demo mode: log in as the owner straight away so visitors land on the dashboard.
  if (repo instanceof DemoRepo && !(await repo.me())) await repo.signIn('pemilik', '');
  createRoot(document.getElementById('root')!).render(
    <StoreProvider repo={repo}>
      <App />
    </StoreProvider>,
  );
}
boot();
