// Cuaca: current weather, 5-day forecast and farm tips for each site.

import { LuDroplets, LuWind, LuCloudRain } from 'react-icons/lu';
import { t, SKY_ICON, dateLabel, weatherTips, type Site } from '@kebun/shared';
import { useStore, useTables, rows } from '../lib/store';
import { Link } from '../lib/router';
import { Card, PageHeader } from '../components/ui';

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
      <div className="grid-auto">{sites.map((x) => <SiteWeather key={x.id} site={x} />)}</div>
    </div>
  );
}
