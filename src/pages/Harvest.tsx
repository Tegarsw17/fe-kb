// Panen: harvest records and yield per site / variety / tree.

import { useMemo, useState } from 'react';
import { LuPlus, LuDownload } from 'react-icons/lu';
import { t, dateLabel, num, sumBy, expectedHarvest, relDays, type Harvest as H } from '@kebun/shared';
import { useTables, rows, bySite } from '../lib/store';
import { navigate } from '../lib/router';
import { downloadCSV } from '../lib/csv';
import { Badge, Button, Card, Empty, PageHeader, RowActions, Stat } from '../components/ui';
import { FORM_TABLES, HarvestForm } from '../components/forms';
import { HBars } from '../components/charts';

export default function Harvest() {
  const s = useTables([...FORM_TABLES, 'harvests']);
  const years = useMemo(() => {
    const ys = new Set(rows(s, 'harvests').map((h) => Number(h.harvest_date.slice(0, 4))));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [s.data.harvests]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState(false);

  const sites = rows(s, 'sites');
  const trees = rows(s, 'trees');
  const varieties = rows(s, 'varieties');
  const list = bySite(rows(s, 'harvests'), s.siteId).filter((h) => h.harvest_date.startsWith(String(year)));
  const kg = sumBy(list, (h) => h.weight_kg);
  const fruits = sumBy(list, (h) => h.fruit_count);
  const treeOf = (h: H) => trees.find((x) => x.id === h.tree_id);

  const perSite = sites.map((x) => ({ label: x.name, value: sumBy(list.filter((h) => h.site_id === x.id), (h) => h.weight_kg) })).filter((x) => x.value > 0);
  const perVariety = varieties.map((v) => ({ label: v.code, value: sumBy(list.filter((h) => treeOf(h)?.variety_code === v.code), (h) => h.weight_kg) })).filter((x) => x.value > 0);
  const perTree = new Map<string, number>();
  for (const h of list) if (h.tree_id) perTree.set(h.tree_id, (perTree.get(h.tree_id) ?? 0) + Number(h.weight_kg));
  const top = [...perTree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const vmap = new Map(varieties.map((v) => [v.code, v]));
  const coming = bySite(trees, s.siteId).map((tr) => ({ tr, exp: expectedHarvest(tr, vmap.get(tr.variety_code ?? '')) }))
    .filter((x) => x.exp).sort((a, b) => a.exp!.localeCompare(b.exp!));

  return (
    <div>
      <PageHeader
        title={t('nav.harvest')}
        actions={<>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('common.year')}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="ghost" icon={<LuDownload />} onClick={() => downloadCSV(`panen-${year}.csv`, list.map((h) => ({
            date: h.harvest_date, site: sites.find((x) => x.id === h.site_id)?.name, tree: treeOf(h)?.name, variety: treeOf(h)?.variety_code,
            fruits: h.fruit_count, kg: h.weight_kg, grade: h.grade, note: h.note,
          })))}>{t('common.export')}</Button>
          <Button variant="primary" icon={<LuPlus />} onClick={() => setForm(true)}>{t('harvest.add')}</Button>
        </>}
      />
      <div className="stat-row">
        <Stat label={t('harvest.thisYear')} value={`${num(kg, s.lang, 0)} kg`} />
        <Stat label={t('harvest.fruits')} value={num(fruits, s.lang, 0)} />
        <Stat label={t('harvest.avgFruit')} value={`${num(fruits ? kg / fruits : 0, s.lang, 2)} kg`} />
        <Stat label={t('dash.upcomingHarvest')} value={coming.length} tone="gold" sub={coming[0] ? `${coming[0].tr.name} · ${relDays(coming[0].exp!, s.lang)}` : undefined} />
      </div>

      <div className="grid-3">
        <Card title={t('harvest.perSite')}>{perSite.length ? <HBars data={perSite} unit="kg" /> : <Empty />}</Card>
        <Card title={t('tree.variety')}>{perVariety.length ? <HBars data={perVariety} unit="kg" /> : <Empty />}</Card>
        <Card title={t('harvest.topTrees')}>
          {top.length === 0 ? <Empty /> : (
            <ol className="rank">
              {top.map(([id, v]) => (
                <li key={id} className="clickable" onClick={() => navigate(`/trees/${id}`)}>
                  <span><b>{trees.find((x) => x.id === id)?.name}</b> <span className="muted">{sites.find((x) => x.id === trees.find((y) => y.id === id)?.site_id)?.name}</span></span>
                  <span>{num(v, s.lang)} kg</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card pad={false} title={`${t('nav.harvest')} ${year}`}>
        {list.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('common.date')}</th><th>{t('common.site')}</th><th>{t('nav.trees')}</th><th className="num">{t('harvest.fruits')}</th><th className="num">kg</th><th>{t('harvest.grade')}</th><th>{t('common.note')}</th><th /></tr></thead>
              <tbody>
                {list.slice(0, 300).map((h) => (
                  <tr key={h.id}>
                    <td>{dateLabel(h.harvest_date, s.lang)}</td>
                    <td>{sites.find((x) => x.id === h.site_id)?.name}</td>
                    <td>{treeOf(h)?.name ?? '–'}</td>
                    <td className="num">{h.fruit_count}</td>
                    <td className="num">{num(h.weight_kg, s.lang)}</td>
                    <td>{h.grade ? <Badge>{h.grade}</Badge> : '–'}</td>
                    <td>{h.note}</td>
                    <td>{s.isOwner && <RowActions onDelete={() => s.remove('harvests', h.id)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {form && <HarvestForm onClose={() => setForm(false)} />}
    </div>
  );
}

