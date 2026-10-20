// Ready-made forms used on several pages (dashboard, garden, tree detail, lists).

import {
  t, today, scheduleTreeCount, qty as fmtQty,
  type Activity, type Harvest, type Schedule, type Task, type Tree, type TreeEvent, type DailyReport,
} from '@kebun/shared';
import { FormModal, type Field } from './FormModal';
import { useStore, rows } from '../lib/store';

// ------------------------------------------------------------------ option helpers
export function useOptions() {
  const s = useStore();
  const sites = rows(s, 'sites');
  const trees = rows(s, 'trees');
  const supplies = rows(s, 'supplies');
  const profiles = rows(s, 'profiles');
  const varieties = rows(s, 'varieties');
  const schedules = rows(s, 'schedules');
  return {
    sites: sites.map((x) => ({ value: x.id, label: x.name })),
    treesOf: (siteId: string | null | undefined) =>
      trees.filter((x) => x.site_id === siteId).sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))
        .map((x) => ({ value: x.id, label: x.name })),
    supplies: supplies.map((x) => ({ value: x.id, label: `${x.name} (${fmtQty(x.stock, x.unit, s.lang)})` })),
    users: profiles.filter((p) => p.active).map((p) => ({ value: p.id, label: p.full_name || p.username || '?' })),
    varieties: varieties.map((v) => ({ value: v.code, label: `${v.code} · ${v.name}` })),
    schedulesOf: (siteId?: string | null) => schedules.filter((x) => x.active && (!siteId || x.site_id === siteId)).map((x) => ({ value: x.id, label: x.title })),
    kinds: (['fertilizing', 'spraying', 'watering', 'pruning', 'weeding', 'other'] as const).map((k) => ({ value: k, label: t('kind.' + k) })),
    schedKinds: (['fertilizing', 'spraying', 'watering', 'other'] as const).map((k) => ({ value: k, label: t('kind.' + k) })),
    raw: { sites, trees, supplies, profiles, varieties, schedules },
  };
}

/** Tables the shared forms need. Load these on pages that use the forms. */
export const FORM_TABLES = ['sites', 'trees', 'supplies', 'profiles', 'varieties', 'schedules'] as const;

// ------------------------------------------------------------------ activity (incl. "mark schedule done")
export function ActivityForm({ onClose, schedule, initial }: { onClose: () => void; schedule?: Schedule; initial?: Partial<Activity> }) {
  const s = useStore();
  const o = useOptions();
  const estimate = (sch: Schedule | undefined) =>
    sch && sch.supply_id && sch.dose ? Math.round(sch.dose * scheduleTreeCount(sch, o.raw.trees) * 1000) / 1000 : 0;

  const start: Record<string, any> = {
    kind: schedule?.kind ?? 'fertilizing',
    site_id: schedule?.site_id ?? (s.siteId !== 'all' ? s.siteId : o.sites[0]?.value),
    tree_id: schedule?.tree_id ?? null,
    schedule_id: schedule?.id ?? null,
    supply_id: schedule?.supply_id ?? null,
    qty_used: estimate(schedule) || '',
    done_on: today(),
    ...initial,
  };
  const unitOf = (id: string) => o.raw.supplies.find((x) => x.id === id)?.unit ?? '';

  return (
    <FormModal
      title={schedule ? `${t('sched.done')}: ${schedule.title}` : t('act.log')}
      initial={start}
      onClose={onClose}
      onChange={(name, v) => {
        if (name === 'schedule_id' && v.schedule_id) {
          const sch = o.raw.schedules.find((x) => x.id === v.schedule_id);
          if (sch) return { kind: sch.kind, site_id: sch.site_id, tree_id: sch.tree_id, supply_id: sch.supply_id, qty_used: estimate(sch) || '' };
        }
        if (name === 'site_id') return { tree_id: null, schedule_id: null };
      }}
      fields={(v) => [
        { name: 'schedule_id', label: t('act.fromSchedule'), type: 'select', options: o.schedulesOf(v.site_id), show: () => !schedule },
        { name: 'kind', label: t('sched.kind'), type: 'select', options: o.kinds, required: true, half: true },
        { name: 'done_on', label: t('act.doneOn'), type: 'date', required: true, half: true },
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, required: true, half: true },
        { name: 'tree_id', label: `${t('nav.trees')} (${t('common.optional')})`, type: 'select', options: o.treesOf(v.site_id), half: true },
        { name: 'supply_id', label: t('sched.supply'), type: 'select', options: o.supplies, half: true },
        { name: 'qty_used', label: t('act.qtyUsed'), type: 'number', min: 0, half: true, suffix: unitOf(v.supply_id), show: (x) => !!x.supply_id, help: t('act.stockWillDrop') },
        { name: 'note', label: t('common.note'), type: 'textarea' },
        { name: 'photos', label: t('common.photos'), type: 'photos' },
      ] as Field[]}
      onSubmit={async (v) => {
        await s.insert('activities', {
          ...v,
          schedule_id: schedule?.id ?? v.schedule_id ?? null,
          qty_used: v.supply_id ? Number(v.qty_used) || 0 : 0,
          done_by: s.me?.id,
        } as Partial<Activity>);
      }}
    />
  );
}

