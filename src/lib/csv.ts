// Download rows as a CSV file (opens in Excel / Google Sheets).

export function downloadCSV(filename: string, rows: Record<string, unknown>[], columns?: { key: string; label: string }[]) {
  if (!rows.length) return;
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const esc = (v: unknown) => {
    const s = v == null ? '' : Array.isArray(v) ? v.join(' ') : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [cols.map((c) => esc(c.label)).join(','), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(','))].join('\n');
  downloadText(filename, '﻿' + text, 'text/csv;charset=utf-8');
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
