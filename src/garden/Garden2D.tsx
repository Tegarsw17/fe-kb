// 2D map of a site — the light mode for slow phones (and the fallback when
// WebGL is unavailable). Same colors and status hints as the 3D view.

import { useMemo } from 'react';
import { ageYears, effectivePhase, growthScale, t, type Site, type Tree, type TreeNeeds, type Variety } from '@kebun/shared';

export function Garden2D({ site, trees, varieties, needs, selectedId, onSelect }: {
  site: Site; trees: Tree[]; varieties: Variety[]; needs: Map<string, TreeNeeds>;
  selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const vmap = useMemo(() => new Map(varieties.map((v) => [v.code, v])), [varieties]);
  const W = site.grid_cols, H = site.grid_rows;
  return (
    <svg className="garden2d" viewBox={`-0.2 -0.2 ${W + 0.4} ${H + 0.4}`} role="img" aria-label={site.name}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
      <rect x={-0.2} y={-0.2} width={W + 0.4} height={H + 0.4} rx={0.4} className="g2-ground" />
      {Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (
        <circle key={`${r}-${c}`} cx={c + 0.5} cy={r + 0.5} r={0.05} className="g2-spot" />
      )))}
      {trees.map((tree) => {
        const v = vmap.get(tree.variety_code ?? '');
        const g = growthScale(ageYears(tree));
        const phase = effectivePhase(tree, v);
        const n = needs.get(tree.id);
        const cx = tree.col_no - 0.5, cy = tree.row_no - 0.5;
        const r = 0.14 + 0.3 * g;
        const fill = tree.health === 'dead' ? '#9a958c' : tree.health === 'sick' ? '#b08a35' : tree.health === 'watch' ? '#a7a948' : v?.color ?? '#4f8a3c';
        const sel = tree.id === selectedId;
        const status = tree.health === 'sick' ? 'sick' : n?.water ? 'water' : (n?.fertilizer || n?.spray || n?.other) ? 'care' : null;
        return (
          <g key={tree.id} className="g2-tree" onClick={(e) => { e.stopPropagation(); onSelect(tree.id); }}>
            <title>{`${tree.name} — ${t('phase.' + phase)}`}</title>
            {phase === 'ready' && <circle cx={cx} cy={cy} r={r + 0.12} className="g2-ready" />}
            {sel && <circle cx={cx} cy={cy} r={r + 0.1} className="g2-sel" />}
            <circle cx={cx} cy={cy} r={r} fill={fill} className="g2-crown" />
            {phase === 'flowering' && <circle cx={cx + r * 0.5} cy={cy - r * 0.5} r={0.07} className="g2-flower" />}
            {(phase === 'fruiting' || phase === 'ready') && <circle cx={cx - r * 0.45} cy={cy + r * 0.45} r={0.08} className={phase === 'ready' ? 'g2-fruit-ready' : 'g2-fruit'} />}
            {status && <circle cx={cx + r * 0.7} cy={cy - r * 0.7} r={0.1} className={`g2-badge g2-${status}`} />}
            <text x={cx} y={cy + r + 0.17} className="g2-label">{tree.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
