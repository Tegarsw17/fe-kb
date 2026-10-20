// Pohon: list, add, bulk-add, edit, delete trees; tree detail page.

import { useMemo, useState } from 'react';
import { LuPlus, LuLayers, LuSearch, LuDownload, LuChevronLeft } from 'react-icons/lu';
import {
  t, ageYears, ageLabel, effectivePhase, today, addDays, type Tree,
} from '@kebun/shared';
import { useStore, useTables, rows, bySite } from '../lib/store';
import { Link, navigate } from '../lib/router';
import { downloadCSV } from '../lib/csv';
import { Button, Card, Empty, PageHeader, RowActions } from '../components/ui';
import { FormModal, type Field } from '../components/FormModal';
import { FORM_TABLES, useOptions } from '../components/forms';
import { HealthBadge, PhaseBadge } from '../components/badges';
import { TreePanel } from '../garden/TreePanel';

// ------------------------------------------------------------------ tree form
export function TreeForm({ tree, onClose, initial }: { tree?: Tree; onClose: () => void; initial?: Partial<Tree> }) {
  const s = useStore();
  const o = useOptions();
  const all = o.raw.trees;

  /** Next name for a variety in a site, e.g. MK-37. */
  const nextName = (siteId: string, code: string) => {
    const nums = all.filter((x) => x.site_id === siteId && x.name.toUpperCase().startsWith(code.toUpperCase() + '-'))
      .map((x) => parseInt(x.name.split('-').pop() || '0', 10)).filter((n) => !isNaN(n));
    return `${code}-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  };
  /** First empty grid spot in a site. */
  const freeSpot = (siteId: string) => {
    const site = o.raw.sites.find((x) => x.id === siteId);
    if (!site) return { row_no: 1, col_no: 1 };
    const used = new Set(all.filter((x) => x.site_id === siteId).map((x) => `${x.row_no}-${x.col_no}`));
    for (let r = 1; r <= site.grid_rows; r++) for (let c = 1; c <= site.grid_cols; c++) if (!used.has(`${r}-${c}`)) return { row_no: r, col_no: c };
    return { row_no: site.grid_rows + 1, col_no: 1 };
  };
  const firstSite = s.siteId !== 'all' ? s.siteId : o.sites[0]?.value;
  const start = tree ?? { site_id: firstSite, phase: 'vegetative', health: 'healthy', ...freeSpot(firstSite), ...initial };

  return (
    <FormModal
      title={tree ? `${t('common.edit')}: ${tree.name}` : t('tree.add')}
      initial={start}
      onClose={onClose}
      onChange={(name, v) => {
        if (!tree && name === 'variety_code' && v.variety_code && (!v.name || /^[A-Z]+-\d+$/i.test(v.name))) return { name: nextName(v.site_id, v.variety_code) };
        if (!tree && name === 'site_id') return { ...freeSpot(v.site_id), name: v.variety_code ? nextName(v.site_id, v.variety_code) : v.name };
      }}
      fields={[
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, required: true, half: true },
        { name: 'variety_code', label: t('tree.variety'), type: 'select', options: o.varieties, half: true },
        { name: 'name', label: t('tree.name'), required: true, placeholder: 'DH-12', half: true },
        { name: 'planted_on', label: t('tree.plantedOn'), type: 'date', half: true },
        { name: 'row_no', label: t('tree.row'), type: 'number', min: 1, required: true, half: true },
        { name: 'col_no', label: t('tree.col'), type: 'number', min: 1, required: true, half: true },
        { name: 'phase', label: t('tree.phase'), type: 'select', required: true, half: true, options: ['vegetative', 'flowering', 'fruiting'].map((p) => ({ value: p, label: t('phase.' + p) })) },
        { name: 'health', label: t('tree.health'), type: 'select', required: true, half: true, options: ['healthy', 'watch', 'sick', 'dead'].map((p) => ({ value: p, label: t('health.' + p) })) },
        { name: 'phase_since', label: `${t('tree.phase')} — ${t('common.date')}`, type: 'date', show: (v) => v.phase !== 'vegetative', help: 'Tanggal mulai berbunga / buah jadi (untuk perkiraan panen)' },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ] as Field[]}
      onSubmit={async (v) => {
        const vals = { ...v, name: String(v.name).trim().toUpperCase(), phase_since: v.phase_since || today() } as Partial<Tree>;
        if (tree) await s.update('trees', tree.id, vals);
        else await s.insert('trees', vals);
      }}
    />
  );
}

// ------------------------------------------------------------------ bulk add
function BulkTreeForm({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={t('tree.bulk')}
      initial={{ site_id: s.siteId !== 'all' ? s.siteId : o.sites[0]?.value, count: 10, start: 1, planted_on: addDays(today(), -365) }}
      onClose={onClose}
      onChange={(name, v) => {
        if ((name === 'variety_code' || name === 'site_id') && v.variety_code) {
          const nums = o.raw.trees.filter((x) => x.site_id === v.site_id && x.name.startsWith(v.variety_code + '-'))
            .map((x) => parseInt(x.name.split('-').pop() || '0', 10)).filter((n) => !isNaN(n));
          return { start: (nums.length ? Math.max(...nums) : 0) + 1 };
        }
      }}
      fields={[
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, required: true, half: true },
        { name: 'variety_code', label: t('tree.variety'), type: 'select', options: o.varieties, required: true, half: true },
        { name: 'count', label: t('tree.bulkCount'), type: 'number', min: 1, required: true, half: true },
        { name: 'start', label: t('tree.bulkStart'), type: 'number', min: 1, required: true, half: true },
        { name: 'planted_on', label: t('tree.plantedOn'), type: 'date', half: true },
      ] as Field[]}
      extra={(v) => <p className="help">{t('tree.bulkHelp', { code: v.variety_code || 'MK' })}</p>}
      onSubmit={async (v) => {
        const site = o.raw.sites.find((x) => x.id === v.site_id)!;
        const existing = o.raw.trees.filter((x) => x.site_id === site.id);
        const used = new Set(existing.map((x) => `${x.row_no}-${x.col_no}`));
        const names = new Set(existing.map((x) => x.name.toUpperCase()));
        const out: Partial<Tree>[] = [];
        let n = Number(v.start);
        for (let r = 1; r <= site.grid_rows && out.length < v.count; r++) {
          for (let c = 1; c <= site.grid_cols && out.length < v.count; c++) {
            if (used.has(`${r}-${c}`)) continue;
            while (names.has(`${v.variety_code}-${n}`)) n++;
            out.push({ site_id: site.id, name: `${v.variety_code}-${n}`, variety_code: v.variety_code, row_no: r, col_no: c, planted_on: v.planted_on || null });
            n++;
          }
        }
        if (out.length < v.count) throw new Error(`Hanya ada ${out.length} titik kosong. Tambah baris/kolom di Pengaturan → Kebun.`);
        await s.insertMany('trees', out);
      }}
    />
  );
}

// ------------------------------------------------------------------ list page
export default function Trees() {
  const s = useTables([...FORM_TABLES, 'tree_events', 'harvests']);
  const [form, setForm] = useState<null | 'add' | 'bulk' | Tree>(null);
  const [q, setQ] = useState('');
  const [variety, setVariety] = useState('');
  const [phase, setPhase] = useState('');
  const [health, setHealth] = useState('');
  const [limit, setLimit] = useState(150);

  const sites = rows(s, 'sites');
  const varieties = rows(s, 'varieties');
  const vmap = useMemo(() => new Map(varieties.map((v) => [v.code, v])), [varieties]);
  const list = bySite(rows(s, 'trees'), s.siteId).filter((x) =>
    (!q || x.name.toLowerCase().includes(q.toLowerCase())) &&
    (!variety || x.variety_code === variety) &&
    (!phase || effectivePhase(x, vmap.get(x.variety_code ?? '')) === phase) &&
    (!health || x.health === health));

  const exportCsv = () => downloadCSV('pohon.csv', list.map((x) => ({
    name: x.name, variety: x.variety_code, site: sites.find((y) => y.id === x.site_id)?.name, row: x.row_no, col: x.col_no,
    planted_on: x.planted_on, phase: t('phase.' + x.phase), health: t('health.' + x.health), notes: x.notes,
  })));

  return (
    <div>
      <PageHeader
        title={t('nav.trees')}
        subtitle={t('tree.count', { n: list.length })}
        actions={s.isOwner && <>
          <Button icon={<LuDownload />} variant="ghost" onClick={exportCsv}>{t('common.export')}</Button>
          <Button icon={<LuLayers />} onClick={() => setForm('bulk')}>{t('tree.bulk')}</Button>
          <Button icon={<LuPlus />} variant="primary" onClick={() => setForm('add')}>{t('tree.add')}</Button>
        </>}
      />
      <div className="filters">
        <label className="search"><LuSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tree.find')} /></label>
        <select className="select" value={variety} onChange={(e) => setVariety(e.target.value)} aria-label={t('tree.variety')}>
          <option value="">{t('tree.variety')}: {t('common.all')}</option>
          {varieties.map((v) => <option key={v.code} value={v.code}>{v.code} · {v.name}</option>)}
        </select>
        <select className="select" value={phase} onChange={(e) => setPhase(e.target.value)} aria-label={t('tree.phase')}>
          <option value="">{t('tree.phase')}: {t('common.all')}</option>
          {['vegetative', 'flowering', 'fruiting', 'ready'].map((p) => <option key={p} value={p}>{t('phase.' + p)}</option>)}
        </select>
        <select className="select" value={health} onChange={(e) => setHealth(e.target.value)} aria-label={t('tree.health')}>
          <option value="">{t('tree.health')}: {t('common.all')}</option>
          {['healthy', 'watch', 'sick', 'dead'].map((p) => <option key={p} value={p}>{t('health.' + p)}</option>)}
        </select>
      </div>

      <Card pad={false}>
        {list.length === 0 ? <Empty action={s.isOwner && <Button variant="primary" icon={<LuPlus />} onClick={() => setForm('add')}>{t('tree.add')}</Button>} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('tree.name')}</th><th>{t('tree.variety')}</th><th>{t('common.site')}</th><th>{t('tree.position')}</th>
                  <th>{t('tree.age')}</th><th>{t('tree.phase')}</th><th>{t('tree.health')}</th><th />
                </tr>
              </thead>
              <tbody>
                {list.slice(0, limit).map((x) => (
                  <tr key={x.id} className="clickable" onClick={() => navigate(`/trees/${x.id}`)}>
                    <td><b>{x.name}</b></td>
                    <td>{x.variety_code ?? '–'}</td>
                    <td>{sites.find((y) => y.id === x.site_id)?.name}</td>
                    <td className="muted">{x.row_no}/{x.col_no}</td>
                    <td>{x.planted_on ? ageLabel(ageYears(x), s.lang) : '–'}</td>
                    <td><PhaseBadge phase={effectivePhase(x, vmap.get(x.variety_code ?? ''))} /></td>
                    <td><HealthBadge health={x.health} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {s.isOwner && <RowActions onEdit={() => setForm(x)} onDelete={() => s.remove('trees', x.id)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > limit && <div className="more-row"><Button onClick={() => setLimit(limit + 150)}>+ {Math.min(150, list.length - limit)}</Button></div>}
          </div>
        )}
      </Card>

      {form === 'add' && <TreeForm onClose={() => setForm(null)} />}
      {form === 'bulk' && <BulkTreeForm onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && <TreeForm tree={form} onClose={() => setForm(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ detail page
export function TreeDetail({ id }: { id: string }) {
  const s = useTables([...FORM_TABLES, 'tree_events', 'harvests']);
  const tree = rows(s, 'trees').find((x) => x.id === id);
  if (!s.ready) return <p className="muted">{t('common.loading')}</p>;
  if (!tree) return <Empty><Link to="/trees">{t('nav.trees')}</Link></Empty>;
  return (
    <div className="narrow">
      <Link to="/trees" className="back-link"><LuChevronLeft /> {t('nav.trees')}</Link>
      <Card><TreePanel tree={tree} full /></Card>
    </div>
  );
}
