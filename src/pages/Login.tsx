// Login screen. Workers use a username; the owner can use username or email.

import { useState, type FormEvent } from 'react';
import { t } from '@kebun/shared';
import { useStore, errorText } from '../lib/store';
import { safeStorage, backendConfigured } from '../lib/backend';
import { Button } from '../components/ui';

export default function Login() {
  const s = useStore();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { await s.signIn(login, password); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-art" aria-hidden>
        <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice">
          <path d="M0 200 Q100 160 200 190 T400 180 V260 H0Z" fill="#2c5139" />
          <path d="M0 225 Q120 200 240 220 T400 215 V260 H0Z" fill="#3f6e43" />
          {[40, 95, 150, 215, 280, 340].map((x, i) => (
            <g key={x} transform={`translate(${x} ${200 - (i % 2) * 10})`}>
              <rect x="-3" y="0" width="6" height="26" fill="#7b5236" />
              <circle cx="0" cy="-6" r={20 - (i % 3) * 2} fill={['#4c8c2f', '#5a9a3c', '#3f7a3a'][i % 3]} />
              <circle cx="0" cy="-26" r={14 - (i % 3)} fill={['#5a9a3c', '#6aa84f', '#4c8c2f'][i % 3]} />
              {i % 2 === 0 && <circle cx="10" cy="4" r="4" fill="#d9b83a" />}
            </g>
          ))}
        </svg>
      </div>
      <form className="login-card" onSubmit={submit}>
        <img src="./icon.svg" width={56} height={56} alt="" />
        <h1>{t('app.name')}</h1>
        <p className="muted">{t('app.tagline')}</p>
        <label>{t('auth.username')}<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required /></label>
        <label>{t('auth.password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="form-error">{error}</p>}
        {s.repo.kind === 'demo' && <p className="muted small">{t('mobile.demoLogin')}</p>}
        <Button variant="primary" busy={busy} type="submit">{t('auth.login')}</Button>
        {backendConfigured && s.repo.kind !== 'demo' && (
          <button type="button" className="linklike small" onClick={() => { safeStorage.set('kd-mode', 'demo'); location.reload(); }}>{t('auth.tryDemo')}</button>
        )}
        {s.repo.kind === 'demo' && backendConfigured && (
          <button type="button" className="linklike small" onClick={() => { safeStorage.remove('kd-mode'); location.reload(); }}>← Server</button>
        )}
        <div className="lang-toggle center">
          <button type="button" className={s.lang === 'id' ? 'on' : ''} onClick={() => s.setLang('id')}>ID</button>
          <button type="button" className={s.lang === 'en' ? 'on' : ''} onClick={() => s.setLang('en')}>EN</button>
        </div>
      </form>
    </div>
  );
}
