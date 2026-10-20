// Kebun 3D: full-size garden with tree search and a details panel.

import { useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { t } from '@kebun/shared';
import { useTables, rows } from '../lib/store';
import { Empty, Tabs } from '../components/ui';
import { FORM_TABLES } from '../components/forms';
import { GardenView } from '../garden/GardenView';
import { TreePanel } from '../garden/TreePanel';

export default function Garden() {
  const s = useTables([...FORM_TABLES, 'tree_events', 'harvests']);
  const sites = rows(s, 'sites');
  const [siteId, setSiteId] = useState<string | undefined>(s.siteId !== 'all' ? s.siteId : undefined);
  const site = sites.find((x) => x.id === siteId) ?? sites[0];
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const tree = rows(s, 'trees').find((x) => x.id === selected);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const needle = q.trim().toLowerCase();
    if (!needle) return;
    const all = rows(s, 'trees');
    const hit = all.find((x) => x.site_id === site?.id && x.name.toLowerCase() === needle)
      ?? all.find((x) => x.name.toLowerCase() === needle)
      ?? all.find((x) => x.name.toLowerCase().includes(needle));
    if (hit) { setSiteId(hit.site_id); setSelected(hit.id); }
    else s.toast(`"${q}" ?`, 'error');
  };

  if (!s.ready) return <p className="muted">{t('common.loading')}</p>;
  if (!site) return <Empty>{t('garden.emptySite')}</Empty>;

  return (
    <div className="garden-page">
      <div className="garden-page-head">
        <Tabs value={site.id} onChange={(v) => { setSiteId(v); setSelected(null); }} items={sites.map((x) => ({ value: x.id, label: x.name }))} />
        <form className="search" onSubmit={search}>
          <LuSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tree.find')} aria-label={t('tree.find')} />
        </form>
      </div>
      <div className={`garden-layout ${tree ? 'with-panel' : ''}`}>
        <GardenView site={site} selectedId={selected} onSelect={setSelected} />
        {tree && <aside className="garden-side"><TreePanel tree={tree} onClose={() => setSelected(null)} /></aside>}
      </div>
    </div>
  );
}
