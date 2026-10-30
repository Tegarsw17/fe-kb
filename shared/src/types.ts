// Data types — one interface per database table (same column names).

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'

export type Role = 'owner' | 'worker';
export type Lang = 'id' | 'en';

export interface Profile {
  id: ID;
  full_name: string;
  username: string | null;
  role: Role;
  active: boolean;
  language: Lang;
  telegram_chat_id?: string | null;
  created_at?: string;
}

export interface Site {
  id: ID;
  name: string;
  area_ha: number;
  lat: number | null;
  lng: number | null;
  grid_rows: number;
  grid_cols: number;
  spacing_m: number;
  notes: string;
  created_at?: string;
}

export interface Variety {
  code: string;
  name: string;
  color: string;
  days_to_ripe: number;
  notes: string;
}

export type Phase = 'vegetative' | 'flowering' | 'fruiting' | 'ready';
export type Health = 'healthy' | 'watch' | 'sick' | 'dead';

export interface Tree {
  id: ID;
  site_id: ID;
  name: string;
  variety_code: string | null;
  row_no: number;
  col_no: number;
  planted_on: ISODate | null;
  phase: Phase;
  phase_since: ISODate;
  health: Health;
  notes: string;
  created_at?: string;
}

export type SupplyCategory = 'fertilizer' | 'pesticide' | 'fungicide' | 'other';
export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'pcs';

export interface Supply {
  id: ID;
  name: string;
  category: SupplyCategory;
  unit: Unit;
  stock: number;
  min_stock: number;
  price_per_unit: number;
  notes: string;
  created_at?: string;
}

export interface SupplyMovement {
  id: ID;
  supply_id: ID;
  qty: number;
  reason: 'purchase' | 'usage' | 'adjust';
  activity_id: ID | null;
  note: string;
  created_by: ID | null;
  created_at: string;
}

export type ScheduleKind = 'fertilizing' | 'spraying' | 'watering' | 'other';
export type ActivityKind = ScheduleKind | 'pruning' | 'weeding';

export interface Schedule {
  id: ID;
  title: string;
  kind: ScheduleKind;
  site_id: ID;
  tree_id: ID | null;
  every_days: number;
  next_due: ISODate;
  supply_id: ID | null;
  dose: number;
  assigned_to: ID | null;
  active: boolean;
  notes: string;
  created_at?: string;
}

export interface Activity {
  id: ID;
  kind: ActivityKind;
  site_id: ID;
  tree_id: ID | null;
  schedule_id: ID | null;
  supply_id: ID | null;
  qty_used: number;
  done_on: ISODate;
  done_by: ID | null;
  note: string;
  photos: string[];
  created_at?: string;
}

export interface Task {
  id: ID;
  title: string;
  description: string;
  site_id: ID | null;
  tree_id: ID | null;
  assigned_to: ID | null;
  due_date: ISODate | null;
  status: 'todo' | 'done';
  done_at: string | null;
  done_by: ID | null;
  done_note: string;
  photo: string | null;
  created_by?: ID | null;
  created_at?: string;
}

export interface DailyReport {
  id: ID;
  site_id: ID | null;
  report_date: ISODate;
  author: ID;
  work_done: string;
  issues: string;
  photos: string[];
  created_at?: string;
}

export type TreeEventKind = 'flowering' | 'fruit_set' | 'pest' | 'disease' | 'treatment' | 'note';

export interface TreeEvent {
  id: ID;
  tree_id: ID;
  site_id: ID;
  kind: TreeEventKind;
  event_date: ISODate;
  severity: 'low' | 'medium' | 'high' | null;
  count: number | null;
  title: string;
  note: string;
  photos: string[];
  resolved: boolean;
  created_by?: ID | null;
  created_at?: string;
}

export interface Harvest {
  id: ID;
  site_id: ID;
  tree_id: ID | null;
  harvest_date: ISODate;
  fruit_count: number;
  weight_kg: number;
  grade: 'A' | 'B' | 'C' | null;
  note: string;
  created_by?: ID | null;
  created_at?: string;
}

export interface Sale {
  id: ID;
  site_id: ID | null;
  sale_date: ISODate;
  buyer: string;
  variety_code: string | null;
  weight_kg: number;
  price_per_kg: number;
  total: number; // computed by the database
  note: string;
  created_by?: ID | null;
  created_at?: string;
}

export type ExpenseCategory = 'labor' | 'fertilizer' | 'pesticide' | 'fuel' | 'tools' | 'transport' | 'other';

export interface Expense {
  id: ID;
  site_id: ID | null;
  expense_date: ISODate;
  category: ExpenseCategory;
  amount: number;
  note: string;
  supply_id: ID | null;
  created_by?: ID | null;
  created_at?: string;
}

/** All tables the apps work with, keyed by table name. */
export interface Tables {
  profiles: Profile;
  sites: Site;
  varieties: Variety;
  trees: Tree;
  supplies: Supply;
  supply_movements: SupplyMovement;
  schedules: Schedule;
  activities: Activity;
  tasks: Task;
  daily_reports: DailyReport;
  tree_events: TreeEvent;
  harvests: Harvest;
  sales: Sale;
  expenses: Expense;
}
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];

/** Primary key column for each table (varieties use `code`). */
export const PK: Record<TableName, string> = {
  profiles: 'id', sites: 'id', varieties: 'code', trees: 'id', supplies: 'id',
  supply_movements: 'id', schedules: 'id', activities: 'id', tasks: 'id',
  daily_reports: 'id', tree_events: 'id', harvests: 'id', sales: 'id', expenses: 'id',
};

/** Default sort for each table when listing (column, descending?). */
export const ORDER: Record<TableName, [string, boolean]> = {
  profiles: ['full_name', false], sites: ['name', false], varieties: ['code', false],
  trees: ['name', false], supplies: ['name', false], supply_movements: ['created_at', true],
  schedules: ['next_due', false], activities: ['done_on', true], tasks: ['created_at', true],
  daily_reports: ['report_date', true], tree_events: ['event_date', true],
  harvests: ['harvest_date', true], sales: ['sale_date', true], expenses: ['expense_date', true],
};