// ------------------------------------------------------------------ tree event (flowering, pest, …)
export function TreeEventForm({ onClose, tree, initial }: { onClose: () => void; tree?: Tree; initial?: Partial<TreeEvent> }) {
  const s = useStore();
  const o = useOptions();
  const kinds = (['flowering', 'fruit_set', 'pest', 'disease', 'treatment', 'note'] as const).map((k) => ({ value: k, label: t('event.' + k) }));
  return (
    <FormModal
      title={tree ? `${t('tree.recordEvent')}: ${tree.name}` : t('tree.recordEvent')}
      initial={{ kind: 'pest', event_date: today(), site_id: tree?.site_id ?? (s.siteId !== 'all' ? s.siteId : o.sites[0]?.value), tree_id: tree?.id ?? '', ...initial }}
      onClose={onClose}
      onChange={(name) => (name === 'site_id' ? { tree_id: '' } : undefined)}
      fields={(v) => [
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, required: true, half: true, show: () => !tree },
        { name: 'tree_id', label: t('nav.trees'), type: 'select', options: o.treesOf(v.site_id), required: true, half: true, show: () => !tree },
        { name: 'kind', label: t('event.kind'), type: 'select', options: kinds, required: true, half: true },
        { name: 'event_date', label: t('common.date'), type: 'date', required: true, half: true },
        { name: 'title', label: t('event.titleLabel'), placeholder: 'mis. Penggerek batang, Phytophthora', show: (x) => ['pest', 'disease', 'treatment'].includes(x.kind) },
        { name: 'severity', label: t('event.severity'), type: 'select', options: ['low', 'medium', 'high'].map((x) => ({ value: x, label: t('sev.' + x) })), show: (x) => x.kind === 'pest' || x.kind === 'disease', half: true },
        { name: 'count', label: t('event.count'), type: 'number', min: 0, show: (x) => x.kind === 'fruit_set', half: true },
        { name: 'note', label: t('common.note'), type: 'textarea' },
        { name: 'photos', label: t('common.photos'), type: 'photos' },
      ] as Field[]}
      onSubmit={async (v) => {
        const tr = tree ?? o.raw.trees.find((x) => x.id === v.tree_id);
        await s.insert('tree_events', { ...v, tree_id: tr!.id, site_id: tr!.site_id, created_by: s.me?.id } as Partial<TreeEvent>);
      }}
    />
  );
}

