// The garden on screen: 3D (lazy-loaded Three.js) or 2D map, with toolbar,
// legend and tree selection. Used full-size on the Garden page and compact
// on the dashboard.

import { useEffect, useMemo, useRef, useState } from 'react';
import { LuRotateCcw, LuSparkles, LuBox, LuGrid3X3, LuSun, LuMoon, LuClock } from 'react-icons/lu';
import { t, treeNeeds, type Sky, type Site } from '@kebun/shared';
import { useStore, rows } from '../lib/store';
import { safeStorage } from '../lib/backend';
import { Garden2D } from './Garden2D';
import type { GardenScene, Quality } from './GardenScene';

type Mode = '3d' | '2d';

function defaultQuality(): Quality {
  const saved = safeStorage.get('kd-quality');
  if (saved === 'low' || saved === 'high') return saved;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory || 4;
  return coarse || cores <= 4 || mem <= 4 ? 'low' : 'high';
}

function nowHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

export function GardenView({ site, selectedId, onSelect, compact = false }: {
  site: Site;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  compact?: boolean;
}) {
  const s = useStore();
  const holder = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GardenScene | null>(null);
  const [mode, setMode] = useState<Mode>(() => (safeStorage.get('kd-view') as Mode) || '3d');
  const [quality, setQuality] = useState<Quality>(defaultQuality);
  const [effects, setEffects] = useState(() => safeStorage.get('kd-fx') !== 'off');
  const [hour, setHour] = useState<number | null>(null); // null = follow the real clock
  const [clock, setClock] = useState(nowHour());
  const [skyOverride, setSkyOverride] = useState<Sky | 'auto'>('auto');
  const [status, setStatus] = useState<'loading' | 'ok' | 'failed'>('loading');

  const trees = useMemo(() => rows(s, 'trees').filter((x) => x.site_id === site.id), [s.data.trees, site.id]);
  const varieties = rows(s, 'varieties');
  const schedules = rows(s, 'schedules');
  const needs = useMemo(() => treeNeeds(trees, schedules), [trees, schedules]);
  const weather = s.weather(site);
  const sky: Sky = skyOverride !== 'auto' ? skyOverride : weather && weather !== 'error' ? weather.now.sky : 'partly';
  const wind = weather && weather !== 'error' ? weather.now.wind : 6;
  const effHour = hour ?? clock;

  // keep the clock moving (once a minute is enough)
  useEffect(() => {
    const id = setInterval(() => setClock(nowHour()), 60000);
    return () => clearInterval(id);
  }, []);

  // create / destroy the 3D scene
  useEffect(() => {
    if (mode !== '3d' || !holder.current) return;
    let disposed = false;
    setStatus('loading');
    import('./GardenScene')
      .then(({ GardenScene, hasWebGL }) => {
        if (disposed || !holder.current) return;
        if (!hasWebGL()) { setStatus('failed'); s.toast(t('garden.noWebgl'), 'error'); setMode('2d'); return; }
        sceneRef.current = new GardenScene(holder.current, { quality, onSelect: (id) => onSelectRef.current(id) });
        setStatus('ok');
      })
      .catch(() => { setStatus('failed'); setMode('2d'); s.toast(t('garden.loadFailed'), 'error'); });
    return () => { disposed = true; sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line
  }, [mode, quality]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // push data / environment / selection into the scene
  useEffect(() => {
    sceneRef.current?.setData({ site, trees, varieties, needs });
  }, [status, site, trees, varieties, needs]);
  useEffect(() => {
    sceneRef.current?.setEnv({ hour: effHour, sky, wind, effects });
  }, [status, effHour, sky, wind, effects]);
  useEffect(() => {
    sceneRef.current?.select(selectedId, !compact && !!selectedId);
  }, [status, selectedId, compact]);

  const switchMode = (m: Mode) => { setMode(m); safeStorage.set('kd-view', m); };
  const toggleFx = () => { setEffects((v) => { safeStorage.set('kd-fx', v ? 'off' : 'on'); return !v; }); };
  const toggleQuality = () => { const q = quality === 'low' ? 'high' : 'low'; setQuality(q); safeStorage.set('kd-quality', q); };
  const isNight = effHour < 6 || effHour >= 18.5;

  return (
    <div className={`garden ${compact ? 'garden-compact' : ''}`}>
      <div className="garden-toolbar">
        <div className="seg" role="group" aria-label="mode">
          <button className={mode === '3d' ? 'on' : ''} onClick={() => switchMode('3d')}><LuBox /> {t('garden.mode3d')}</button>
          <button className={mode === '2d' ? 'on' : ''} onClick={() => switchMode('2d')}><LuGrid3X3 /> {t('garden.mode2d')}</button>
        </div>
        {mode === '3d' && (
          <>
            <button className="tool" onClick={() => sceneRef.current?.resetView()} title={t('garden.reset')}><LuRotateCcw /><span>{t('garden.reset')}</span></button>
            {!compact && (
              <>
                <button className={`tool ${effects ? 'on' : ''}`} onClick={toggleFx} title={t('garden.effects')}><LuSparkles /><span>{t('garden.effects')}</span></button>
                <button className="tool" onClick={toggleQuality} title={t('garden.quality')}>{quality === 'low' ? t('garden.qLow') : t('garden.qHigh')}</button>
              </>
            )}
          </>
        )}
      </div>

      <div className="garden-stage">
        {mode === '3d' ? (
          <>
            <div ref={holder} className="garden-canvas" />
            {status === 'loading' && <div className="garden-loading">{t('garden.loading3d')}</div>}
          </>
        ) : (
          <div className="garden-2d-wrap">
            <Garden2D site={site} trees={trees} varieties={varieties} needs={needs} selectedId={selectedId} onSelect={onSelect} />
          </div>
        )}
        {trees.length === 0 && <div className="garden-empty">{t('garden.emptySite')}</div>}

        {!compact && mode === '3d' && (
          <div className="garden-time">
            {isNight ? <LuMoon /> : <LuSun />}
            <input type="range" min={0} max={23.9} step={0.1} value={effHour} aria-label={t('garden.time')}
              onChange={(e) => setHour(Number(e.target.value))} />
            <span className="time-label">{String(Math.floor(effHour)).padStart(2, '0')}:{String(Math.floor((effHour % 1) * 60)).padStart(2, '0')}</span>
            {hour !== null && <button className="tool" onClick={() => setHour(null)}><LuClock /> {t('garden.timeNow')}</button>}
            <select className="select select-sm" value={skyOverride} onChange={(e) => setSkyOverride(e.target.value as any)} aria-label={t('nav.weather')}>
              <option value="auto">{t('garden.weatherAuto')}</option>
              {(['clear', 'partly', 'cloudy', 'rain', 'storm', 'fog'] as Sky[]).map((k) => <option key={k} value={k}>{t('sky.' + k)}</option>)}
            </select>
          </div>
        )}
      </div>

      <Legend />
      {!compact && <p className="garden-hint muted">{t('garden.hint')}</p>}
    </div>
  );
}

function Legend() {
  return (
    <ul className="legend">
      <li><span className="lg lg-water" />{t('garden.needsWater')}</li>
      <li><span className="lg lg-care" />{t('garden.needsCare')}</li>
      <li><span className="lg lg-sick" />{t('garden.sick')}</li>
      <li><span className="lg lg-flower" />{t('garden.flowering')}</li>
      <li><span className="lg lg-fruit" />{t('garden.fruiting')}</li>
      <li><span className="lg lg-ready" />{t('garden.ready')}</li>
    </ul>
  );
}
