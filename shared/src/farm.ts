// Farm logic shared by web and mobile: tree growth, harvest timing,
// schedule due status, stock alerts and finance summaries.

import type {
  ISODate, Schedule, ScheduleKind, Site, Supply, Tree, Variety, Sale, Expense, Harvest, Task,
} from './types';
import { addDays, daysBetween, monthKey, today } from './dates';

// ---------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------

/** Age in years (decimal). Unknown planting date counts as mature. */
export function ageYears(tree: Pick<Tree, 'planted_on'>, on: ISODate = today()): number {
  if (!tree.planted_on) return 6;
  return Math.max(0, daysBetween(tree.planted_on, on) / 365.25);
}

/**
 * Visual growth stage used by the 3D garden:
 *   0 seedling (< 1 yr) · 1 young (1–3 yr) · 2 growing (3–5 yr) · 3 mature (5+ yr, can bear fruit)
 */
export type GrowthStage = 0 | 1 | 2 | 3;
export function growthStage(years: number): GrowthStage {
  if (years < 1) return 0;
  if (years < 3) return 1;
  if (years < 5) return 2;
  return 3;
}

/** Smooth 0..1 size factor (for gently growing trees between stages). */
export function growthScale(years: number): number {
  // seedling ≈ 0.18, 2 yr ≈ 0.42, 4 yr ≈ 0.7, 7+ yr ≈ 1
  return Math.min(1, 0.18 + 0.82 * (1 - Math.exp(-years / 2.6)));
}

/** Expected harvest date for a fruiting tree (fruit set date + days to ripen). */
export function expectedHarvest(tree: Tree, variety?: Variety | null): ISODate | null {
  if (tree.phase !== 'fruiting' && tree.phase !== 'ready') return null;
  return addDays(tree.phase_since, variety?.days_to_ripe ?? 110);
}

/** Phase shown to the user: a fruiting tree becomes "ready" one week before expected harvest. */
export function effectivePhase(tree: Tree, variety?: Variety | null, on: ISODate = today()) {
  if (tree.phase === 'fruiting') {
    const exp = expectedHarvest(tree, variety);
    if (exp && daysBetween(on, exp) <= 7) return 'ready' as const;
  }
  return tree.phase;
}

// ---------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------
export type DueStatus = 'overdue' | 'today' | 'soon' | 'later' | 'inactive';

export function dueStatus(s: Pick<Schedule, 'next_due' | 'active'>, on: ISODate = today()): DueStatus {
  if (!s.active) return 'inactive';
  const n = daysBetween(on, s.next_due);
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 7) return 'soon';
  return 'later';
}

export interface TreeNeeds {
  water: boolean;
  fertilizer: boolean;
  spray: boolean;
  other: boolean;
  maxOverdue: number; // days
}

/**
 * Which overdue schedules apply to each tree (site-wide schedules apply to
 * every tree in that site). Returns a Map treeId → needs.
 */
export function treeNeeds(trees: Tree[], schedules: Schedule[], on: ISODate = today()): Map<string, TreeNeeds> {
  const out = new Map<string, TreeNeeds>();
  const overdue = schedules.filter((s) => s.active && daysBetween(on, s.next_due) < 0);
  if (!overdue.length) return out;
  const bySite = new Map<string, Schedule[]>();
  const byTree = new Map<string, Schedule[]>();
  for (const s of overdue) {
    if (s.tree_id) byTree.set(s.tree_id, [...(byTree.get(s.tree_id) ?? []), s]);
    else bySite.set(s.site_id, [...(bySite.get(s.site_id) ?? []), s]);
  }
  for (const t of trees) {
    if (t.health === 'dead') continue;
    const list = [...(bySite.get(t.site_id) ?? []), ...(byTree.get(t.id) ?? [])];
    if (!list.length) continue;
    const n: TreeNeeds = { water: false, fertilizer: false, spray: false, other: false, maxOverdue: 0 };
    for (const s of list) {
      const k: ScheduleKind = s.kind;
      if (k === 'watering') n.water = true;
      else if (k === 'fertilizing') n.fertilizer = true;
      else if (k === 'spraying') n.spray = true;
      else n.other = true;
      n.maxOverdue = Math.max(n.maxOverdue, -daysBetween(on, s.next_due));
    }
    out.set(t.id, n);
  }
  return out;
}

/** How many trees a schedule covers (for estimating supply use). */
export function scheduleTreeCount(s: Schedule, trees: Tree[]): number {
  if (s.tree_id) return 1;
  return trees.filter((t) => t.site_id === s.site_id && t.health !== 'dead').length;
}

// ---------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------
export function isLowStock(s: Supply): boolean {
  return Number(s.stock) <= Number(s.min_stock);
}

export function lowStock(supplies: Supply[]): Supply[] {
  return supplies.filter(isLowStock).sort((a, b) => a.stock / (a.min_stock || 1) - b.stock / (b.min_stock || 1));
}

// ---------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------
export function openTasks(tasks: Task[], userId?: string | null): Task[] {
  return tasks
    .filter((t) => t.status === 'todo' && (!userId || !t.assigned_to || t.assigned_to === userId))
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
}

// ---------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------
export interface MonthTotals { month: string; income: number; expense: number; profit: number }
export interface SiteTotals { site_id: string | null; name: string; income: number; expense: number; profit: number; harvest_kg: number }

export function monthlyTotals(sales: Sale[], expenses: Expense[], year: number): MonthTotals[] {
  const months: MonthTotals[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`, income: 0, expense: 0, profit: 0,
  }));
  const idx = (d: string) => (d.startsWith(String(year)) ? Number(d.slice(5, 7)) - 1 : -1);
  for (const s of sales) { const i = idx(s.sale_date); if (i >= 0) months[i].income += Number(s.total) || 0; }
  for (const e of expenses) { const i = idx(e.expense_date); if (i >= 0) months[i].expense += Number(e.amount) || 0; }
  for (const m of months) m.profit = m.income - m.expense;
  return months;
}

export function siteTotals(
  sites: Site[], sales: Sale[], expenses: Expense[], harvests: Harvest[], year: number, sharedLabel = 'Umum',
): SiteTotals[] {
  const rows = new Map<string, SiteTotals>();
  const key = (id: string | null) => id ?? '_shared';
  for (const s of sites) rows.set(s.id, { site_id: s.id, name: s.name, income: 0, expense: 0, profit: 0, harvest_kg: 0 });
  const get = (id: string | null) => {
    const k = key(id);
    if (!rows.has(k)) rows.set(k, { site_id: id, name: sharedLabel, income: 0, expense: 0, profit: 0, harvest_kg: 0 });
    return rows.get(k)!;
  };
  const inYear = (d: string) => d.startsWith(String(year));
  for (const s of sales) if (inYear(s.sale_date)) get(s.site_id).income += Number(s.total) || 0;
  for (const e of expenses) if (inYear(e.expense_date)) get(e.site_id).expense += Number(e.amount) || 0;
  for (const h of harvests) if (inYear(h.harvest_date)) get(h.site_id).harvest_kg += Number(h.weight_kg) || 0;
  for (const r of rows.values()) r.profit = r.income - r.expense;
  return [...rows.values()];
}

export function sumBy<T>(list: T[], f: (x: T) => number): number {
  let s = 0;
  for (const x of list) s += Number(f(x)) || 0;
  return s;
}

export function groupCount<T>(list: T[], f: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of list) { const k = f(x); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

export { monthKey };
