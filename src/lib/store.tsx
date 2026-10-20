// App-wide state: who is logged in, language, selected site, cached table
// data, and helpers to add/edit/delete rows (which also refresh the tables
// the database changes automatically, e.g. stock after logging fertilizing).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  SIDE_EFFECTS, fetchWeather, setLang as setI18nLang, t,
  type Lang, type Profile, type Repo, type Row, type TableName, type Weather, type Site,
} from '@kebun/shared';
import { safeStorage } from './backend';

type Data = { [K in TableName]?: Row<K>[] };

interface Toast { id: number; text: string; kind: 'ok' | 'error' }

export type Theme = 'system' | 'light' | 'dark';

/** 'system' leaves the attribute off so styles.css follows prefers-color-scheme. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme; else root.dataset.theme = theme;
}

interface StoreValue {
  repo: Repo;
  me: Profile | null;
  isOwner: boolean;
  authReady: boolean;
  lang: Lang;
  setLang(l: Lang): void;
  theme: Theme;
  setTheme(t: Theme): void;
  siteId: string | 'all';
  setSiteId(id: string | 'all'): void;
  data: Data;
  load(tables: TableName[], force?: boolean): Promise<void>;
  insert<T extends TableName>(table: T, values: Partial<Row<T>>, msg?: string | false): Promise<Row<T>>;
  insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: string, values: Partial<Row<T>>, msg?: string | false): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;
  completeTask(id: string, note: string, photo: string | null): Promise<void>;
  signIn(login: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  toast(text: string, kind?: 'ok' | 'error'): void;
  toasts: Toast[];
  weather(site: Site | undefined): Weather | null | 'error';
}

const Ctx = createContext<StoreValue | null>(null);

/** Turn database errors into friendly messages. */
export function errorText(e: unknown): string {
  const msg = (e as any)?.message ?? String(e);
  if (/trees_site_id_name_key|Key \(site_id, name\)/.test(msg)) return t('tree.nameTaken');
  if (/trees_site_id_row_no_col_no_key|Key \(site_id, row_no, col_no\)/.test(msg)) return t('tree.spotTaken');
  if (/Invalid login credentials|wrong username or password/i.test(msg)) return t('auth.failed');
  if (/row-level security|permission denied|^forbidden$/i.test(msg)) return 'Tidak punya izin untuk ini.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Tidak ada koneksi internet.';
  return msg;
}

