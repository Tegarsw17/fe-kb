// Beranda: today's work, the garden, stock alerts, harvest outlook, reports.

import { useMemo, useState } from 'react';
import { LuCheck, LuTriangleAlert, LuChevronRight, LuDroplets, LuSprout, LuSprayCan } from 'react-icons/lu';
import {
  t, today, dateLabel, relDays, dueStatus, lowStock, openTasks, effectivePhase, expectedHarvest,
  ageYears, rupiahShort, num, qty, sumBy, daysBetween, type Schedule, type Task,
} from '@kebun/shared';
import { useTables, rows, bySite } from '../lib/store';
import { Link } from '../lib/router';
import { Badge, Button, Card, Empty, Modal, Stat, Meter, Tabs } from '../components/ui';
import { ActivityForm, CompleteTaskForm, FORM_TABLES } from '../components/forms';
import { GardenView } from '../garden/GardenView';
import { TreePanel } from '../garden/TreePanel';

const KIND_ICON = { watering: <LuDroplets />, fertilizing: <LuSprout />, spraying: <LuSprayCan />, other: <LuCheck /> };

export default function Dashboard() {
  const s = useTables([...FORM_TABLES, 'tasks', 'daily_reports', 'tree_events', 'harvests', 'sales', 'expenses']);
  const [doing, setDoing] = useState<Schedule | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [treeId, setTreeId] = useState<string | null>(null);

  const sites = rows(s, 'sites');
  const gardenSiteId = s.siteId !== 'all' ? s.siteId : sites[0]?.id;
  const [gardenSite, setGardenSite] = useState<string | undefined>(undefined);
  const site = sites.find((x) => x.id === (gardenSite ?? gardenSiteId));

  const trees = bySite(rows(s, 'trees'), s.siteId);
  const varieties = rows(s, 'varieties');
  const vmap = useMemo(() => new Map(varieties.map((v) => [v.code, v])), [varieties]);
  const schedules = bySite(rows(s, 'schedules'), s.siteId).filter((x) => x.active);
  const due = schedules.filter((x) => ['overdue', 'today', 'soon'].includes(dueStatus(x))).sort((a, b) => a.next_due.localeCompare(b.next_due));
  const tasks = openTasks(bySite(rows(s, 'tasks'), s.siteId), s.isOwner ? null : s.me?.id).slice(0, 6);
  const low = lowStock(rows(s, 'supplies'));
  const reports = bySite(rows(s, 'daily_reports'), s.siteId).slice(0, 3);
  const problems = bySite(rows(s, 'tree_events'), s.siteId).filter((e) => (e.kind === 'pest' || e.kind === 'disease') && !e.resolved).slice(0, 5);
  const profiles = rows(s, 'profiles');
  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? '';
  const treeName = (id: string | null) => rows(s, 'trees').find((x) => x.id === id)?.name ?? '';

  const phases = { flowering: 0, fruiting: 0, ready: 0 } as Record<string, number>;
  for (const tr of trees) { const p = effectivePhase(tr, vmap.get(tr.variety_code ?? '')); if (p in phases) phases[p]++; }
  const young = trees.filter((x) => ageYears(x) < 5).length;

  const upcoming = trees
    .map((tr) => ({ tr, exp: expectedHarvest(tr, vmap.get(tr.variety_code ?? '')) }))
    .filter((x) => x.exp)
    .sort((a, b) => a.exp!.localeCompare(b.exp!))
    .slice(0, 6);

  const month = today().slice(0, 7);
  const incomeMonth = sumBy(bySite(rows(s, 'sales'), s.siteId).filter((x) => x.sale_date.startsWith(month)), (x) => x.total);
  const expenseMonth = sumBy(bySite(rows(s, 'expenses'), s.siteId).filter((x) => x.expense_date.startsWith(month)), (x) => x.amount);
  const harvestMonth = sumBy(bySite(rows(s, 'harvests'), s.siteId).filter((x) => x.harvest_date.startsWith(month)), (x) => x.weight_kg);

  const h = new Date().getHours();
  const part = h < 11 ? 'dash.morning' : h < 15 ? 'dash.noon' : h < 18 ? 'dash.afternoon' : 'dash.evening';
  const selectedTree = rows(s, 'trees').find((x) => x.id === treeId);

  return (
    <div className="dash">
      <div className="dash-hello">
        <h1>{t('dash.hello', { part: t(part), name: (s.me?.full_name ?? '').split(' ')[0] })}</h1>
        <p className="muted">{dateLabel(today(), s.lang)}</p>
      </div>

      <div className="dash-top">
        <Card className="dash-garden" pad={false}
          title={site?.name ?? t('nav.garden')}
          actions={<>
            {sites.length > 1 && s.siteId === 'all' && (
              <Tabs value={site?.id ?? ''} onChange={(v) => setGardenSite(v)} items={sites.map((x) => ({ value: x.id, label: x.name }))} />
            )}
            <Link to="/garden" className="link-more">{t('dash.openGarden')} <LuChevronRight /></Link>
          </>}>
          {site ? <GardenView compact site={site} selectedId={treeId} onSelect={setTreeId} /> : <Empty />}
        </Card>

        <Card className="dash-todo" title={t('dash.todo')} actions={<Link to="/schedules" className="link-more">{t('common.seeAll')} <LuChevronRight /></Link>}>
          {due.length === 0 && tasks.length === 0 && <Empty>{t('dash.nothingDue')}</Empty>}
          <ul className="todo-list">
            {due.map((x) => {
              const st = dueStatus(x);
              return (
                <li key={x.id} className={`todo todo-${st}`}>
                  <span className={`todo-icon kind-${x.kind}`}>{KIND_ICON[x.kind]}</span>
                  <div className="todo-main">
                    <b>{x.title}</b>
                    <span className="muted">{sites.find((y) => y.id === x.site_id)?.name}{x.tree_id ? ` · ${treeName(x.tree_id)}` : ''}{x.assigned_to && nameOf(x.assigned_to) ? ` · ${nameOf(x.assigned_to)}` : ''}</span>
                  </div>
                  <Badge tone={st === 'overdue' ? 'bad' : st === 'today' ? 'warn' : 'neutral'}>{relDays(x.next_due, s.lang)}</Badge>
                  {st !== 'soon' && <Button size="sm" variant="primary" className="btn-round" icon={<LuCheck />} onClick={() => setDoing(x)} aria-label={t('dash.markDone')} title={t('dash.markDone')} />}
                </li>
              );
            })}
            {tasks.map((x) => (
              <li key={x.id} className="todo">
                <span className="todo-icon kind-task"><LuCheck /></span>
                <div className="todo-main">
                  <b>{x.title}</b>
                  <span className="muted">{x.assigned_to ? nameOf(x.assigned_to) : t('common.unassigned')}{x.site_id ? ` · ${sites.find((y) => y.id === x.site_id)?.name}` : ''}</span>
                </div>
                {x.due_date && <Badge tone={daysBetween(today(), x.due_date) < 0 ? 'bad' : 'neutral'}>{relDays(x.due_date, s.lang)}</Badge>}
                <Button size="sm" className="btn-round" icon={<LuCheck />} onClick={() => setCompleting(x)} aria-label={t('task.complete')} title={t('task.complete')} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="stat-row">
        <Stat label={t('dash.trees')} value={trees.length} sub={`${t('tree.youngGroup').split(' ')[0]} ${young} · ${t('tree.matureGroup').split(' ')[0]} ${trees.length - young}`} />
        <Stat label={t('dash.flowering')} value={phases.flowering} tone="bloom" />
        <Stat label={t('dash.fruiting')} value={phases.fruiting} tone="good" />
        <Stat label={t('dash.ready')} value={phases.ready} tone="gold" />
        <Stat label={t('dash.monthHarvest')} value={`${num(harvestMonth, s.lang, 0)} kg`} />
        {s.isOwner && <Stat label={t('dash.monthIncome')} value={rupiahShort(incomeMonth, s.lang)} sub={`${t('fin.expense')}: ${rupiahShort(expenseMonth, s.lang)}`} />}
      </div>

      <div className="dash-grid">
        <Card title={t('dash.lowStock')} actions={<Link to="/stock" className="link-more">{t('nav.stock')} <LuChevronRight /></Link>}>
          {low.length === 0 ? <p className="ok-line">{t('dash.allStocked')}</p> : (
            <ul className="stock-mini">
              {low.map((x) => (
                <li key={x.id}>
                  <div className="row-between"><b>{x.name}</b><span className="bad-text">{qty(x.stock, x.unit, s.lang)}</span></div>
                  <Meter value={x.stock} max={x.min_stock * 2} tone={x.stock <= x.min_stock / 2 ? 'bad' : 'warn'} />
                  <small className="muted">{t('stock.min')}: {qty(x.min_stock, x.unit, s.lang)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('dash.upcomingHarvest')} actions={<Link to="/harvest" className="link-more">{t('nav.harvest')} <LuChevronRight /></Link>}>
          {upcoming.length === 0 ? <Empty>{t('dash.noHarvest')}</Empty> : (
            <ul className="plain list-rows">
              {upcoming.map(({ tr, exp }) => (
                <li key={tr.id} className="row-between clickable" onClick={() => setTreeId(tr.id)}>
                  <span><b>{tr.name}</b> <span className="muted">{sites.find((y) => y.id === tr.site_id)?.name}</span></span>
                  <Badge tone={daysBetween(today(), exp!) <= 7 ? 'gold' : 'neutral'}>{dateLabel(exp, s.lang, false)} · {relDays(exp!, s.lang)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('tree.problems')} actions={<Link to="/records" className="link-more">{t('nav.records')} <LuChevronRight /></Link>}>
          {problems.length === 0 ? <p className="ok-line">{t('health.healthy')} 🌿</p> : (
            <ul className="plain list-rows">
              {problems.map((e) => (
                <li key={e.id} className="row-between clickable" onClick={() => setTreeId(e.tree_id)}>
                  <span><span className={e.severity === 'high' ? 'bad-text' : 'warn-text'}><LuTriangleAlert /></span> <b>{treeName(e.tree_id)}</b> {e.title}</span>
                  <span className="muted">{dateLabel(e.event_date, s.lang, false)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('dash.latestReports')} actions={<Link to="/reports" className="link-more">{t('common.seeAll')} <LuChevronRight /></Link>}>
          {reports.length === 0 ? <Empty /> : (
            <ul className="plain report-mini">
              {reports.map((r) => (
                <li key={r.id}>
                  <div className="row-between"><b>{nameOf(r.author)}</b><span className="muted">{dateLabel(r.report_date, s.lang, false)}</span></div>
                  <p>{r.work_done}</p>
                  {r.issues && <p className="warn-text">⚠ {r.issues}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {doing && <ActivityForm schedule={doing} onClose={() => setDoing(null)} />}
      {completing && <CompleteTaskForm task={completing} onClose={() => setCompleting(null)} />}
      {selectedTree && (
        <Modal title={selectedTree.name} onClose={() => setTreeId(null)}>
          <TreePanel tree={selectedTree} />
        </Modal>
      )}
    </div>
  );
}
