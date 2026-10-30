// Demo store: an in-memory copy of the database that behaves like the real one
// (same triggers: stock, schedules, tree status). Used for "Coba mode demo" and
// for trying the app before Supabase is set up. Saved to the browser if a
// storage adapter is given.

import type { Profile, Row, TableName, Tables, Tree, Supply, Schedule, Site, Variety } from './types';
import { ORDER, PK } from './types';
import type { Repo } from './repo';
import { addDays, today, uid } from './dates';

type DB = { [K in TableName]: Tables[K][] };

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const KEY = 'kebun-durian-demo-v1';
const ME_KEY = 'kebun-durian-demo-me';

export class DemoRepo implements Repo {
  readonly kind = 'demo' as const;
  private db: DB;
  private meId: string | null;
  private authCbs = new Set<() => void>();

  constructor(private kv?: KV) {
    let loaded: DB | null = null;
    try { const raw = kv?.get(KEY); if (raw) loaded = JSON.parse(raw); } catch { loaded = null; }
    this.db = loaded ?? seedDemo();
    let me: string | null = null;
    try { me = kv?.get(ME_KEY) ?? null; } catch { me = null; }
    this.meId = me;
  }

  reset() {
    this.db = seedDemo();
    this.save();
  }

  private save() {
    try { this.kv?.set(KEY, JSON.stringify(this.db)); } catch { /* storage full / blocked: keep in memory */ }
  }

  private get uidNow() { return this.meId; }

  async me() {
    return this.db.profiles.find((p) => p.id === this.meId) ?? null;
  }

  async signIn(login: string, _password: string) {
    const name = login.trim().toLowerCase().split('@')[0];
    const p = this.db.profiles.find((x) => x.username === name) ?? this.db.profiles.find((x) => x.role === 'owner')!;
    this.meId = p.id;
    try { this.kv?.set(ME_KEY, p.id); } catch { /* ignore */ }
    this.authCbs.forEach((f) => f());
    return p;
  }

  async signOut() {
    this.meId = null;
    try { this.kv?.remove(ME_KEY); } catch { /* ignore */ }
    this.authCbs.forEach((f) => f());
  }

  onAuthChange(cb: () => void) { this.authCbs.add(cb); return () => { this.authCbs.delete(cb); }; }