// ------------------------------------------------------------------ harvest
export function HarvestForm({ onClose, tree, initial }: { onClose: () => void; tree?: Tree; initial?: Partial<Harvest> }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={tree ? `${t('harvest.add')}: ${tree.name}` : t('harvest.add')}
      initial={{ harvest_date: today(), site_id: tree?.site_id ?? (s.siteId !== 'all' ? s.siteId : o.sites[0]?.value), tree_id: tree?.id ?? '', finished: false, ...initial }}
      onClose={onClose}
      onChange={(name) => (name === 'site_id' ? { tree_id: '' } : undefined)}
      fields={(v) => [
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, required: true, half: true, show: () => !tree },
        { name: 'tree_id', label: `${t('nav.trees')} (${t('common.optional')})`, type: 'select', options: o.treesOf(v.site_id), half: true, show: () => !tree },
        { name: 'harvest_date', label: t('common.date'), type: 'date', required: true, half: true },
        { name: 'grade', label: t('harvest.grade'), type: 'select', options: ['A', 'B', 'C'].map((g) => ({ value: g, label: g })), half: true },
        { name: 'fruit_count', label: t('harvest.fruits'), type: 'number', min: 0, required: true, half: true },
        { name: 'weight_kg', label: t('harvest.weight'), type: 'number', min: 0, required: true, half: true, suffix: 'kg' },
        { name: 'note', label: t('common.note'), type: 'textarea' },
        { name: 'finished', label: t('harvest.markReady'), type: 'checkbox', show: () => s.isOwner && !!(tree || v.tree_id) },
      ] as Field[]}
      onSubmit={async (v) => {
        const { finished, ...rest } = v;
        const treeId = tree?.id ?? (rest.tree_id || null);
        await s.insert('harvests', { ...rest, site_id: tree?.site_id ?? rest.site_id, tree_id: treeId, created_by: s.me?.id } as Partial<Harvest>);
        if (finished && treeId) await s.update('trees', treeId, { phase: 'vegetative', phase_since: today() }, false);
      }}
    />
  );
}

// ------------------------------------------------------------------ task
export function TaskForm({ onClose, task, initial }: { onClose: () => void; task?: Task; initial?: Partial<Task> }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={task ? t('common.edit') : t('task.add')}
      initial={task ?? { site_id: s.siteId !== 'all' ? s.siteId : '', ...initial }}
      onClose={onClose}
      onChange={(name) => (name === 'site_id' ? { tree_id: '' } : undefined)}
      fields={(v) => [
        { name: 'title', label: t('task.title'), required: true },
        { name: 'description', label: t('task.desc'), type: 'textarea' },
        { name: 'assigned_to', label: t('task.assignee'), type: 'select', options: o.users, half: true },
        { name: 'due_date', label: t('task.due'), type: 'date', half: true },
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, half: true },
        { name: 'tree_id', label: `${t('nav.trees')} (${t('common.optional')})`, type: 'select', options: o.treesOf(v.site_id), half: true, show: (x) => !!x.site_id },
      ] as Field[]}
      onSubmit={async (v) => {
        if (task) await s.update('tasks', task.id, v as Partial<Task>);
        else await s.insert('tasks', { ...v, created_by: s.me?.id } as Partial<Task>);
      }}
    />
  );
}

export function CompleteTaskForm({ onClose, task }: { onClose: () => void; task: Task }) {
  const s = useStore();
  return (
    <FormModal
      title={`${t('task.complete')}: ${task.title}`}
      onClose={onClose}
      submitLabel={t('task.complete')}
      fields={[
        { name: 'done_note', label: t('task.doneNote'), type: 'textarea' },
        { name: 'photos', label: t('common.photos'), type: 'photos' },
      ]}
      onSubmit={async (v) => { await s.completeTask(task.id, v.done_note ?? '', v.photos?.[0] ?? null); }}
    />
  );
}

// ------------------------------------------------------------------ daily report
export function ReportForm({ onClose, report }: { onClose: () => void; report?: DailyReport }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={report ? t('common.edit') : t('report.add')}
      initial={report ?? { report_date: today(), site_id: s.siteId !== 'all' ? s.siteId : o.sites[0]?.value }}
      onClose={onClose}
      fields={[
        { name: 'report_date', label: t('common.date'), type: 'date', required: true, half: true },
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, half: true },
        { name: 'work_done', label: t('report.workDone'), type: 'textarea', required: true, placeholder: t('report.placeholderWork') },
        { name: 'issues', label: t('report.issues'), type: 'textarea', placeholder: t('report.placeholderIssues') },
        { name: 'photos', label: t('common.photos'), type: 'photos' },
      ]}
      onSubmit={async (v) => {
        if (report) await s.update('daily_reports', report.id, v as Partial<DailyReport>);
        else await s.insert('daily_reports', { ...v, author: s.me!.id } as Partial<DailyReport>, t('report.sent'));
      }}
    />
  );
}
