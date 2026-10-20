// Jadwal: repeating fertilizing / spraying / watering, what's due, what's done.

import { useState, type ReactElement } from 'react';
import { LuPlus, LuCheck, LuDroplets, LuSprout, LuSprayCan, LuCircle } from 'react-icons/lu';
import {
  t, dueStatus, relDays, dateLabel, scheduleTreeCount, qty, today, type Schedule, type DueStatus,
} from '@kebun/shared';
import { useStore, useTables, rows, bySite } from '../lib/store';
import { Badge, Button, Card, Empty, PageHeader, PhotoThumbs, RowActions, Tabs } from '../components/ui';
import { FormModal, type Field } from '../components/FormModal';
import { ActivityForm, FORM_TABLES, useOptions } from '../components/forms';

const ICON: Record<string, ReactElement> = { watering: <LuDroplets />, fertilizing: <LuSprout />, spraying: <LuSprayCan />, other: <LuCircle /> };
const GROUPS: { st: DueStatus; key: string }[] = [
  { st: 'overdue', key: 'dash.overdue' }, { st: 'today', key: 'dash.dueToday' }, { st: 'soon', key: 'dash.dueSoon' },
  { st: 'later', key: 'common.active' }, { st: 'inactive', key: 'common.inactive' },
];

function ScheduleForm({ schedule, onClose }: { schedule?: Schedule; onClose: () => void }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={schedule ? `${t('common.edit')}: ${schedule.title}` : t('sched.add')}
      initial={schedule ?? { kind: 'fertilizing', every_days: 30, next_due: today(), active: true, site_id: s.siteId !== 'all' ? s.siteId : o.sites[0]?.value }}
      onClose={onClose}
      onChange={(name) => (name === 'site_id' ? { tree_id: '' } : undefined)}
      fields={(v) => [
        { name: 'title', label: t('sched.title'), required: true, placeholder: 'Pupuk NPK pohon dewasa' },
        { name: 'kind', label: t('sched.kind'), type: 'select', options: o.schedKinds, required: true, half: true },
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, required: true, half: true },
        { name: 'tree_id', label: t('sched.target'), type: 'select', options: o.treesOf(v.site_id), half: true, help: `${t('common.none')} = ${t('common.wholeSite')}` },
        { name: 'assigned_to', label: t('sched.assigned'), type: 'select', options: o.users, half: true },
        { name: 'every_days', label: t('sched.every'), type: 'number', min: 1, required: true, suffix: t('sched.days'), half: true },
        { name: 'next_due', label: t('sched.nextDue'), type: 'date', required: true, half: true },
        { name: 'supply_id', label: t('sched.supply'), type: 'select', options: o.supplies, half: true },
        { name: 'dose', label: t('sched.dose'), type: 'number', min: 0, half: true, show: (x) => !!x.supply_id,
          suffix: o.raw.supplies.find((x) => x.id === v.supply_id)?.unit },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
        { name: 'active', label: t('common.active'), type: 'checkbox' },
      ] as Field[]}
      onSubmit={async (v) => {
        const vals = { ...v, tree_id: v.tree_id || null, dose: Number(v.dose) || 0 } as Partial<Schedule>;
        if (schedule) await s.update('schedules', schedule.id, vals);
        else await s.insert('schedules', vals);
      }}
    />
  );
}

