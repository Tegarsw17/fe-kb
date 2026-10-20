// Laporan Harian: workers' daily reports with photos.

import { useState } from 'react';
import { LuPlus, LuTriangleAlert } from 'react-icons/lu';
import { t, dateLabel, today, type DailyReport } from '@kebun/shared';
import { useTables, rows, bySite } from '../lib/store';
import { Button, Card, Empty, PageHeader, PhotoThumbs, RowActions } from '../components/ui';
import { FORM_TABLES, ReportForm } from '../components/forms';

export default function Reports() {
  const s = useTables([...FORM_TABLES, 'daily_reports']);
  const [form, setForm] = useState<null | 'add' | DailyReport>(null);
  const [who, setWho] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const profiles = rows(s, 'profiles');
  const sites = rows(s, 'sites');
  const list = bySite(rows(s, 'daily_reports'), s.siteId).filter((r) => (!who || r.author === who) && (!onlyIssues || r.issues.trim()));
  const mineToday = rows(s, 'daily_reports').some((r) => r.author === s.me?.id && r.report_date === today());

  // group by date
  const groups = new Map<string, DailyReport[]>();
  for (const r of list) groups.set(r.report_date, [...(groups.get(r.report_date) ?? []), r]);

  return (
    <div className="narrow-wide">
      <PageHeader
        title={t('nav.reports')}
        subtitle={mineToday ? `✔ ${t('report.todayDone')}` : undefined}
        actions={<Button icon={<LuPlus />} variant="primary" onClick={() => setForm('add')}>{t('report.add')}</Button>}
      />
      <div className="filters">
        {s.isOwner && (
          <select className="select" value={who} onChange={(e) => setWho(e.target.value)} aria-label={t('report.author')}>
            <option value="">{t('report.author')}: {t('common.all')}</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}
        <label className="check"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> <span>{t('report.issues')}</span></label>
      </div>
      {list.length === 0 ? <Card><Empty action={<Button variant="primary" onClick={() => setForm('add')}>{t('report.add')}</Button>} /></Card> : (
        [...groups.entries()].map(([date, items]) => (
          <section key={date} className="day-group">
            <h3 className="day-title">{dateLabel(date, s.lang)}</h3>
            {items.map((r) => (
              <Card key={r.id} className="report-card">
                <div className="row-between">
                  <div>
                    <b>{profiles.find((p) => p.id === r.author)?.full_name ?? '–'}</b>
                    <span className="muted"> · {sites.find((x) => x.id === r.site_id)?.name ?? '–'}</span>
                  </div>
                  {(s.isOwner || (r.author === s.me?.id && r.report_date === today())) && (
                    <RowActions onEdit={() => setForm(r)} onDelete={s.isOwner ? () => s.remove('daily_reports', r.id) : undefined} />
                  )}
                </div>
                <p className="pre">{r.work_done}</p>
                {r.issues && <p className="issue"><LuTriangleAlert /> <span className="pre">{r.issues}</span></p>}
                <PhotoThumbs paths={r.photos} size={88} />
              </Card>
            ))}
          </section>
        ))
      )}
      {form === 'add' && <ReportForm onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && <ReportForm report={form} onClose={() => setForm(null)} />}
    </div>
  );
}
