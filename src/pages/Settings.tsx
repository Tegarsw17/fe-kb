// Pengaturan: language, sites (size, grid, location), varieties, backup, demo.

import { useState } from 'react';
import { LuPlus, LuDownload, LuMapPin, LuRotateCcw } from 'react-icons/lu';
import { t, type Site, type Variety, type TableName, DemoRepo } from '@kebun/shared';
import { useStore, useTables, rows } from '../lib/store';
import { downloadText } from '../lib/csv';
import { safeStorage } from '../lib/backend';
import { Button, Card, ConfirmButton, PageHeader, RowActions, Tabs } from '../components/ui';
import { FormModal } from '../components/FormModal';

function SiteForm({ site, onClose }: { site?: Site; onClose: () => void }) {
  const s = useStore();
  return (
    <FormModal
      title={site ? `${t('common.edit')}: ${site.name}` : t('set.addSite')}
      initial={site ?? { area_ha: 1, grid_rows: 12, grid_cols: 12, spacing_m: 8 }}
      onClose={onClose}
      fields={[
        { name: 'name', label: t('common.name'), required: true, placeholder: 'Kebun D' },
        { name: 'area_ha', label: t('set.area'), type: 'number', min: 0, half: true, suffix: 'ha' },
        { name: 'spacing_m', label: t('set.spacing'), type: 'number', min: 1, half: true, suffix: 'm' },
        { name: 'grid_rows', label: t('set.gridRows'), type: 'number', min: 1, required: true, half: true },
        { name: 'grid_cols', label: t('set.gridCols'), type: 'number', min: 1, required: true, half: true, help: t('set.gridHelp') },
        { name: 'lat', label: t('set.lat'), type: 'number', half: true, placeholder: '-7.6123' },
        { name: 'lng', label: t('set.lng'), type: 'number', half: true, placeholder: '110.9876', help: t('set.locHelp') },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      extra={(_v, patch) => (
        <Button type="button" size="sm" variant="ghost" icon={<LuMapPin />} onClick={() => {
          navigator.geolocation?.getCurrentPosition(
            (p) => patch({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
            () => s.toast('Lokasi tidak diizinkan', 'error'),
          );
        }}>{t('set.useMyLocation')}</Button>
      )}
      onSubmit={async (v) => {
        if (site) await s.update('sites', site.id, v as Partial<Site>);
        else await s.insert('sites', v as Partial<Site>);
      }}
    />
  );
}

function VarietyForm({ variety, onClose }: { variety?: Variety; onClose: () => void }) {
  const s = useStore();
  return (
    <FormModal
      title={variety ? `${t('common.edit')}: ${variety.code}` : t('set.addVariety')}
      initial={variety ?? { color: '#4f8a3c', days_to_ripe: 110 }}
      onClose={onClose}
      fields={[
        { name: 'code', label: t('set.code'), required: true, half: true, placeholder: 'MK' },
        { name: 'name', label: t('common.name'), required: true, half: true, placeholder: 'Musang King' },
        { name: 'days_to_ripe', label: t('set.daysToRipe'), type: 'number', min: 30, half: true, suffix: t('sched.days'), help: 'Dari buah jadi sampai matang' },
        { name: 'color', label: t('set.color'), type: 'color', half: true },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      onSubmit={async (v) => {
        const vals = { ...v, code: String(v.code).trim().toUpperCase() } as Partial<Variety>;
        if (variety) await s.update('varieties', variety.code, vals);
        else await s.insert('varieties', vals);
      }}
    />
  );
}

const ALL_TABLES: TableName[] = ['profiles', 'sites', 'varieties', 'trees', 'supplies', 'supply_movements', 'schedules', 'activities', 'tasks', 'daily_reports', 'tree_events', 'harvests', 'sales', 'expenses'];

export default function Settings() {
  const s = useTables(['sites', 'varieties', 'trees', 'profiles']);
  const [tab, setTab] = useState<'sites' | 'varieties' | 'app'>(s.isOwner ? 'sites' : 'app');
  const [form, setForm] = useState<null | 'site' | 'variety' | { site: Site } | { variety: Variety }>(null);
  const sites = rows(s, 'sites');
  const varieties = rows(s, 'varieties');
  const trees = rows(s, 'trees');

  const backup = async () => {
    const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
    for (const tb of ALL_TABLES) out[tb] = await s.repo.list(tb);
    downloadText(`kebun-durian-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 1));
  };

  return (
    <div className="narrow-wide">
      <PageHeader title={t('nav.settings')} />
      <Tabs value={tab} onChange={setTab} items={[
        ...(s.isOwner ? [{ value: 'sites' as const, label: t('set.sites') }, { value: 'varieties' as const, label: t('set.varieties') }] : []),
        { value: 'app' as const, label: t('set.data') },
      ]} />

      {tab === 'sites' && s.isOwner && (
        <Card title={t('set.sites')} actions={<Button size="sm" variant="primary" icon={<LuPlus />} onClick={() => setForm('site')}>{t('set.addSite')}</Button>} pad={false}>
          <table className="table">
            <thead><tr><th>{t('common.name')}</th><th>{t('set.area')}</th><th>Grid</th><th>{t('nav.trees')}</th><th>Lokasi</th><th /></tr></thead>
            <tbody>
              {sites.map((x) => (
                <tr key={x.id}>
                  <td><b>{x.name}</b><div className="muted small">{x.notes}</div></td>
                  <td>{x.area_ha} ha</td>
                  <td>{x.grid_rows}×{x.grid_cols} · {x.spacing_m} m</td>
                  <td>{trees.filter((y) => y.site_id === x.id).length}</td>
                  <td className="muted small">{x.lat != null ? `${x.lat}, ${x.lng}` : '–'}</td>
                  <td><span className="row-gap">
                    <RowActions onEdit={() => setForm({ site: x })} />
                    <ConfirmButton label={t('common.delete')} confirmLabel={trees.some((y) => y.site_id === x.id) ? 'Hapus kebun + semua pohonnya?' : undefined}
                      onConfirm={() => s.remove('sites', x.id)} />
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'varieties' && s.isOwner && (
        <Card title={t('set.varieties')} actions={<Button size="sm" variant="primary" icon={<LuPlus />} onClick={() => setForm('variety')}>{t('set.addVariety')}</Button>} pad={false}>
          <table className="table">
            <thead><tr><th>{t('set.code')}</th><th>{t('common.name')}</th><th>{t('set.daysToRipe')}</th><th>{t('nav.trees')}</th><th /></tr></thead>
            <tbody>
              {varieties.map((v) => (
                <tr key={v.code}>
                  <td><span className="swatch" style={{ background: v.color }} /> <b>{v.code}</b></td>
                  <td>{v.name}</td>
                  <td>{v.days_to_ripe} {t('sched.days')}</td>
                  <td>{trees.filter((y) => y.variety_code === v.code).length}</td>
                  <td><RowActions onEdit={() => setForm({ variety: v })} onDelete={() => s.remove('varieties', v.code)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'app' && (
        <div className="grid-auto">
          <Card title={t('common.language')}>
            <Tabs value={s.lang} onChange={s.setLang} items={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }]} />
          </Card>
          <Card title={t('common.theme')}>
            <Tabs value={s.theme} onChange={s.setTheme} items={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t('theme.' + v) }))} />
          </Card>
          {s.isOwner && (
            <Card title="Backup">
              <p className="small muted">Unduh semua data sebagai file JSON. Simpan di tempat aman sebulan sekali.</p>
              <Button icon={<LuDownload />} onClick={backup}>Unduh backup</Button>
            </Card>
          )}
          {s.repo.kind === 'demo' && (
            <Card title={t('common.demo')}>
              <p className="small muted">{t('common.demoHint')}</p>
              <p className="small">Lihat aplikasi sebagai:</p>
              <div className="row-gap wrap">
                {rows(s, 'profiles').length > 0 && ['pemilik', 'budi', 'sari'].map((u) => (
                  <Button key={u} size="sm" variant={s.me?.username === u ? 'primary' : 'soft'} onClick={() => s.signIn(u, '')}>
                    {u === 'pemilik' ? t('role.owner') : `${t('role.worker')} (${u})`}
                  </Button>
                ))}
              </div>
              <hr />
              <ConfirmButton label={t('common.resetDemo')} confirmLabel={`${t('common.resetDemo')}?`} onConfirm={() => {
                (s.repo as DemoRepo).reset();
                safeStorage.remove('kd-site');
                location.reload();
              }}><Button icon={<LuRotateCcw />} variant="danger">{t('common.resetDemo')}</Button></ConfirmButton>
            </Card>
          )}
        </div>
      )}

      {form === 'site' && <SiteForm onClose={() => setForm(null)} />}
      {form === 'variety' && <VarietyForm onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && 'site' in form && <SiteForm site={form.site} onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && 'variety' in form && <VarietyForm variety={form.variety} onClose={() => setForm(null)} />}
    </div>
  );
}