export default function Schedules() {
  const s = useTables([...FORM_TABLES, 'activities']);
  const [tab, setTab] = useState<'plan' | 'done'>('plan');
  const [form, setForm] = useState<null | 'add' | 'log' | Schedule>(null);
  const [doing, setDoing] = useState<Schedule | null>(null);

  const sites = rows(s, 'sites');
  const trees = rows(s, 'trees');
  const supplies = rows(s, 'supplies');
  const profiles = rows(s, 'profiles');
  const schedules = bySite(rows(s, 'schedules'), s.siteId);
  const activities = bySite(rows(s, 'activities'), s.siteId);
  const siteName = (id: string) => sites.find((x) => x.id === id)?.name ?? '';
  const userName = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? '';
  const lastDone = (id: string) => activities.find((a) => a.schedule_id === id)?.done_on;

  return (
    <div>
      <PageHeader
        title={t('nav.schedules')}
        actions={<>
          <Button icon={<LuCheck />} onClick={() => setForm('log')}>{t('act.log')}</Button>
          {s.isOwner && <Button icon={<LuPlus />} variant="primary" onClick={() => setForm('add')}>{t('sched.add')}</Button>}
        </>}
      />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'plan', label: t('nav.schedules') }, { value: 'done', label: t('sched.history') }]} />

      {tab === 'plan' && (
        schedules.length === 0 ? <Card><Empty action={s.isOwner && <Button variant="primary" icon={<LuPlus />} onClick={() => setForm('add')}>{t('sched.add')}</Button>} /></Card> :
        GROUPS.map((g) => {
          const list = schedules.filter((x) => dueStatus(x) === g.st).sort((a, b) => a.next_due.localeCompare(b.next_due));
          if (!list.length) return null;
          return (
            <Card key={g.st} title={<>{t(g.key)} <span className="count">{list.length}</span></>} className={`sched-group sched-${g.st}`}>
              <ul className="sched-list">
                {list.map((x) => {
                  const sup = supplies.find((y) => y.id === x.supply_id);
                  const n = scheduleTreeCount(x, trees);
                  const last = lastDone(x.id);
                  return (
                    <li key={x.id} className="sched-item">
                      <span className={`todo-icon kind-${x.kind}`}>{ICON[x.kind]}</span>
                      <div className="sched-main">
                        <div className="sched-title"><b>{x.title}</b> <Badge>{t('kind.' + x.kind)}</Badge></div>
                        <div className="muted small">
                          {siteName(x.site_id)} · {x.tree_id ? trees.find((y) => y.id === x.tree_id)?.name : `${t('common.wholeSite')} (${n})`} · {t('sched.everyN', { n: x.every_days })}
                          {x.assigned_to && <> · {userName(x.assigned_to)}</>}
                        </div>
                        {sup && <div className="small">{sup.name}: {qty(x.dose, sup.unit, s.lang)}/pohon → {t('sched.estimate', { qty: qty(x.dose * n, sup.unit, s.lang) })}</div>}
                        <div className="small muted">{t('sched.lastDone')}: {last ? dateLabel(last, s.lang) : t('sched.never')}</div>
                      </div>
                      <div className="sched-side">
                        <Badge tone={g.st === 'overdue' ? 'bad' : g.st === 'today' ? 'warn' : 'neutral'}>{dateLabel(x.next_due, s.lang, false)} · {relDays(x.next_due, s.lang)}</Badge>
                        <div className="row-gap">
                          {x.active && <Button size="sm" variant={g.st === 'overdue' || g.st === 'today' ? 'primary' : 'soft'} icon={<LuCheck />} onClick={() => setDoing(x)}>{t('sched.done')}</Button>}
                          {s.isOwner && <RowActions onEdit={() => setForm(x)} onDelete={() => s.remove('schedules', x.id)} />}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })
      )}

      {tab === 'done' && (
        <Card pad={false}>
          {activities.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('common.date')}</th><th>{t('common.type')}</th><th>{t('common.site')}</th><th>{t('sched.supply')}</th><th>{t('common.by')}</th><th>{t('common.note')}</th><th /></tr></thead>
                <tbody>
                  {activities.slice(0, 200).map((a) => {
                    const sup = supplies.find((y) => y.id === a.supply_id);
                    return (
                      <tr key={a.id}>
                        <td>{dateLabel(a.done_on, s.lang)}</td>
                        <td>{t('kind.' + a.kind)}</td>
                        <td>{siteName(a.site_id)}{a.tree_id ? ` · ${trees.find((y) => y.id === a.tree_id)?.name}` : ''}</td>
                        <td>{sup ? `${sup.name} ${qty(a.qty_used, sup.unit, s.lang)}` : '–'}</td>
                        <td>{userName(a.done_by)}</td>
                        <td>{a.note}<PhotoThumbs paths={a.photos} size={40} /></td>
                        <td>{s.isOwner && <RowActions onDelete={() => s.remove('activities', a.id)} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {form === 'add' && <ScheduleForm onClose={() => setForm(null)} />}
      {form === 'log' && <ActivityForm onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && <ScheduleForm schedule={form} onClose={() => setForm(null)} />}
      {doing && <ActivityForm schedule={doing} onClose={() => setDoing(null)} />}
    </div>
  );
}