  async list<T extends TableName>(table: T): Promise<Row<T>[]> {
    const me = await this.me();
    let rows = [...(this.db[table] as Row<T>[])];
    // Mimic the worker security rules.
    if (me && me.role === 'worker') {
      if (['sales', 'expenses', 'supply_movements'].includes(table)) return [];
      if (table === 'profiles') rows = rows.filter((r: any) => r.id === me.id);
      if (table === 'tasks') rows = rows.filter((r: any) => !r.assigned_to || r.assigned_to === me.id);
      if (table === 'daily_reports') rows = rows.filter((r: any) => r.author === me.id);
    }
    const [col, desc] = ORDER[table];
    rows.sort((a: any, b: any) => {
      const x = a[col] ?? '', y = b[col] ?? '';
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'id', { numeric: true });
      return desc ? -c : c;
    });
    return structuredCloneSafe(rows);
  }

  async insert<T extends TableName>(table: T, values: Partial<Row<T>>): Promise<Row<T>> {
    const [r] = await this.insertMany(table, [values]);
    return r;
  }

  async insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]): Promise<Row<T>[]> {
    const out: Row<T>[] = [];
    for (const v of values) {
      const row = this.withDefaults(table, { ...v }) as Row<T>;
      this.checkUnique(table, row);
      (this.db[table] as Row<T>[]).push(row);
      this.afterInsert(table, row as any);
      out.push(row);
    }
    this.save();
    return structuredCloneSafe(out);
  }

  async update<T extends TableName>(table: T, id: string, values: Partial<Row<T>>): Promise<Row<T>> {
    const list = this.db[table] as any[];
    const i = list.findIndex((r) => r[PK[table]] === id);
    if (i < 0) throw new Error('Not found');
    const next = { ...list[i], ...values };
    if (table === 'supplies') next.stock = list[i].stock;
    if (table === 'sales') next.total = round2((next.weight_kg || 0) * (next.price_per_kg || 0));
    this.checkUnique(table, next, id);
    list[i] = next;
    // ON UPDATE CASCADE for variety codes
    if (table === 'varieties' && values && (values as any).code && (values as any).code !== id) {
      for (const t of this.db.trees) if (t.variety_code === id) t.variety_code = (values as any).code;
    }
    this.save();
    return structuredCloneSafe(next);
  }

  async remove(table: TableName, id: string) {
    const list = this.db[table] as any[];
    const row = list.find((r) => r[PK[table]] === id);
    if (!row) return;
    (this.db as any)[table] = list.filter((r) => r !== row);
    // emulate cascades / triggers
    if (table === 'activities') this.db.supply_movements = this.db.supply_movements.filter((m) => {
      if (m.activity_id === id) { this.bumpStock(m.supply_id, -m.qty); return false; }
      return true;
    });
    if (table === 'supply_movements') this.bumpStock(row.supply_id, -row.qty);
    if (table === 'trees') {
      this.db.tree_events = this.db.tree_events.filter((e) => e.tree_id !== id);
      this.db.schedules = this.db.schedules.filter((s) => s.tree_id !== id);
    }
    if (table === 'sites') {
      for (const t of ['trees', 'schedules', 'activities', 'tree_events', 'harvests'] as const) {
        (this.db as any)[t] = (this.db as any)[t].filter((r: any) => r.site_id !== id);
      }
    }
    if (table === 'supplies') this.db.supply_movements = this.db.supply_movements.filter((m) => m.supply_id !== id);
    this.save();
  }

  async completeTask(taskId: string, note: string, photo: string | null) {
    const t = this.db.tasks.find((x) => x.id === taskId);
    if (!t) throw new Error('Task not found');
    Object.assign(t, { status: 'done', done_at: new Date().toISOString(), done_by: this.uidNow, done_note: note, photo: photo ?? t.photo });
    this.save();
  }

  async setMyLanguage(lang: 'id' | 'en') {
    const p = this.db.profiles.find((x) => x.id === this.meId);
    if (p) { p.language = lang; this.save(); }
  }

  async uploadPhoto(data: Blob | ArrayBuffer, contentType = 'image/jpeg'): Promise<string> {
    // Store as a data URL (demo only — real app uploads to Supabase Storage).
    const blob = data instanceof Blob ? data : new Blob([data], { type: contentType });
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  async photoUrl(path: string) { return path; }

  async adminUsers(body: Record<string, unknown>) {
    if (body.action === 'create') {
      const username = String(body.username ?? '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error('Username: 3–32 huruf/angka');
      if (this.db.profiles.some((p) => p.username === username)) throw new Error('Username sudah dipakai');
      const p: Profile = {
        id: uid(), full_name: String(body.full_name || username), username,
        role: body.role === 'owner' ? 'owner' : 'worker', active: true, language: 'id', created_at: new Date().toISOString(),
      };
      this.db.profiles.push(p);
      this.save();
      return { id: p.id };
    }
    if (body.action === 'set_active') {
      const p = this.db.profiles.find((x) => x.id === body.user_id);
      if (p) p.active = Boolean(body.active);
      this.save();
      return { ok: true };
    }
    return { ok: true };
  }

  // ---------------- internals ----------------

  private withDefaults(table: TableName, v: any) {
    const now = new Date().toISOString();
    const d = today();
    const base: any = { created_at: now };
    if (table !== 'varieties') base.id = uid();
    const defaults: Partial<Record<TableName, any>> = {
      sites: { area_ha: 1, lat: null, lng: null, grid_rows: 12, grid_cols: 12, spacing_m: 8, notes: '' },
      varieties: { color: '#4f8a3c', days_to_ripe: 110, notes: '' },
      trees: { variety_code: null, planted_on: null, phase: 'vegetative', phase_since: d, health: 'healthy', notes: '' },
      supplies: { category: 'fertilizer', unit: 'kg', min_stock: 0, price_per_unit: 0, notes: '' },
      supply_movements: { activity_id: null, note: '', created_by: this.uidNow },
      schedules: { tree_id: null, every_days: 30, next_due: d, supply_id: null, dose: 0, assigned_to: null, active: true, notes: '' },
      activities: { tree_id: null, schedule_id: null, supply_id: null, qty_used: 0, done_on: d, done_by: this.uidNow, note: '', photos: [] },
      tasks: { description: '', site_id: null, tree_id: null, assigned_to: null, due_date: null, status: 'todo', done_at: null, done_by: null, done_note: '', photo: null, created_by: this.uidNow },
      daily_reports: { site_id: null, report_date: d, author: this.uidNow, work_done: '', issues: '', photos: [] },
      tree_events: { event_date: d, severity: null, count: null, title: '', note: '', photos: [], resolved: false, created_by: this.uidNow },
      harvests: { tree_id: null, harvest_date: d, fruit_count: 0, weight_kg: 0, grade: null, note: '', created_by: this.uidNow },
      sales: { site_id: null, sale_date: d, buyer: '', variety_code: null, weight_kg: 0, price_per_kg: 0, note: '', created_by: this.uidNow },
      expenses: { site_id: null, expense_date: d, category: 'other', amount: 0, note: '', supply_id: null, created_by: this.uidNow },
    };
    const row = { ...base, ...(defaults[table] ?? {}), ...stripUndef(v) };
    if (table === 'supplies') row.stock = 0;
    if (table === 'sales') row.total = round2((row.weight_kg || 0) * (row.price_per_kg || 0));
    return row;
  }

  private checkUnique(table: TableName, row: any, selfId?: string) {
    if (table === 'trees') {
      const others = this.db.trees.filter((t) => t.id !== (selfId ?? row.id) && t.site_id === row.site_id);
      if (others.some((t) => t.name.toLowerCase() === String(row.name).toLowerCase())) throw new Error('duplicate key: trees_site_id_name_key');
      if (others.some((t) => t.row_no === row.row_no && t.col_no === row.col_no)) throw new Error('duplicate key: trees_site_id_row_no_col_no_key');
    }
    if (table === 'varieties' && this.db.varieties.some((v) => v.code === row.code && v.code !== selfId)) {
      throw new Error('duplicate key: varieties_pkey');
    }
  }

  private bumpStock(supplyId: string, qty: number) {
    const s = this.db.supplies.find((x) => x.id === supplyId);
    if (s) s.stock = round3(Number(s.stock) + Number(qty));
  }

  private afterInsert(table: TableName, row: any) {
    if (table === 'supply_movements') this.bumpStock(row.supply_id, row.qty);
    if (table === 'activities') {
      if (row.supply_id && row.qty_used > 0) {
        const m = this.withDefaults('supply_movements', {
          supply_id: row.supply_id, qty: -row.qty_used, reason: 'usage', activity_id: row.id, note: 'auto: activity', created_by: row.done_by,
        });
        this.db.supply_movements.push(m);
        this.bumpStock(row.supply_id, -row.qty_used);
      }
      if (row.schedule_id) {
        const s = this.db.schedules.find((x) => x.id === row.schedule_id);
        if (s) { const n = addDays(row.done_on, s.every_days); if (n > s.next_due) s.next_due = n; }
      }
    }
    if (table === 'tree_events') {
      const t = this.db.trees.find((x) => x.id === row.tree_id);
      if (!t) return;
      if (row.kind === 'flowering') { t.phase = 'flowering'; t.phase_since = row.event_date; }
      else if (row.kind === 'fruit_set') { t.phase = 'fruiting'; t.phase_since = row.event_date; }
      else if ((row.kind === 'pest' || row.kind === 'disease') && !row.resolved && t.health !== 'dead') {
        t.health = row.severity === 'high' || t.health === 'sick' ? 'sick' : 'watch';
      }
    }
  }
}

function stripUndef(v: any) {
  const o: any = {};
  for (const k of Object.keys(v)) if (v[k] !== undefined) o[k] = v[k];
  return o;
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
function structuredCloneSafe<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

// =====================================================================
// Sample farm: 3 sites × ~1 ha, 8×8 m grid (12×12 spots), 100+ trees each.
// =====================================================================

/** Small seeded random generator so the demo looks the same every time. */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

export function seedDemo(): DB {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const d0 = today();
  const ago = (days: number) => addDays(d0, -days);
  const yearsAgo = (y: number) => addDays(d0, -Math.round(y * 365.25));

  const owner: Profile = { id: 'u-owner', full_name: 'Pemilik Kebun', username: 'pemilik', role: 'owner', active: true, language: 'id', created_at: ago(400) };
  const budi: Profile = { id: 'u-budi', full_name: 'Budi Santoso', username: 'budi', role: 'worker', active: true, language: 'id', created_at: ago(300) };
  const sari: Profile = { id: 'u-sari', full_name: 'Sari Wulandari', username: 'sari', role: 'worker', active: true, language: 'id', created_at: ago(200) };

  const varieties: Variety[] = [
    { code: 'DH', name: 'Duri Hitam (Black Thorn)', color: '#3f7a3a', days_to_ripe: 110, notes: '' },
    { code: 'BW', name: 'Bawor', color: '#5a9a3c', days_to_ripe: 120, notes: '' },
    { code: 'PT', name: 'Petruk', color: '#6aa84f', days_to_ripe: 100, notes: '' },
    { code: 'MK', name: 'Musang King', color: '#4c8c2f', days_to_ripe: 105, notes: '' },
  ];

  const sites: Site[] = [
    { id: 's-a', name: 'Kebun A', area_ha: 1, lat: -7.62, lng: 111.05, grid_rows: 12, grid_cols: 12, spacing_m: 8, notes: 'Pohon dewasa 5+ tahun', created_at: ago(400) },
    { id: 's-b', name: 'Kebun B', area_ha: 1, lat: -7.64, lng: 111.08, grid_rows: 12, grid_cols: 12, spacing_m: 8, notes: 'Pohon muda 1–2 tahun', created_at: ago(400) },
    { id: 's-c', name: 'Kebun C', area_ha: 1, lat: -7.6, lng: 111.02, grid_rows: 12, grid_cols: 12, spacing_m: 8, notes: 'Campuran: dewasa + sisipan muda', created_at: ago(400) },
  ];

  const trees: Tree[] = [];
  const counters: Record<string, Record<string, number>> = {};
  const mkTree = (site: Site, row: number, col: number, code: string, plantedYears: number): Tree => {
    counters[site.id] ??= {};
    counters[site.id][code] = (counters[site.id][code] ?? 0) + 1;
    return {
      id: `t-${site.id}-${row}-${col}`, site_id: site.id, name: `${code}-${counters[site.id][code]}`, variety_code: code,
      row_no: row, col_no: col, planted_on: yearsAgo(plantedYears), phase: 'vegetative', phase_since: ago(200),
      health: 'healthy', notes: '', created_at: ago(400),
    };
  };

  // Site A: mature trees, a few gaps. Blocks of varieties by column.
  for (let row = 1; row <= 12; row++) for (let col = 1; col <= 12; col++) {
    if (r() < 0.22) continue;
    const code = col <= 4 ? 'MK' : col <= 7 ? 'DH' : col <= 10 ? 'BW' : 'PT';
    trees.push(mkTree(sites[0], row, col, code, 5.5 + r() * 3));
  }
  // Site B: young trees 1–2 years
  for (let row = 1; row <= 12; row++) for (let col = 1; col <= 12; col++) {
    if (r() < 0.2) continue;
    const code = row <= 6 ? 'MK' : row <= 9 ? 'BW' : pick(['DH', 'PT']);
    trees.push(mkTree(sites[1], row, col, code, 0.8 + r() * 1.3));
  }
  // Site C: mixed — mature with young replacements
  for (let row = 1; row <= 12; row++) for (let col = 1; col <= 12; col++) {
    if (r() < 0.25) continue;
    const young = r() < 0.3;
    trees.push(mkTree(sites[2], row, col, pick(['DH', 'BW', 'PT', 'MK']), young ? 1 + r() * 1.5 : 5 + r() * 4));
  }

  // Phases: durian season — mature trees flowering / fruiting now.
  const tree_events: DB['tree_events'] = [];
  const mature = trees.filter((t) => t.site_id !== 's-b' && t.planted_on! < yearsAgo(5));
  for (const t of mature) {
    const x = r();
    if (x < 0.25) {
      t.phase = 'flowering'; t.phase_since = ago(10 + Math.floor(r() * 20));
      tree_events.push(ev(t, 'flowering', t.phase_since));
    } else if (x < 0.6) {
      const v = varieties.find((v) => v.code === t.variety_code)!;
      // some close to harvest so they glow as "ready"
      const age = x < 0.38 ? v.days_to_ripe - 1 - Math.floor(r() * 7) : 30 + Math.floor(r() * 50);
      t.phase = 'fruiting'; t.phase_since = ago(age);
      tree_events.push(ev(t, 'flowering', ago(age + 45)));
      tree_events.push({ ...ev(t, 'fruit_set', t.phase_since), count: 15 + Math.floor(r() * 40) });
    }
  }
  function ev(t: Tree, kind: any, date: string): Tables['tree_events'] {
    return { id: uid(), tree_id: t.id, site_id: t.site_id, kind, event_date: date, severity: null, count: null, title: '', note: '', photos: [], resolved: false, created_by: 'u-budi', created_at: date };
  }

  // A few health problems
  const problems: [number, string, 'pest' | 'disease', 'low' | 'medium' | 'high', string][] = [
    [3, 's-a', 'disease', 'high', 'Busuk batang (Phytophthora)'],
    [17, 's-a', 'pest', 'medium', 'Penggerek batang'],
    [40, 's-c', 'pest', 'low', 'Ulat daun'],
    [12, 's-b', 'pest', 'medium', 'Kutu loncat (Psyllid)'],
    [55, 's-b', 'disease', 'low', 'Bercak daun'],
  ];
  for (const [i, site, kind, sev, title] of problems) {
    const list = trees.filter((t) => t.site_id === site);
    const t = list[i % list.length];
    t.health = sev === 'high' ? 'sick' : 'watch';
    tree_events.push({ ...ev(t, kind, ago(3 + i % 5)), severity: sev, title, note: 'Ditemukan saat keliling pagi.' });
  }

  // Supplies
  const supplies: Supply[] = [
    { id: 'p-npk', name: 'NPK 16-16-16', category: 'fertilizer', unit: 'kg', stock: 0, min_stock: 80, price_per_unit: 14000, notes: '' },
    { id: 'p-kandang', name: 'Pupuk kandang', category: 'fertilizer', unit: 'kg', stock: 0, min_stock: 300, price_per_unit: 1200, notes: 'Kotoran kambing, karung 25 kg' },
    { id: 'p-dolomit', name: 'Dolomit', category: 'fertilizer', unit: 'kg', stock: 0, min_stock: 50, price_per_unit: 2500, notes: '' },
    { id: 'p-kcl', name: 'KCl (MOP)', category: 'fertilizer', unit: 'kg', stock: 0, min_stock: 25, price_per_unit: 16000, notes: 'Untuk pembuahan' },
    { id: 'p-decis', name: 'Deltametrin 25 EC', category: 'pesticide', unit: 'l', stock: 0, min_stock: 1, price_per_unit: 180000, notes: '' },
    { id: 'p-abamek', name: 'Abamektin', category: 'pesticide', unit: 'l', stock: 0, min_stock: 2, price_per_unit: 150000, notes: '' },
    { id: 'p-fosfit', name: 'Kalium fosfit', category: 'fungicide', unit: 'l', stock: 0, min_stock: 2, price_per_unit: 120000, notes: 'Anti Phytophthora, infus batang' },
    { id: 'p-mankozeb', name: 'Mankozeb 80 WP', category: 'fungicide', unit: 'kg', stock: 0, min_stock: 2, price_per_unit: 95000, notes: '' },
  ];
  const supply_movements: DB['supply_movements'] = [];
  const buy = (id: string, qty: number, days: number) => {
    supply_movements.push({ id: uid(), supply_id: id, qty, reason: 'purchase', activity_id: null, note: '', created_by: 'u-owner', created_at: ago(days) + 'T08:00:00.000Z' });
    supplies.find((s) => s.id === id)!.stock += qty;
  };
  buy('p-npk', 250, 60); buy('p-kandang', 2000, 75); buy('p-dolomit', 200, 75); buy('p-kcl', 100, 40);
  buy('p-decis', 4, 50); buy('p-abamek', 2, 50); buy('p-fosfit', 6, 45); buy('p-mankozeb', 5, 45);

  // Schedules
  const schedules: Schedule[] = [
    { id: 'j-npk-a', title: 'Pupuk NPK dewasa', kind: 'fertilizing', site_id: 's-a', tree_id: null, every_days: 90, next_due: addDays(d0, 2), supply_id: 'p-npk', dose: 1.5, assigned_to: 'u-budi', active: true, notes: '1,5 kg/pohon, tabur melingkar di bawah tajuk' },
    { id: 'j-npk-b', title: 'Pupuk NPK muda', kind: 'fertilizing', site_id: 's-b', tree_id: null, every_days: 30, next_due: addDays(d0, 4), supply_id: 'p-npk', dose: 0.15, assigned_to: 'u-sari', active: true, notes: '150 g/pohon' },
    { id: 'j-siram-b', title: 'Siram pohon muda', kind: 'watering', site_id: 's-b', tree_id: null, every_days: 3, next_due: ago(1), supply_id: null, dose: 0, assigned_to: 'u-sari', active: true, notes: 'Musim kemarau: 20 L/pohon' },
    { id: 'j-fosfit-a', title: 'Infus fosfit (Phytophthora)', kind: 'spraying', site_id: 's-a', tree_id: null, every_days: 120, next_due: addDays(d0, 12), supply_id: 'p-fosfit', dose: 0.02, assigned_to: 'u-budi', active: true, notes: '' },
    { id: 'j-semprot-c', title: 'Semprot hama daun', kind: 'spraying', site_id: 's-c', tree_id: null, every_days: 21, next_due: d0, supply_id: 'p-abamek', dose: 0.005, assigned_to: 'u-budi', active: true, notes: 'Pagi hari, jangan saat hujan' },
    { id: 'j-kcl-c', title: 'Pupuk KCl pembuahan', kind: 'fertilizing', site_id: 's-c', tree_id: null, every_days: 60, next_due: addDays(d0, 20), supply_id: 'p-kcl', dose: 0.5, assigned_to: null, active: true, notes: '' },
    { id: 'j-kandang-a', title: 'Pupuk kandang', kind: 'fertilizing', site_id: 's-a', tree_id: null, every_days: 180, next_due: addDays(d0, 45), supply_id: 'p-kandang', dose: 20, assigned_to: null, active: true, notes: '20 kg/pohon awal musim hujan' },
  ];

  // A per-tree treatment schedule for the sick tree (overdue → shows an icon in 3D)
  const sickTree = trees.find((t) => t.site_id === 's-a' && t.health === 'sick');
  if (sickTree) schedules.push({ id: 'j-obat-sick', title: `Obati ${sickTree.name}`, kind: 'spraying', site_id: 's-a', tree_id: sickTree.id, every_days: 7, next_due: ago(1), supply_id: 'p-fosfit', dose: 0.05, assigned_to: 'u-budi', active: true, notes: 'Kerok + oles fosfit pada luka batang' });

  // Past activities (stock already reduced by them)
  const activities: DB['activities'] = [];
  const act = (kind: any, site: string, sched: string | null, supply: string | null, qty: number, days: number, by: string, note: string) => {
    const a = { id: uid(), kind, site_id: site, tree_id: null, schedule_id: sched, supply_id: supply, qty_used: qty, done_on: ago(days), done_by: by, note, photos: [], created_at: ago(days) };
    activities.push(a);
    if (supply && qty > 0) {
      supply_movements.push({ id: uid(), supply_id: supply, qty: -qty, reason: 'usage', activity_id: a.id, note: 'auto: activity', created_by: by, created_at: ago(days) + 'T10:00:00.000Z' });
      supplies.find((s) => s.id === supply)!.stock -= qty;
    }
  };
  act('fertilizing', 's-a', 'j-npk-a', 'p-npk', 165, 88, 'u-budi', 'Semua pohon blok A');
  act('fertilizing', 's-b', 'j-npk-b', 'p-npk', 17, 26, 'u-sari', '');
  act('watering', 's-b', 'j-siram-b', null, 0, 4, 'u-sari', '');
  act('spraying', 's-c', 'j-semprot-c', 'p-abamek', 0.5, 21, 'u-budi', '');
  act('fertilizing', 's-a', 'j-kandang-a', 'p-kandang', 1650, 135, 'u-budi', '');
  act('fertilizing', 's-c', 'j-kcl-c', 'p-kcl', 40, 40, 'u-budi', '');
  act('spraying', 's-a', 'j-fosfit-a', 'p-fosfit', 2.2, 108, 'u-budi', '');
  act('weeding', 's-c', null, null, 0, 6, 'u-sari', 'Siangi gulma baris 1–6');
  for (const s of supplies) s.stock = Math.round(s.stock * 1000) / 1000;

  // Tasks
  const tasks: DB['tasks'] = [
    { id: uid(), title: 'Cek pohon sakit di Kebun A', description: 'Kerok kulit batang yang busuk, oles fungisida.', site_id: 's-a', tree_id: trees.filter((t) => t.site_id === 's-a')[3].id, assigned_to: 'u-budi', due_date: d0, status: 'todo', done_at: null, done_by: null, done_note: '', photo: null, created_by: 'u-owner', created_at: ago(1) },
    { id: uid(), title: 'Pasang tali penyangga buah', description: 'Pohon berbuah lebat di Kebun A baris 1–4.', site_id: 's-a', tree_id: null, assigned_to: 'u-budi', due_date: addDays(d0, 2), status: 'todo', done_at: null, done_by: null, done_note: '', photo: null, created_by: 'u-owner', created_at: ago(1) },
    { id: uid(), title: 'Bersihkan saluran air', description: 'Sebelum puncak musim hujan.', site_id: 's-c', tree_id: null, assigned_to: 'u-sari', due_date: addDays(d0, 5), status: 'todo', done_at: null, done_by: null, done_note: '', photo: null, created_by: 'u-owner', created_at: ago(2) },
    { id: uid(), title: 'Beli NPK 2 karung', description: '', site_id: null, tree_id: null, assigned_to: 'u-owner', due_date: addDays(d0, 3), status: 'todo', done_at: null, done_by: null, done_note: '', photo: null, created_by: 'u-owner', created_at: ago(2) },
    { id: uid(), title: 'Pangkas tunas air Kebun B', description: '', site_id: 's-b', tree_id: null, assigned_to: 'u-sari', due_date: ago(2), status: 'done', done_at: ago(2) + 'T15:00:00.000Z', done_by: 'u-sari', done_note: 'Selesai baris 1–8', photo: null, created_by: 'u-owner', created_at: ago(6) },
  ];

  // Daily reports
  const daily_reports: DB['daily_reports'] = [
    { id: uid(), site_id: 's-a', report_date: ago(0), author: 'u-budi', work_done: 'Keliling Kebun A, cek bunga dan buah. Pasang 12 tali penyangga di baris 2.', issues: 'MK-3 kulit batang basah dan berbau, kemungkinan busuk batang.', photos: [], created_at: ago(0) },
    { id: uid(), site_id: 's-b', report_date: ago(1), author: 'u-sari', work_done: 'Siram semua pohon muda Kebun B. Siangi gulma baris 7–12.', issues: 'Ada kutu loncat di beberapa tunas MK.', photos: [], created_at: ago(1) },
    { id: uid(), site_id: 's-c', report_date: ago(2), author: 'u-budi', work_done: 'Semprot ringan ulat daun di Kebun C.', issues: '', photos: [], created_at: ago(2) },
  ];

  // Harvest records from the last season (Jan–Mar this year)
  const harvests: DB['harvests'] = [];
  const year = Number(d0.slice(0, 4));
  for (const t of mature) {
    if (r() < 0.35) continue;
    const n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const fruits = 2 + Math.floor(r() * 8);
      const kgPer = t.variety_code === 'BW' ? 3 + r() * 2 : t.variety_code === 'MK' ? 1.6 + r() * 0.8 : 2 + r() * 1.2;
      const date = `${year}-0${1 + Math.floor(r() * 3)}-${String(1 + Math.floor(r() * 27)).padStart(2, '0')}`;
      harvests.push({ id: uid(), site_id: t.site_id, tree_id: t.id, harvest_date: date, fruit_count: fruits, weight_kg: Math.round(fruits * kgPer * 10) / 10, grade: pick(['A', 'A', 'B', 'C']), note: '', created_by: 'u-budi', created_at: date });
    }
  }

  // Sales & expenses through the year
  const sales: DB['sales'] = [];
  const buyers = ['Pak Harjo (pengepul)', 'Toko Buah Segar', 'Bu Rina', 'Pasar Induk'];
  const price: Record<string, number> = { MK: 120000, DH: 110000, BW: 60000, PT: 70000 };
  for (const site of ['s-a', 's-c']) {
    for (const m of [1, 2, 3]) for (const v of ['MK', 'DH', 'BW', 'PT']) {
      const kg = Math.round(harvests.filter((h) => h.site_id === site && Number(h.harvest_date.slice(5, 7)) === m)
        .filter((h) => trees.find((t) => t.id === h.tree_id)?.variety_code === v).reduce((s, h) => s + h.weight_kg, 0) * 0.95);
      if (kg <= 0) continue;
      const p = price[v] * (0.9 + r() * 0.2);
      const date = `${year}-0${m}-${String(10 + Math.floor(r() * 15))}`;
      sales.push({ id: uid(), site_id: site, sale_date: date, buyer: pick(buyers), variety_code: v, weight_kg: kg, price_per_kg: Math.round(p / 1000) * 1000, total: 0, note: '', created_by: 'u-owner', created_at: date });
    }
  }
  for (const s of sales) s.total = round2(s.weight_kg * s.price_per_kg);

  const expenses: DB['expenses'] = [];
  const curMonth = Number(d0.slice(5, 7));
  for (let m = 1; m <= curMonth; m++) {
    const mm = String(m).padStart(2, '0');
    for (const [site, wage] of [['s-a', 2400000], ['s-b', 1800000], ['s-c', 2200000]] as const) {
      expenses.push({ id: uid(), site_id: site, expense_date: `${year}-${mm}-28`, category: 'labor', amount: wage, note: 'Upah bulanan', supply_id: null, created_by: 'u-owner', created_at: `${year}-${mm}-28` });
    }
    expenses.push({ id: uid(), site_id: null, expense_date: `${year}-${mm}-15`, category: 'fuel', amount: 300000 + Math.round(r() * 200) * 1000, note: 'BBM motor & pompa', supply_id: null, created_by: 'u-owner', created_at: `${year}-${mm}-15` });
  }
  const addExp = (cat: any, amount: number, days: number, note: string, site: string | null = null) =>
    expenses.push({ id: uid(), site_id: site, expense_date: ago(days), category: cat, amount, note, supply_id: null, created_by: 'u-owner', created_at: ago(days) });
  addExp('fertilizer', 3500000, 60, 'NPK 250 kg'); addExp('fertilizer', 2400000, 75, 'Pupuk kandang 2 ton');
  addExp('fertilizer', 500000, 75, 'Dolomit 200 kg'); addExp('fertilizer', 1600000, 40, 'KCl 100 kg');
  addExp('pesticide', 1020000, 50, 'Deltametrin + Abamektin'); addExp('pesticide', 1195000, 45, 'Fosfit + Mankozeb');
  addExp('tools', 850000, 120, 'Gunting pangkas, selang', 's-b'); addExp('transport', 1200000, 220, 'Angkut buah musim panen', 's-a');

  return {
    profiles: [owner, budi, sari], sites, varieties, trees, supplies, supply_movements, schedules, activities,
    tasks, daily_reports, tree_events, harvests, sales, expenses,
  };
}
