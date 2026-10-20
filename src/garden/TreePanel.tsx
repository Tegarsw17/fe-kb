// Details for one tree: shown beside the garden or on the tree page.

import { useState } from 'react';
import { LuBug, LuShoppingBasket, LuSprout, LuPencil, LuChevronRight, LuX } from 'react-icons/lu';
import {
  t, ageYears, ageLabel, growthStage, effectivePhase, expectedHarvest, dateLabel, relDays, num,
  dueStatus, type Tree,
} from '@kebun/shared';
import { useStore, rows } from '../lib/store';
import { Link } from '../lib/router';
import { Badge, Button, IconButton } from '../components/ui';
import { ActivityForm, HarvestForm, TreeEventForm } from '../components/forms';
import { TreeForm } from '../pages/Trees';
import { HealthBadge, PhaseBadge } from '../components/badges';

export function TreePanel({ tree, onClose, full = false }: { tree: Tree; onClose?: () => void; full?: boolean }) {
  const s = useStore();
  const [form, setForm] = useState<null | 'event' | 'harvest' | 'activity' | 'edit'>(null);
  const variety = rows(s, 'varieties').find((v) => v.code === tree.variety_code);
  const site = rows(s, 'sites').find((x) => x.id === tree.site_id);
  const years = ageYears(tree);
  const phase = effectivePhase(tree, variety);
  const exp = expectedHarvest(tree, variety);
  const schedules = rows(s, 'schedules').filter((x) => x.active && x.site_id === tree.site_id && (!x.tree_id || x.tree_id === tree.id))
    .sort((a, b) => a.next_due.localeCompare(b.next_due));
  const events = rows(s, 'tree_events').filter((e) => e.tree_id === tree.id);
  const harvests = rows(s, 'harvests').filter((h) => h.tree_id === tree.id);
  const totalKg = harvests.reduce((a, h) => a + Number(h.weight_kg), 0);
  const problems = events.filter((e) => (e.kind === 'pest' || e.kind === 'disease') && !e.resolved);

  return (
    <div className={`tree-panel ${full ? 'full' : ''}`}>
      <header className="tp-head">
        <div>
          <h2 className="tp-name">{tree.name}</h2>
          <p className="muted">{variety?.name ?? tree.variety_code ?? '–'} · {site?.name}</p>
        </div>
        {onClose && <IconButton label={t('common.close')} onClick={onClose}><LuX /></IconButton>}
      </header>

      <div className="tp-badges">
        <PhaseBadge phase={phase} />
        <HealthBadge health={tree.health} />
        <Badge>{t('stage.' + growthStage(years))}</Badge>
      </div>

      <dl className="facts">
        <div><dt>{t('tree.age')}</dt><dd>{tree.planted_on ? ageLabel(years, s.lang) : '–'}</dd></div>
        <div><dt>{t('tree.plantedOn')}</dt><dd>{dateLabel(tree.planted_on, s.lang)}</dd></div>
        <div><dt>{t('tree.position')}</dt><dd>{t('tree.row')} {tree.row_no}, {t('tree.col')} {tree.col_no}</dd></div>
        <div><dt>{t('tree.totalHarvest')}</dt><dd>{num(totalKg, s.lang)} kg</dd></div>
        {exp && <div className="wide"><dt>{t('tree.expectedHarvest')}</dt><dd>{dateLabel(exp, s.lang)} <span className="muted">({relDays(exp, s.lang)})</span></dd></div>}
      </dl>

      {problems.length > 0 && (
        <div className="tp-section">
          <h3>{t('tree.problems')}</h3>
          <ul className="plain">
            {problems.map((p) => (
              <li key={p.id}><Badge tone={p.severity === 'high' ? 'bad' : 'warn'}>{t('event.' + p.kind)}</Badge> {p.title || '–'} <span className="muted">· {dateLabel(p.event_date, s.lang, false)}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="tp-section">
        <h3>{t('tree.nextCare')}</h3>
        {schedules.length === 0 ? <p className="muted">–</p> : (
          <ul className="plain">
            {schedules.slice(0, 4).map((x) => {
              const st = dueStatus(x);
              return (
                <li key={x.id} className="tp-sched">
                  <span>{x.title}</span>
                  <Badge tone={st === 'overdue' ? 'bad' : st === 'today' ? 'warn' : 'neutral'}>{relDays(x.next_due, s.lang)}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {full && events.length > 0 && (
        <div className="tp-section">
          <h3>{t('tree.history')}</h3>
          <ul className="timeline">
            {events.slice(0, 20).map((e) => (
              <li key={e.id}>
                <span className="tl-date">{dateLabel(e.event_date, s.lang)}</span>
                <span><b>{t('event.' + e.kind)}</b>{e.title ? ` — ${e.title}` : ''}{e.count ? ` (${e.count})` : ''}{e.note ? <span className="muted"> · {e.note}</span> : null}{e.resolved && <> <Badge tone="good">{t('event.resolved')}</Badge></>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {full && harvests.length > 0 && (
        <div className="tp-section">
          <h3>{t('nav.harvest')}</h3>
          <ul className="timeline">
            {harvests.slice(0, 12).map((h) => (
              <li key={h.id}><span className="tl-date">{dateLabel(h.harvest_date, s.lang)}</span><span>{h.fruit_count} buah · {num(h.weight_kg, s.lang)} kg {h.grade && <Badge>{h.grade}</Badge>}</span></li>
            ))}
          </ul>
        </div>
      )}

      {tree.notes && <p className="tp-notes">{tree.notes}</p>}

      <div className="tp-actions">
        <Button icon={<LuBug />} onClick={() => setForm('event')}>{t('tree.recordEvent')}</Button>
        <Button icon={<LuSprout />} onClick={() => setForm('activity')}>{t('act.log')}</Button>
        <Button icon={<LuShoppingBasket />} onClick={() => setForm('harvest')}>{t('harvest.add')}</Button>
        {s.isOwner && <Button icon={<LuPencil />} variant="ghost" onClick={() => setForm('edit')}>{t('common.edit')}</Button>}
        {!full && <Link className="btn btn-ghost btn-md" to={`/trees/${tree.id}`}><span>{t('tree.history')}</span><LuChevronRight /></Link>}
      </div>

      {form === 'event' && <TreeEventForm tree={tree} onClose={() => setForm(null)} />}
      {form === 'harvest' && <HarvestForm tree={tree} onClose={() => setForm(null)} />}
      {form === 'activity' && <ActivityForm initial={{ site_id: tree.site_id, tree_id: tree.id }} onClose={() => setForm(null)} />}
      {form === 'edit' && <TreeForm tree={tree} onClose={() => setForm(null)} />}
    </div>
  );
}