export function StoreProvider({ repo, children }: { repo: Repo; children: ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [lang, setLangState] = useState<Lang>((safeStorage.get('kd-lang') as Lang) || 'id');
  const [theme, setThemeState] = useState<Theme>((safeStorage.get('kd-theme') as Theme) || 'system');
  const [siteId, setSiteIdState] = useState<string>(safeStorage.get('kd-site') || 'all');
  const [data, setData] = useState<Data>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [weatherMap, setWeatherMap] = useState<Record<string, Weather | 'error' | 'loading'>>({});
  const loaded = useRef(new Set<TableName>());
  const inflight = useRef(new Map<TableName, Promise<void>>());
  const weatherAsked = useRef(new Set<string>());

  setI18nLang(lang); // keep the translator in sync before children render
  applyTheme(theme); // same for colors, so there is no flash of the wrong theme

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, text, kind }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), kind === 'error' ? 6000 : 2600);
  }, []);

  // ---- auth
  const refreshMe = useCallback(async () => {
    try {
      const p = await repo.me();
      setMe(p);
      if (p?.language) { setLangState(p.language); safeStorage.set('kd-lang', p.language); }
    } catch (e) {
      setMe(null);
    } finally {
      setAuthReady(true);
    }
  }, [repo]);

  useEffect(() => {
    refreshMe();
    return repo.onAuthChange(() => {
      loaded.current.clear();
      setData({});
      refreshMe();
    });
  }, [repo, refreshMe]);

  // ---- data
  const fetchTable = useCallback(async (table: TableName) => {
    const rows = await repo.list(table);
    loaded.current.add(table);
    setData((d) => ({ ...d, [table]: rows }));
  }, [repo]);

  const load = useCallback(async (tables: TableName[], force = false) => {
    const jobs = tables.map((tb) => {
      if (!force && loaded.current.has(tb)) return Promise.resolve();
      const running = inflight.current.get(tb);
      if (running && !force) return running;
      const p = fetchTable(tb).catch((e) => toast(errorText(e), 'error')).finally(() => inflight.current.delete(tb));
      inflight.current.set(tb, p);
      return p;
    });
    await Promise.all(jobs);
  }, [fetchTable, toast]);

  const afterWrite = useCallback(async (table: TableName) => {
    await load([table, ...(SIDE_EFFECTS[table] ?? [])].filter((x) => loaded.current.has(x) || x === table), true);
  }, [load]);

  const wrap = useCallback(async <R,>(fn: () => Promise<R>, table: TableName, msg?: string | false): Promise<R> => {
    try {
      const r = await fn();
      await afterWrite(table);
      if (msg !== false) toast(msg || t('common.saved'));
      return r;
    } catch (e) {
      toast(errorText(e), 'error');
      throw e;
    }
  }, [afterWrite, toast]);

  const value = useMemo<StoreValue>(() => ({
    repo, me, authReady,
    isOwner: me?.role === 'owner',
    lang,
    setLang(l) {
      setLangState(l);
      safeStorage.set('kd-lang', l);
      if (me) repo.setMyLanguage(l).catch(() => {});
    },
    theme,
    setTheme(th) { setThemeState(th); safeStorage.set('kd-theme', th); },
    siteId,
    setSiteId(id) { setSiteIdState(id); safeStorage.set('kd-site', id); },
    data,
    load,
    insert: (table, values, msg) => wrap(() => repo.insert(table, values), table, msg),
    insertMany: (table, values) => wrap(() => repo.insertMany(table, values), table),
    update: (table, id, values, msg) => wrap(() => repo.update(table, id, values), table, msg),
    remove: (table, id) => wrap(() => repo.remove(table, id), table, t('common.deleted')),
    completeTask: (id, note, photo) => wrap(() => repo.completeTask(id, note, photo), 'tasks'),
    async signIn(login, password) {
      const p = await repo.signIn(login, password);
      loaded.current.clear();
      setData({});
      setMe(p);
      if (p.language) { setLangState(p.language); safeStorage.set('kd-lang', p.language); }
    },
    async signOut() {
      await repo.signOut();
      loaded.current.clear();
      setData({});
      setMe(null);
    },
    toast,
    toasts,
    weather(site) {
      if (!site || site.lat == null || site.lng == null) return null;
      const key = `${site.lat},${site.lng}`;
      const w = weatherMap[key];
      if (w === undefined && !weatherAsked.current.has(key)) {
        weatherAsked.current.add(key);
        setTimeout(() => {
          setWeatherMap((m) => (m[key] ? m : { ...m, [key]: 'loading' }));
          fetchWeather(site.lat!, site.lng!)
            .then((res) => setWeatherMap((m) => ({ ...m, [key]: res })))
            .catch(() => setWeatherMap((m) => ({ ...m, [key]: 'error' })));
        }, 0);
        return null;
      }
      return w === undefined || w === 'loading' ? null : w;
    },
  }), [repo, me, authReady, lang, theme, siteId, data, load, wrap, toast, toasts, weatherMap]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}

/** Load tables on mount and return the store. `ready` is true when all are loaded. */
export function useTables(tables: TableName[]) {
  const s = useStore();
  const key = tables.join(',');
  useEffect(() => { if (s.me) s.load(tables); /* eslint-disable-next-line */ }, [key, s.me?.id]);
  const ready = tables.every((tb) => s.data[tb] !== undefined);
  return { ...s, ready };
}

/** Rows of a table (empty array while loading). */
export function rows<T extends TableName>(s: { data: Data }, table: T): Row<T>[] {
  return (s.data[table] as Row<T>[] | undefined) ?? [];
}

/** Filter rows by the selected site (if the row has site_id). */
export function bySite<R extends { site_id?: string | null }>(list: R[], siteId: string): R[] {
  return siteId === 'all' ? list : list.filter((r) => r.site_id === siteId);
}
