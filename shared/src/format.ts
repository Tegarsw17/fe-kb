// Number, money and date formatting (Indonesian style by default).

import type { ISODate, Lang, Unit } from './types';
import { daysBetween, parseISO, today } from './dates';

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

export function rupiah(n: number | null | undefined, lang: Lang = 'id'): string {
  const v = Math.round(Number(n) || 0);
  return 'Rp ' + v.toLocaleString(locale(lang === 'en' ? 'id' : lang)); // always 1.250.000 style
}

/** Short money: Rp 1,2 jt / Rp 350 rb */
export function rupiahShort(n: number, lang: Lang = 'id'): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const fmt = (x: number) => x.toLocaleString(locale(lang), { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `Rp ${fmt(v / 1e9)} ${lang === 'en' ? 'B' : 'M'}`;
  if (abs >= 1e6) return `Rp ${fmt(v / 1e6)} ${lang === 'en' ? 'M' : 'jt'}`;
  if (abs >= 1e3) return `Rp ${fmt(v / 1e3)} ${lang === 'en' ? 'K' : 'rb'}`;
  return `Rp ${fmt(v)}`;
}

export function num(n: number | null | undefined, lang: Lang = 'id', digits = 1): string {
  return (Number(n) || 0).toLocaleString(locale(lang), { maximumFractionDigits: digits });
}

export function qty(n: number, unit: Unit | string, lang: Lang = 'id'): string {
  const u = unit === 'l' ? 'L' : unit === 'pcs' ? (lang === 'en' ? 'pcs' : 'bh') : unit;
  return `${num(n, lang, 2)} ${u}`;
}

const MONTHS: Record<Lang, string[]> = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function monthName(m: number, lang: Lang = 'id'): string {
  return MONTHS[lang][m];
}

export function dateLabel(s: ISODate | null | undefined, lang: Lang = 'id', withYear = true): string {
  if (!s) return '–';
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS[lang][d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export function monthLabel(key: string, lang: Lang = 'id'): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[lang][m - 1]} ${String(y).slice(2)}`;
}

/** "hari ini", "besok", "3 hari lagi", "terlambat 2 hari" */
export function relDays(s: ISODate, lang: Lang = 'id', from: ISODate = today()): string {
  const n = daysBetween(from, s);
  if (lang === 'en') {
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? `in ${n} days` : `${-n} days overdue`;
  }
  if (n === 0) return 'hari ini';
  if (n === 1) return 'besok';
  if (n === -1) return 'kemarin';
  return n > 0 ? `${n} hari lagi` : `terlambat ${-n} hari`;
}

export function ageLabel(years: number, lang: Lang = 'id'): string {
  if (years < 1) {
    const months = Math.max(0, Math.round(years * 12));
    return lang === 'en' ? `${months} mo` : `${months} bln`;
  }
  return lang === 'en' ? `${num(years, lang, 1)} yr` : `${num(years, lang, 1)} th`;
}
