// Data access layer. Both apps talk to data only through the `Repo` interface,
// so screens don't care whether data comes from Supabase or from the demo store.

import type { Profile, Row, TableName } from './types';
import { ORDER, PK } from './types';

export interface Repo {
  readonly kind: 'supabase' | 'demo';
  /** Current logged-in profile, or null. */
  me(): Promise<Profile | null>;
  signIn(login: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  /** Called when the user logs in or out (e.g. session expired). */
  onAuthChange(cb: () => void): () => void;

  list<T extends TableName>(table: T): Promise<Row<T>[]>;
  insert<T extends TableName>(table: T, values: Partial<Row<T>>): Promise<Row<T>>;
  insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: string, values: Partial<Row<T>>): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;

  completeTask(taskId: string, note: string, photo: string | null): Promise<void>;
  setMyLanguage(lang: 'id' | 'en'): Promise<void>;

  /** Upload an image; returns a storage path to save in a `photos` column. */
  uploadPhoto(data: Blob | ArrayBuffer, contentType?: string): Promise<string>;
  /** Turn a stored photo path into a URL the app can display. */
  photoUrl(path: string): Promise<string>;

  /** Owner-only user management (Supabase: via the admin-users Edge Function). */
  adminUsers(body: Record<string, unknown>): Promise<any>;
}

/**
 * When a row is written to table X, the database also changes these tables
 * (via triggers). The apps reload them so the screen stays correct.
 */
export const SIDE_EFFECTS: Partial<Record<TableName, TableName[]>> = {
  activities: ['supplies', 'supply_movements', 'schedules'],
  supply_movements: ['supplies'],
  tree_events: ['trees'],
  tasks: [],
};

export const WORKER_EMAIL_DOMAIN = 'kebun-durian.local';

/** Usernames without '@' become '<username>@kebun-durian.local'. */
export function loginToEmail(login: string): string {
  const s = login.trim().toLowerCase();
  return s.includes('@') ? s : `${s}@${WORKER_EMAIL_DOMAIN}`;
}

// ---------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------

/**
 * Minimal shape of the Supabase client we use. Typed loosely on purpose so the
 * shared package doesn't need @supabase/supabase-js as a direct dependency.
 */
type SupabaseLike = any;

const PAGE = 1000;

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const;
  constructor(private sb: SupabaseLike, private functionsName = 'admin-users') {}

  async me(): Promise<Profile | null> {
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  }

  async signIn(login: string, password: string): Promise<Profile> {
    const { error } = await this.sb.auth.signInWithPassword({ email: loginToEmail(login), password });
    if (error) throw error;
    const p = await this.me();
    if (!p) throw new Error('Profile not found');
    if (!p.active) { await this.signOut(); throw new Error('Account blocked'); }
    return p;
  }

  async signOut() { await this.sb.auth.signOut(); }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') cb();
    });
    return () => data.subscription.unsubscribe();
  }

  async list<T extends TableName>(table: T): Promise<Row<T>[]> {
    const [col, desc] = ORDER[table];
    const out: Row<T>[] = [];
    // Page through results (Supabase returns max 1000 rows per request).
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb.from(table).select('*')
        .order(col, { ascending: !desc }).range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...(data as Row<T>[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  async insert<T extends TableName>(table: T, values: Partial<Row<T>>): Promise<Row<T>> {
    const { data, error } = await this.sb.from(table).insert(clean(table, values)).select().single();
    if (error) throw error;
    return data as Row<T>;
  }

  async insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]): Promise<Row<T>[]> {
    if (!values.length) return [];
    const { data, error } = await this.sb.from(table).insert(values.map((v) => clean(table, v))).select();
    if (error) throw error;
    return data as Row<T>[];
  }

  async update<T extends TableName>(table: T, id: string, values: Partial<Row<T>>): Promise<Row<T>> {
    const { data, error } = await this.sb.from(table).update(clean(table, values)).eq(PK[table], id).select().single();
    if (error) throw error;
    return data as Row<T>;
  }

  async remove(table: TableName, id: string) {
    const { error } = await this.sb.from(table).delete().eq(PK[table], id);
    if (error) throw error;
  }

  async completeTask(taskId: string, note: string, photo: string | null) {
    const { error } = await this.sb.rpc('complete_task', { p_task_id: taskId, p_note: note, p_photo: photo });
    if (error) throw error;
  }

  async setMyLanguage(lang: 'id' | 'en') {
    await this.sb.rpc('set_my_language', { p_language: lang });
  }

  async uploadPhoto(data: Blob | ArrayBuffer, contentType = 'image/jpeg'): Promise<string> {
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) throw new Error('Not logged in');
    const d = new Date();
    const path = `${session.user.id}/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/` +
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await this.sb.storage.from('photos').upload(path, data, { contentType, upsert: false });
    if (error) throw error;
    return path;
  }

  private urlCache = new Map<string, { url: string; exp: number }>();
  async photoUrl(path: string): Promise<string> {
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    const hit = this.urlCache.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const { data, error } = await this.sb.storage.from('photos').createSignedUrl(path, 3600);
    if (error) throw error;
    this.urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  }

  async adminUsers(body: Record<string, unknown>) {
    const { data, error } = await this.sb.functions.invoke(this.functionsName, { body });
    if (error) {
      // Supabase wraps non-2xx answers; dig out our { error } message.
      let msg = error.message;
      try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
}

/** Remove computed / read-only columns before writing. */
function clean(table: TableName, v: Record<string, any>) {
  const out: Record<string, any> = { ...v };
  delete out.created_at;
  if (table === 'sales') delete out.total;
  if (table === 'supplies') delete out.stock; // stock changes only through movements
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}
