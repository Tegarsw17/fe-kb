// 2D map of a site — the light mode for slow phones (and the fallback when
// WebGL is unavailable). Same colors and status hints as the 3D view.
// Zoom: wheel / pinch / double-click / buttons; drag to pan once zoomed in.

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { LuMinus, LuPlus, LuRotateCcw } from 'react-icons/lu';
import { ageYears, effectivePhase, growthScale, t, type Site, type Tree, type TreeNeeds, type Variety } from '@kebun/shared';

const MAX_ZOOM = 8;
const STEP = 1.5;
/** Pointer travel (px) before a press counts as a drag rather than a tap. */
const DRAG_PX = 5;

type View = { x: number; y: number; z: number };
type Pt = { x: number; y: number };

export function Garden2D({ site, trees, varieties, needs, selectedId, onSelect }: {
  site: Site; trees: Tree[]; varieties: Variety[]; needs: Map<string, TreeNeeds>;
  selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const vmap = useMemo(() => new Map(varieties.map((v) => [v.code, v])), [varieties]);
  const W = site.grid_cols, H = site.grid_rows;
  const base = { x: -0.2, y: -0.2, w: W + 0.4, h: H + 0.4 };

  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: base.x, y: base.y, z: 1 });
  const vw = base.w / view.z, vh = base.h / view.z;

  // a different site (or grid size) starts fully zoomed out
  useEffect(() => { setView({ x: base.x, y: base.y, z: 1 }); }, [site.id, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Keep the visible window inside the map. */
  const clamp = (v: View): View => {
    const z = Math.min(MAX_ZOOM, Math.max(1, v.z));
    const w = base.w / z, h = base.h / z;
    return {
      z,
      x: Math.min(base.x + base.w - w, Math.max(base.x, v.x)),
      y: Math.min(base.y + base.h - h, Math.max(base.y, v.y)),
    };
  };

  /** Zoom by `factor`, keeping map point `p` under the same spot on screen. */
  const zoomAt = (v: View, factor: number, p: Pt): View => {
    const z = Math.min(MAX_ZOOM, Math.max(1, v.z * factor));
    const k = v.z / z;
    return clamp({ z, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k });
  };

  /** Screen (client px) → map units. */
  const toMap = (clientX: number, clientY: number): Pt => {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM()?.inverse();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  };
  const center = (): Pt => ({ x: view.x + vw / 2, y: view.y + vh / 2 });

  // wheel needs a non-passive listener so the page doesn't scroll while zooming
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY);
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), p));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  // drag to pan, two fingers to pinch
  const pointers = useRef(new Map<number, Pt>());
  const travel = useRef(0);
  const dragged = useRef(false);

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) { travel.current = 0; dragged.current = false; }
  }

  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    const ptrs = [...pointers.current.entries()];
    travel.current += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (travel.current > DRAG_PX && !dragged.current) {
      dragged.current = true;
      // capture only once it's a drag, so a plain tap still reaches the tree it landed on
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    pointers.current.set(e.pointerId, cur);
    if (!dragged.current) return;

    if (ptrs.length >= 2) {
      const other = ptrs.find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(cur.x - other.x, cur.y - other.y);
      if (before > 0) {
        const mid = toMap((cur.x + other.x) / 2, (cur.y + other.y) / 2);
        setView((v) => zoomAt(v, after / before, mid));
      }
      return;
    }
    const a = toMap(prev.x, prev.y), b = toMap(cur.x, cur.y);
    setView((v) => clamp({ ...v, x: v.x - (b.x - a.x), y: v.y - (b.y - a.y) }));
  }

  function onPointerUp(e: RPointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
  }

  const zoomed = view.z > 1.001;

  return (
    <>
      <svg ref={svgRef} className={`garden2d ${zoomed ? 'is-zoomed' : ''}`} viewBox={`${view.x} ${view.y} ${vw} ${vh}`}
        role="img" aria-label={site.name}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={(e) => { const p = toMap(e.clientX, e.clientY); setView((v) => zoomAt(v, 2, p)); }}
        onClick={(e) => { if (e.target === e.currentTarget && !dragged.current) onSelect(null); }}>
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
            <g key={tree.id} className="g2-tree" onClick={(e) => { e.stopPropagation(); if (!dragged.current) onSelect(tree.id); }}>
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

      <div className="g2-zoom" role="group" aria-label="zoom">
        <button className="tool" onClick={() => setView((v) => zoomAt(v, STEP, center()))} disabled={view.z >= MAX_ZOOM}
          title={t('garden.zoomIn')} aria-label={t('garden.zoomIn')}><LuPlus /></button>
        <button className="tool" onClick={() => setView((v) => zoomAt(v, 1 / STEP, center()))} disabled={!zoomed}
          title={t('garden.zoomOut')} aria-label={t('garden.zoomOut')}><LuMinus /></button>
        {zoomed && (
          <button className="tool" onClick={() => setView({ x: base.x, y: base.y, z: 1 })}
            title={t('garden.reset')} aria-label={t('garden.reset')}><LuRotateCcw /></button>
        )}
      </div>
    </>
  );
}
