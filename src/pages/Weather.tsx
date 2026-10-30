// Cuaca: live readings from the garden sensor, then current weather, 5-day forecast and farm tips for each site.

import { useState } from 'react';
import { LuDroplets, LuWind, LuCloudRain, LuThermometer, LuTriangleAlert } from 'react-icons/lu';
import { t, SKY_ICON, dateLabel, num, weatherTips, type Site } from '@kebun/shared';
import { useStore, useTables, rows } from '../lib/store';
import { Link } from '../lib/router';
import { Badge, Card, PageHeader, Tabs } from '../components/ui';
import { TimeLine } from '../components/charts';
import { useSensor, sensorConfigured, isStale, sensorTime, SENSOR_RANGES, type SensorRange } from '../lib/sensor';

function SensorCard() {
  const s = useStore();
  const [days, setDays] = useState<SensorRange>(1);
  const d = useSensor(days);
  const title = t('sensor.title');
  if (d === 'error') return <Card title={title}><p className="muted">{t('sensor.failed')}</p></Card>;
  if (!d) return <Card title={title}><p className="muted">{t('common.loading')}</p></Card>;
  const { latest, history } = d;
  const stale = isStale(latest);
  const when = sensorTime(latest.at, s.lang);
  const fmtTime = (x: Date) => sensorTime(x, s.lang);
  return (
    <Card title={title} className="sensor-card"
      actions={<>
        <Tabs value={String(days)} onChange={(v) => setDays(Number(v) as SensorRange)}
          items={SENSOR_RANGES.map((n) => ({ value: String(n), label: n === 1 ? t('sensor.range24h') : t('sensor.rangeDays', { n }) }))} />
        {stale ? <Badge tone="bad">{t('sensor.offline')}</Badge> : <Badge tone="good">{t('sensor.live')}</Badge>}
      </>}>
      {stale && <p className="issue"><LuTriangleAlert /> {t('sensor.stale', { when })}</p>}
      <div className="wx-now">
        <span className="wx-icon" aria-hidden><LuThermometer /></span>
        <div>
          <div className="wx-temp">{num(latest.temp, s.lang, 1)}°C</div>
          <div className="small muted">{t('sensor.updated', { when })}</div>
        </div>
        <ul className="wx-facts">
          <li><LuDroplets /> {t('weather.humidity')} {num(latest.humidity, s.lang, 1)}%</li>
        </ul>
      </div>
      {history.length > 1 && (
        <div className={`sensor-charts ${d.days !== days ? 'is-loading' : ''}`} aria-busy={d.days !== days}>
          <div>
            <h3 className="sub-title">{t('sensor.temp')} (°C)</h3>
            <TimeLine data={history.map((x) => ({ at: x.at, value: x.temp }))} label={t('sensor.temp')} unit="°C" lang={s.lang} fmtTime={fmtTime} />
          </div>
          <div>
            <h3 className="sub-title">{t('weather.humidity')} (%)</h3>
            <TimeLine data={history.map((x) => ({ at: x.at, value: x.humidity }))} label={t('weather.humidity')} unit="%" lang={s.lang} fmtTime={fmtTime} ceiling={100} />
          </div>
        </div>
      )}
    </Card>
  );
}

function SiteWeather({ site }: { site: Site }) {
  const s = useStore();
  const w = s.weather(site);
  if (site.lat == null || site.lng == null) {
    return <Card title={site.name}><p className="muted">{t('weather.noLocation')} <Link to="/settings">{t('nav.settings')}</Link></p></Card>;
  }
  if (w === 'error') return <Card title={site.name}><p className="muted">{t('weather.failed')}</p></Card>;
  if (!w) return <Card title={site.name}><p className="muted">{t('common.loading')}</p></Card>;
  return (
    <Card title={site.name} className="weather-card">
      <div className="wx-now">
        <span className="wx-icon" aria-hidden>{SKY_ICON[w.now.sky]}</span>
        <div>
          <div className="wx-temp">{Math.round(w.now.temp)}°C</div>
          <div>{t('sky.' + w.now.sky)}</div>
        </div>
        <ul className="wx-facts">
          <li><LuDroplets /> {t('weather.humidity')} {w.now.humidity}%</li>
          <li><LuWind /> {t('weather.wind')} {Math.round(w.now.wind)} km/j</li>
          <li><LuCloudRain /> {t('weather.rain')} {w.now.precipitation} mm</li>
        </ul>
      </div>
      <h3 className="sub-title">{t('weather.forecast')}</h3>
      <div className="wx-days">
        {w.days.map((d) => (
          <div key={d.date} className="wx-day">
            <div className="small">{dateLabel(d.date, s.lang, false)}</div>
            <div className="wx-day-icon" aria-hidden>{SKY_ICON[d.sky]}</div>
            <div><b>{Math.round(d.tmax)}°</b> <span className="muted">{Math.round(d.tmin)}°</span></div>
            <div className="small muted">{d.rain_prob}% · {d.rain_mm} mm</div>
          </div>
        ))}
      </div>
      <h3 className="sub-title">{t('weather.tips')}</h3>
      <ul className="tips">{weatherTips(w).map((k) => <li key={k}>{t(k)}</li>)}</ul>
    </Card>
  );
}

export default function Weather() {
  const s = useTables(['sites']);
  const sites = rows(s, 'sites').filter((x) => s.siteId === 'all' || x.id === s.siteId);
  return (
    <div>
      <PageHeader title={t('nav.weather')} subtitle="Open-Meteo" />
      {sensorConfigured && <SensorCard />}
      <div className="grid-auto">{sites.map((x) => <SiteWeather key={x.id} site={x} />)}</div>
    </div>
  );
}
