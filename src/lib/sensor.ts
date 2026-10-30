// Live temperature & humidity from the garden sensor (a Google Apps Script web app).
// Override the URL with VITE_SENSOR_URL in web/.env; set it empty to hide the sensor.
// One shared poll for every screen, so the header, Beranda and Cuaca never fetch twice.

import { useEffect, useState } from 'react';
import { dateLabel, type Lang } from '@kebun/shared';

const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbywvCD0J1vJ-_tNhIw1MqwurhroOmnVgMJWfVag_OaWGQjKUgYKgo4O0ypZJSFbO-te5Q/exec';
const URL_ = ((import.meta.env.VITE_SENSOR_URL as string | undefined) ?? DEFAULT_URL).trim();

/** The sensor logs every ~30 min, so checking every 5 min is plenty. */
const POLL_MS = 5 * 60_000;
/** No new reading for this long → the sensor is probably offline. */
export const SENSOR_STALE_MS = 90 * 60_000;

export const sensorConfigured = !!URL_;

/** History ranges offered on the Cuaca page. The API returns at most 1000 rows (~20 days). */
export const SENSOR_RANGES = [1, 3, 7, 14] as const;
export type SensorRange = (typeof SENSOR_RANGES)[number];
/** Readings per day (one every ~30 min) plus a little slack, used for ?limit=. */
const PER_DAY = 49;

export type SensorReading = { at: Date; temp: number; humidity: number };
export type SensorData = { days: SensorRange; latest: SensorReading; history: SensorReading[] };
export type SensorState = SensorData | null | 'error';

type RawReading = { waktu: string; suhu: number; kelembapan: number };

/** "24/10/2026 15:36:56" (the sheet's local time) → Date. */
function parseWaktu(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s.trim());
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] ?? 0));
}

function toReading(r: RawReading): SensorReading | null {
  const at = parseWaktu(String(r?.waktu ?? ''));
  const temp = Number(r?.suhu), humidity = Number(r?.kelembapan);
  if (!at || !Number.isFinite(temp) || !Number.isFinite(humidity)) return null;
  return { at, temp, humidity };
}

async function fetchSensor(days: SensorRange): Promise<SensorData> {
  const url = new URL(URL_);
  url.searchParams.set('limit', String(Math.min(1000, days * PER_DAY + 5)));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sensor ${res.status}`);
  const body = await res.json() as { latest?: RawReading; data?: RawReading[] };
  const all = (body.data ?? []).map(toReading).filter((x): x is SensorReading => !!x)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const latest = (body.latest && toReading(body.latest)) || all[all.length - 1];
  if (!latest) throw new Error('sensor: no readings');
  // the window ends at the newest reading, so an offline sensor still shows its last days
  const from = latest.at.getTime() - days * 86_400_000;
  return { days, latest, history: all.filter((x) => x.at.getTime() >= from) };
}

/** One poll per range, shared by every screen that asks for it. */
type Feed = { state: SensorState; timer?: ReturnType<typeof setInterval>; listeners: Set<(s: SensorState) => void> };
const feeds = new Map<SensorRange, Feed>();
const feed = (days: SensorRange) => {
  let f = feeds.get(days);
  if (!f) feeds.set(days, f = { state: null, listeners: new Set() });
  return f;
};

function poll(days: SensorRange) {
  const f = feed(days);
  fetchSensor(days)
    .then((d) => { f.state = d; })
    // keep showing the last good data if one poll fails
    .catch(() => { if (!f.state || f.state === 'error') f.state = 'error'; })
    .finally(() => f.listeners.forEach((l) => l(f.state)));
}

/**
 * Sensor data for the last `days`: null while loading (or not configured), 'error' if it never loaded.
 * When `days` changes, the previous range stays on screen until the new one arrives (check `.days`).
 */
export function useSensor(days: SensorRange = 1): SensorState {
  const [s, setS] = useState<SensorState>(() => feed(days).state);
  useEffect(() => {
    if (!sensorConfigured) return;
    const f = feed(days);
    f.listeners.add(setS);
    if (!f.timer) { poll(days); f.timer = setInterval(() => poll(days), POLL_MS); }
    if (f.state) setS(f.state);
    return () => {
      f.listeners.delete(setS);
      if (f.listeners.size === 0) { clearInterval(f.timer); f.timer = undefined; }
    };
  }, [days]);
  return s;
}

export function isStale(r: SensorReading, now = Date.now()): boolean {
  return now - r.at.getTime() > SENSOR_STALE_MS;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "15:36" today, otherwise "24 Okt 15:36". */
export function sensorTime(d: Date, lang: Lang): string {
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return isoDay(d) === isoDay(new Date()) ? hm : `${dateLabel(isoDay(d), lang, false)} ${hm}`;
}
