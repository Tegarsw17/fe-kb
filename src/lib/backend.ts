// Chooses where data lives:
//   * API      — our REST API (default: same-origin `/api`; override with VITE_API_URL)
//   * Supabase — when VITE_API_URL is set to empty and the Supabase keys are set (web/.env)
//   * Demo     — otherwise, or when the URL has ?demo  (sample data in this browser)

import { createClient } from '@supabase/supabase-js';
import { DemoRepo, SupabaseRepo, type KV, type Repo } from '@kebun/shared';
import { ApiRepo } from './apiRepo';

const API_ = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api').trim();
const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const apiConfigured = !!API_;
export const supabaseConfigured = !!(URL_ && KEY_ && !URL_.includes('xxxx'));
/** A real backend (API or Supabase) is available, so demo mode is optional. */
export const backendConfigured = apiConfigured || supabaseConfigured;

/** localStorage wrapped in try/catch (private mode / blocked storage still works). */
export const safeStorage: KV = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function wantsDemo(): boolean {
  return !backendConfigured || /[?&#]demo\b/.test(location.search + location.hash) || safeStorage.get('kd-mode') === 'demo';
}

export function createRepo(): Repo {
  if (wantsDemo()) return new DemoRepo(safeStorage);
  // ApiRepo.kind is 'api'; screens only check for 'demo', so the shared Repo type is fine here.
  if (apiConfigured) return new ApiRepo(API_, safeStorage) as unknown as Repo;
  const sb = createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true } });
  return new SupabaseRepo(sb);
}
