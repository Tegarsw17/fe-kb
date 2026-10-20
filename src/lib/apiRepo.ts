// Repo implementation for our own REST API (github.com/Tegarsw17/api-kb).
// Login returns a token that is kept in localStorage and sent as
// `Authorization: Bearer <token>`. Access rules live in the database (RLS).

import { ORDER, PK, type KV, type Profile, type Repo, type Row, type TableName } from '@kebun/shared';

const TOKEN_KEY = 'kd-token';
const PAGE = 1000; // API maximum for ?limit= and for one bulk insert

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export class ApiRepo implements Omit<Repo, 'kind'> {
  readonly kind = 'api' as const;
  private listeners = new Set<() => void>();

  constructor(private base: string, private store: KV) {
    this.base = base.replace(/\/+$/, '');
  }

  private get token() { return this.store.get(TOKEN_KEY); }

  private async request<R = any>(method: string, path: string, body?: unknown): Promise<R> {
    const headers: Record<string, string> = {};
    const token = this.token;
    if (token) headers.authorization = `Bearer ${token}`;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }

    const res = await fetch(this.base + path, { method, headers, body: payload });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      // Token expired or account removed: forget it and let the app show the login screen.
      if (res.status === 401 && token && !path.startsWith('/auth/login')) {
        this.store.remove(TOKEN_KEY);
        this.listeners.forEach((cb) => cb());
      }
      throw new ApiError(res.status, data?.error ?? (text || `HTTP ${res.status}`));
    }
    return data as R;
  }

  async me(): Promise<Profile | null> {
    if (!this.token) return null;
    try {
      return await this.request<Profile>('GET', '/auth/me');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  }

  async signIn(login: string, password: string): Promise<Profile> {
    const { token } = await this.request<{ token: string }>('POST', '/auth/login', {
      username: login.trim().toLowerCase(), password,
    });
    this.store.set(TOKEN_KEY, token);
    const p = await this.me();
    if (!p) throw new Error('Profile not found');
    if (!p.active) { await this.signOut(); throw new Error('Account blocked'); }
    return p;
  }

  async signOut() { this.store.remove(TOKEN_KEY); }

  onAuthChange(cb: () => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  async list<T extends TableName>(table: T): Promise<Row<T>[]> {
    const [col, desc] = ORDER[table];
    const out: Row<T>[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const rows = await this.request<Row<T>[]>('GET',
        `/${table}?order=${col}.${desc ? 'desc' : 'asc'}&limit=${PAGE}&offset=${offset}`);
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  }

  async insert<T extends TableName>(table: T, values: Partial<Row<T>>): Promise<Row<T>> {
    return this.request<Row<T>>('POST', `/${table}`, clean(table, values, table === 'varieties'));
  }

  async insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]): Promise<Row<T>[]> {
    // An array body is inserted in one transaction (all rows or none).
    const out: Row<T>[] = [];
    for (let i = 0; i < values.length; i += PAGE) {
      const chunk = values.slice(i, i + PAGE).map((v) => clean(table, v, table === 'varieties'));
      out.push(...await this.request<Row<T>[]>('POST', `/${table}`, chunk));
    }
    return out;
  }

  async update<T extends TableName>(table: T, id: string, values: Partial<Row<T>>): Promise<Row<T>> {
    return this.request<Row<T>>('PATCH', `/${table}/${encodeURIComponent(id)}`, clean(table, values, false));
  }

  async remove(table: TableName, id: string) {
    await this.request('DELETE', `/${table}/${encodeURIComponent(id)}`);
  }

  async completeTask(taskId: string, note: string, photo: string | null) {
    await this.request('POST', '/rpc/complete_task', { task_id: taskId, note, photo });
  }

  async setMyLanguage(lang: 'id' | 'en') {
    await this.request('POST', '/rpc/set_my_language', { language: lang });
  }

  async uploadPhoto(data: Blob | ArrayBuffer, contentType = 'image/jpeg'): Promise<string> {
    const form = new FormData();
    form.append('file', data instanceof Blob ? data : new Blob([data], { type: contentType }), 'photo.jpg');
    const { path } = await this.request<{ path: string }>('POST', '/photos', form);
    return path;
  }

  async photoUrl(path: string): Promise<string> {
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    // <img> can't send headers, so the API accepts the token in the query string for photos.
    return `${this.base}/photos/${path}?token=${encodeURIComponent(this.token ?? '')}`;
  }

  /** Same actions the Supabase `admin-users` function understood. */
  async adminUsers(body: Record<string, unknown>) {
    switch (body.action) {
      case 'create': {
        const { username, full_name, password, role } = body;
        return this.request('POST', '/users', { username, full_name, password, role });
      }
      case 'set_password':
        return this.request('PUT', `/users/${encodeURIComponent(String(body.user_id))}/password`, { password: body.password });
      case 'set_active':
        return this.request('PATCH', `/profiles/${encodeURIComponent(String(body.user_id))}`, { active: body.active });
      default:
        throw new Error(`Unknown action: ${String(body.action)}`);
    }
  }
}

/** Remove computed / read-only columns before writing (the API rejects them). */
function clean(table: TableName, v: Record<string, any>, keepPk: boolean) {
  const out: Record<string, any> = { ...v };
  delete out.created_at;
  if (!keepPk) delete out[PK[table]];
  if (table === 'sales') delete out.total;
  if (table === 'supplies') delete out.stock; // stock changes only through movements
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}
