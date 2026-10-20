// Catatan Pohon: flowering, fruit set, pests, diseases, treatments — per tree.

import { useState } from 'react';
import { LuPlus, LuCheck } from 'react-icons/lu';
import { t, dateLabel, type TreeEvent, type TreeEventKind } from '@kebun/shared';
import { useTables, rows, bySite } from '../lib/store';
import { navigate } from '../lib/router';
import { Badge, Button, Card, Empty, PageHeader, PhotoThumbs, RowActions, Tabs } from '../components/ui';
import { FORM_TABLES, TreeEventForm } from '../components/forms';

const KINDS: TreeEventKind[] = ['flowering', 'fruit_set', 'pest', 'disease', 'treatment', 'note'];

export default function Records() {
  const s = useTables([...FORM_TABLES, 'tree_events']);
  const [tab, setTab] = useState<'problems' | 'all'>('problems');
  const [kind, setKind] = useState('');
  const [form, setForm] = useState(false);
  const trees = rows(s, 'trees');
  const sites = rows(s, 'sites');
  const profiles = rows(s, 'profiles');

  const list = bySite(rows(s, 'tree_events'), s.siteId).filter((e) =>
    tab === 'problems' ? (e.kind === 'pest' || e.kind === 'disease') && !e.resolved : !kind || e.kind === kind);

  /** Mark a problem solved; if the tree has no other open problems, it becomes healthy again. */
  const resolve = async (e: TreeEvent) => {
    await s.update('tree_events', e.id, { resolved: true }, false);
    const stillOpen = rows(s, 'tree_events').some((x) => x.id !== e.id && x.tree_id === e.tree_id && (x.kind === 'pest' || x.kind === 'disease') && !x.resolved);
    const tree = trees.find((x) => x.id === e.tree_id);
    if (!stillOpen && tree && (tree.health === 'watch' || tree.health === 'sick')) await s.update('trees', tree.id, { health: 'healthy' });
    else s.toast(t('common.saved'));
  };

  const tone = (k: string) => (k === 'pest' || k === 'disease' ? 'warn' : k === 'flowering' ? 'bloom' : k === 'fruit_set' ? 'good' : 'neutral');

  return (
    <div className="narrow-wide">
      <PageHeader title={t('nav.records')} actions={<Button icon={<LuPlus />} variant="primary" onClick={() => setForm(true)}>{t('tree.recordEvent')}</Button>} />
      <div className="filters">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'problems', label: t('tree.problems') }, { value: 'all', label: t('common.all') }]} />
        {tab === 'all' && (
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('event.kind')}>
            <option value="">{t('event.kind')}: {t('common.all')}</option>
            {KINDS.map((k) => <option key={k} value={k}>{t('event.' + k)}</option>)}
          </select>
        )}
      </div>
      <Card pad={false}>
        {list.length === 0 ? <Empty>{tab === 'problems' ? `${t('health.healthy')} 🌿` : undefined}</Empty> : (
          <ul className="event-list">
            {list.slice(0, 300).map((e) => {
              const tree = trees.find((x) => x.id === e.tree_id);
              return (
                <li key={e.id} className="event">
                  <div className="event-main">
                    <div>
                      <Badge tone={tone(e.kind) as any}>{t('event.' + e.kind)}</Badge>{' '}
                      <button className="linklike" onClick={() => navigate(`/trees/${e.tree_id}`)}><b>{tree?.name ?? '?'}</b></button>
                      <span className="muted"> · {sites.find((x) => x.id === e.site_id)?.name} · {dateLabel(e.event_date, s.lang)}</span>
                    </div>
                    {(e.title || e.count) && <div>{e.title}{e.count ? ` ${e.count} buah` : ''} {e.severity && <Badge tone={e.severity === 'high' ? 'bad' : e.severity === 'medium' ? 'warn' : 'neutral'}>{t('sev.' + e.severity)}</Badge>}</div>}
                    {e.note && <p className="small">{e.note}</p>}
                    <PhotoThumbs paths={e.photos} size={64} />
                    <span className="muted small">{profiles.find((p) => p.id === e.created_by)?.full_name}</span>
                  </div>
                  <div className="row-gap">
                    {e.resolved && <Badge tone="good">{t('event.resolved')}</Badge>}
                    {s.isOwner && !e.resolved && (e.kind === 'pest' || e.kind === 'disease') && (
                      <Button size="sm" icon={<LuCheck />} onClick={() => resolve(e)}>{t('event.markResolved')}</Button>
                    )}
                    {s.isOwner && <RowActions onDelete={() => s.remove('tree_events', e.id)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {form && <TreeEventForm onClose={() => setForm(false)} />}
    </div>
  );
}
