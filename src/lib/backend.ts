// Chooses where data lives:
//   * Supabase — when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (web/.env)
//   * Demo     — otherwise, or when the URL has ?demo  (sample data in this browser)

import { createClient } from '@supabase/supabase-js';
import { DemoRepo, SupabaseRepo, type KV, type Repo } from '@kebun/shared';

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const supabaseConfigured = !!(URL_ && KEY_ && !URL_.includes('xxxx'));

/** localStorage wrapped in try/catch (private mode / blocked storage still works). */
export const safeStorage: KV = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function wantsDemo(): boolean {
  return !supabaseConfigured || /[?&#]demo\b/.test(location.search + location.hash) || safeStorage.get('kd-mode') === 'demo';
}

export function createRepo(): Repo {
  if (wantsDemo()) return new DemoRepo(safeStorage);
  const sb = createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true } });
  return new SupabaseRepo(sb);
}
