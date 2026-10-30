// App shell: forest sidebar on desktop, bottom tab bar on phones.

import { useState, type ReactNode } from 'react';
import {
  LuHouse, LuTrees, LuCalendarClock, LuListTodo, LuClipboardList, LuBug, LuShoppingBasket, LuPackage,
  LuWallet, LuCloudSun, LuUsers, LuSettings, LuLogOut, LuEllipsis, LuX, LuSun, LuMoon, LuSunMoon,
} from 'react-icons/lu';
import { t, SKY_ICON } from '@kebun/shared';
import { Link, useRoute } from '../lib/router';
import { useStore, rows, type Theme } from '../lib/store';
import { SiteSelect } from './ui';
import { useSensor, isStale } from '../lib/sensor';

interface NavItem { to: string; key: string; icon: ReactNode; owner?: boolean }

export const NAV: NavItem[] = [
  { to: '/', key: 'nav.dashboard', icon: <LuHouse /> },
  { to: '/garden', key: 'nav.garden', icon: <LuTrees /> },
  { to: '/schedules', key: 'nav.schedules', icon: <LuCalendarClock /> },
  { to: '/tasks', key: 'nav.tasks', icon: <LuListTodo /> },
  { to: '/reports', key: 'nav.reports', icon: <LuClipboardList /> },
  { to: '/trees', key: 'nav.trees', icon: <DurianIcon /> },
  { to: '/records', key: 'nav.records', icon: <LuBug /> },
  { to: '/harvest', key: 'nav.harvest', icon: <LuShoppingBasket /> },
  { to: '/stock', key: 'nav.stock', icon: <LuPackage /> },
  { to: '/finance', key: 'nav.finance', icon: <LuWallet />, owner: true },
  { to: '/weather', key: 'nav.weather', icon: <LuCloudSun /> },
  { to: '/users', key: 'nav.users', icon: <LuUsers />, owner: true },
  { to: '/settings', key: 'nav.settings', icon: <LuSettings /> },
];

const MOBILE_TABS = ['/', '/garden', '/schedules', '/tasks'];

const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON: Record<Theme, ReactNode> = { system: <LuSunMoon />, light: <LuSun />, dark: <LuMoon /> };

function DurianIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v2" />
      <ellipse cx="12" cy="13.5" rx="6.5" ry="8" />
      <path d="M9 10l1 1M15 10l-1 1M12 14v.01M9 17l1-1M15 17l-1-1" />
    </svg>
  );
}

function isActive(path: string, to: string) {
  return to === '/' ? path === '/' : path === to || path.startsWith(to + '/');
}

export function Layout({ children }: { children: ReactNode }) {
  const s = useStore();
  const { path } = useRoute();
  const [more, setMore] = useState(false);
  const items = NAV.filter((n) => !n.owner || s.isOwner);
  const sites = rows(s, 'sites');
  const site = sites.find((x) => x.id === s.siteId) ?? sites[0];
  const w = s.weather(site);
  // the garden sensor wins over the forecast while its reading is fresh
  const sensor = useSensor();
  const live = sensor && sensor !== 'error' && !isStale(sensor.latest) ? sensor.latest : null;
  const title = items.find((n) => isActive(path, n.to))?.key;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <img src="./icon.svg" alt="" width={36} height={36} />
          <span>{t('app.name')}</span>
        </Link>
        <nav>
          {items.map((n) => (
            <Link key={n.to} to={n.to} className={`nav-item ${isActive(path, n.to) ? 'active' : ''}`}>
              {n.icon}<span>{t(n.key)}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <div className="avatar">{(s.me?.full_name || '?').slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="me-name">{s.me?.full_name}</div>
              <div className="me-role">{t('role.' + s.me?.role)}{s.repo.kind === 'demo' ? ` · ${t('common.demo')}` : ''}</div>
            </div>
          </div>
          <button className="nav-item logout" onClick={() => s.signOut()}><LuLogOut /><span>{t('common.logout')}</span></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{title ? t(title) : t('app.name')}</div>
          <div className="topbar-right">
            {live ? (
              <Link to="/weather" className="weather-chip" title={`${t('sensor.title')} · ${t('weather.humidity')} ${Math.round(live.humidity)}%`}>
                <span aria-hidden>🌡️</span> {Math.round(live.temp)}°C
              </Link>
            ) : w && w !== 'error' && (
              <Link to="/weather" className="weather-chip" title={t('sky.' + w.now.sky)}>
                <span aria-hidden>{SKY_ICON[w.now.sky]}</span> {Math.round(w.now.temp)}°C
              </Link>
            )}
            {sites.length > 1 && <SiteSelect sites={sites} value={s.siteId} onChange={s.setSiteId} />}
            <div className="lang-toggle" role="group" aria-label={t('common.language')}>
              <button className={s.lang === 'id' ? 'on' : ''} onClick={() => s.setLang('id')}>ID</button>
              <button className={s.lang === 'en' ? 'on' : ''} onClick={() => s.setLang('en')}>EN</button>
            </div>
            <button
              className="icon-btn theme-btn"
              onClick={() => s.setTheme(THEME_NEXT[s.theme])}
              title={`${t('common.theme')}: ${t('theme.' + s.theme)}`}
              aria-label={`${t('common.theme')}: ${t('theme.' + s.theme)}`}
            >
              {THEME_ICON[s.theme]}
            </button>
          </div>
        </header>
        {s.repo.kind === 'demo' && (
          <div className="demo-bar">{t('common.demo')}: {t('common.demoHint')}</div>
        )}
        <main className="content">{children}</main>
      </div>

      <nav className="tabbar">
        {MOBILE_TABS.map((to) => {
          const n = NAV.find((x) => x.to === to)!;
          return (
            <Link key={to} to={to} className={`tab ${isActive(path, to) ? 'active' : ''}`}>
              {n.icon}<span>{t(n.key)}</span>
            </Link>
          );
        })}
        <button className={`tab ${more ? 'active' : ''}`} onClick={() => setMore(true)}><LuEllipsis /><span>{t('nav.more')}</span></button>
      </nav>
      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <header><b>{t('nav.more')}</b><button className="icon-btn" onClick={() => setMore(false)} aria-label={t('common.close')}><LuX /></button></header>
            <div className="sheet-grid">
              {items.filter((n) => !MOBILE_TABS.includes(n.to)).map((n) => (
                <Link key={n.to} to={n.to} className="sheet-item" onClick={() => setMore(false)}>{n.icon}<span>{t(n.key)}</span></Link>
              ))}
              <button className="sheet-item" onClick={() => s.signOut()}><LuLogOut /><span>{t('common.logout')}</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
