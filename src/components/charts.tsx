// Lightweight SVG charts (no chart library → smaller download).
// Colors come from CSS variables --series-income / --series-expense / --series-1,
// validated for color-blind separation in light and dark mode.

import { useState } from 'react';
import { monthName, num, rupiah, rupiahShort, t, type Lang, type MonthTotals } from '@kebun/shared';

/** Grouped bars: income vs expense per month, with hover tooltip. */
export function MonthBars({ data, lang }: { data: MonthTotals[]; lang: Lang }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, padL = 56, padB = 26, padT = 10;
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const nice = niceMax(max);
  const plotW = W - padL - 8, plotH = H - padB - padT;
  const slot = plotW / data.length;
  const barW = Math.min(18, (slot - 10) / 2);
  const y = (v: number) => padT + plotH - (v / nice) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice);

  return (
    <div className="chart">
      <ul className="chart-legend">
        <li><span className="sw sw-income" />{t('fin.income')}</li>
        <li><span className="sw sw-expense" />{t('fin.expense')}</li>
      </ul>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t('fin.income')} / ${t('fin.expense')}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - 8} y1={y(v)} y2={y(v)} className="grid" />
              <text x={padL - 8} y={y(v) + 4} className="axis" textAnchor="end">{rupiahShort(v, lang).replace('Rp ', '')}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = padL + i * slot + slot / 2 - barW - 1;
            return (
              <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
                <rect x={padL + i * slot} y={padT} width={slot} height={plotH} className={`hit ${hover === i ? 'on' : ''}`} />
                {d.income > 0 && <path d={barPath(x0, y(d.income), barW, padT + plotH)} className="bar-income" />}
                {d.expense > 0 && <path d={barPath(x0 + barW + 2, y(d.expense), barW, padT + plotH)} className="bar-expense" />}
                <text x={padL + i * slot + slot / 2} y={H - 8} className="axis" textAnchor="middle">{monthName(i, lang)}</text>
              </g>
            );
          })}
          <line x1={padL} x2={W - 8} y1={padT + plotH} y2={padT + plotH} className="baseline" />
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}>
            <b>{monthName(hover, lang)} {data[hover].month.slice(0, 4)}</b>
            <div><span className="sw sw-income" />{t('fin.income')}: {rupiah(data[hover].income)}</div>
            <div><span className="sw sw-expense" />{t('fin.expense')}: {rupiah(data[hover].expense)}</div>
            <div className={data[hover].profit >= 0 ? 'good-text' : 'bad-text'}>{t('fin.profit')}: {rupiah(data[hover].profit)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal bars with direct value labels (one series). */
export function HBars({ data, unit, format, tone }: { data: { label: string; value: number }[]; unit?: string; format?: (v: number) => string; tone?: 'expense' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className={`hbars ${tone ? 'hbars-' + tone : ''}`}>
      {data.map((d) => (
        <li key={d.label}>
          <span className="hb-label">{d.label}</span>
          <span className="hb-track"><span className="hb-fill" style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%` }} /></span>
          <span className="hb-value">{format ? format(d.value) : `${num(d.value, 'id', 0)}${unit ? ' ' + unit : ''}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** Bar with 4px rounded top, square at the baseline. */
function barPath(x: number, top: number, w: number, base: number) {
  const h = base - top;
  const r = Math.min(4, w / 2, h);
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
