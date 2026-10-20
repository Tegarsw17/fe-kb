// Tugas: assign work, workers mark it done (with note & photo).

import { useState } from 'react';
import { LuPlus, LuCheck, LuRotateCcw } from 'react-icons/lu';
import { t, dateLabel, relDays, daysBetween, today, type Task } from '@kebun/shared';
import { useTables, rows, bySite } from '../lib/store';
import { Badge, Button, Card, Empty, PageHeader, PhotoThumbs, RowActions, Tabs } from '../components/ui';
import { CompleteTaskForm, FORM_TABLES, TaskForm } from '../components/forms';

export default function Tasks() {
  const s = useTables([...FORM_TABLES, 'tasks']);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [form, setForm] = useState<null | 'add' | Task>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [who, setWho] = useState('');

  const profiles = rows(s, 'profiles');
  const sites = rows(s, 'sites');
  const trees = rows(s, 'trees');
  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? t('common.unassigned');
  const list = bySite(rows(s, 'tasks'), s.siteId)
    .filter((x) => x.status === tab && (!who || x.assigned_to === who))
    .sort((a, b) => tab === 'todo' ? (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') : (b.done_at ?? '').localeCompare(a.done_at ?? ''));

  return (
    <div className="narrow-wide">
      <PageHeader title={t('nav.tasks')} actions={<Button icon={<LuPlus />} variant="primary" onClick={() => setForm('add')}>{t('task.add')}</Button>} />
      <div className="filters">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'todo', label: t('task.todo') }, { value: 'done', label: t('task.done') }]} />
        {s.isOwner && (
          <select className="select" value={who} onChange={(e) => setWho(e.target.value)} aria-label={t('task.assignee')}>
            <option value="">{t('task.assignee')}: {t('common.all')}</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}
      </div>
      <Card pad={false}>
        {list.length === 0 ? <Empty /> : (
          <ul className="task-list">
            {list.map((x) => {
              const late = x.status === 'todo' && x.due_date && daysBetween(today(), x.due_date) < 0;
              return (
                <li key={x.id} className={`task ${x.status}`}>
                  <button className={`task-check ${x.status === 'done' ? 'on' : ''}`} aria-label={t('task.complete')}
                    onClick={() => x.status === 'todo' && setCompleting(x)}>{x.status === 'done' && <LuCheck />}</button>
                  <div className="task-main">
                    <b>{x.title}</b>
                    {x.description && <p>{x.description}</p>}
                    <div className="muted small">
                      {nameOf(x.assigned_to)}
                      {x.site_id && ` · ${sites.find((y) => y.id === x.site_id)?.name}`}
                      {x.tree_id && ` · ${trees.find((y) => y.id === x.tree_id)?.name}`}
                    </div>
                    {x.status === 'done' && (
                      <div className="done-box">
                        <span className="small">✔ {nameOf(x.done_by)} · {x.done_at ? dateLabel(x.done_at.slice(0, 10), s.lang) : ''}</span>
                        {x.done_note && <p className="small">{x.done_note}</p>}
                        {x.photo && <PhotoThumbs paths={[x.photo]} size={56} />}
                      </div>
                    )}
                  </div>
                  <div className="task-side">
                    {x.due_date && x.status === 'todo' && <Badge tone={late ? 'bad' : 'neutral'}>{dateLabel(x.due_date, s.lang, false)} · {relDays(x.due_date, s.lang)}</Badge>}
                    {s.isOwner && (
                      <span className="row-gap">
                        {x.status === 'done' && (
                          <Button size="sm" variant="ghost" icon={<LuRotateCcw />}
                            onClick={() => s.update('tasks', x.id, { status: 'todo', done_at: null, done_by: null })}>{t('task.todo')}</Button>
                        )}
                        <RowActions onEdit={() => setForm(x)} onDelete={() => s.remove('tasks', x.id)} />
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {form === 'add' && <TaskForm onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && <TaskForm task={form} onClose={() => setForm(null)} />}
      {completing && <CompleteTaskForm task={completing} onClose={() => setCompleting(null)} />}
    </div>
  );
}
