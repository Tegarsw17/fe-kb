// Weather from Open-Meteo (free, no API key). https://open-meteo.com

export type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'storm';

export interface WeatherNow {
  temp: number;
  humidity: number;
  precipitation: number;
  wind: number; // km/h
  code: number;
  sky: Sky;
  isDay: boolean;
}

export interface WeatherDay {
  date: string;
  code: number;
  sky: Sky;
  tmax: number;
  tmin: number;
  rain_mm: number;
  rain_prob: number;
}

export interface Weather {
  now: WeatherNow;
  days: WeatherDay[];
  fetchedAt: number;
}

/** WMO weather code → simple sky type. */
export function skyFromCode(code: number): Sky {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloudy';
}

export const SKY_ICON: Record<Sky, string> = {
  clear: '☀️', partly: '⛅', cloudy: '☁️', fog: '🌫️', rain: '🌧️', storm: '⛈️',
};

const cache = new Map<string, Weather>();

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < 30 * 60 * 1000) return hit; // 30 min cache
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather ' + res.status);
  const j = await res.json();
  const c = j.current;
  const w: Weather = {
    now: {
      temp: c.temperature_2m, humidity: c.relative_humidity_2m, precipitation: c.precipitation,
      wind: c.wind_speed_10m, code: c.weather_code, sky: skyFromCode(c.weather_code), isDay: !!c.is_day,
    },
    days: (j.daily.time as string[]).map((date, i) => ({
      date,
      code: j.daily.weather_code[i],
      sky: skyFromCode(j.daily.weather_code[i]),
      tmax: j.daily.temperature_2m_max[i],
      tmin: j.daily.temperature_2m_min[i],
      rain_mm: j.daily.precipitation_sum[i],
      rain_prob: j.daily.precipitation_probability_max?.[i] ?? 0,
    })),
    fetchedAt: Date.now(),
  };
  cache.set(key, w);
  return w;
}

/**
 * Practical durian tips from the forecast. Returns i18n keys (see i18n.ts → tip.*).
 */
export function weatherTips(w: Weather): string[] {
  const tips: string[] = [];
  const d0 = w.days[0];
  const next3 = w.days.slice(0, 3);
  if ((d0 && d0.rain_prob >= 60) || w.now.sky === 'rain' || w.now.sky === 'storm') tips.push('tip.noSpray');
  if (w.now.wind >= 20) tips.push('tip.wind');
  if (next3.some((d) => d.rain_mm >= 20)) tips.push('tip.drainage');
  if (next3.every((d) => d.rain_mm < 1)) tips.push('tip.dry');
  if (w.now.humidity >= 85 && w.now.temp >= 24) tips.push('tip.fungus');
  if (!tips.length) tips.push('tip.good');
  return tips;
}
