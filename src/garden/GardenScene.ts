// =====================================================================
// GardenScene — the cute low-poly 3D durian garden (plain Three.js).
//
// Why plain Three.js and not React Three Fiber: with 100–150 trees per site
// we draw every tree part with *instancing* (one draw call for all trunks, one
// for all canopies, …) and update matrices directly each frame. That is much
// lighter on phones than one React component per tree.
//
// What it shows
//   * Plot laid out on the site's grid (row/col × spacing, default 8×8 m)
//   * Trees sized by real age (seedling → young → growing → mature)
//   * Phase: flowers (flowering), hanging durians (fruiting), golden glow +
//     sparkles (ready to harvest)
//   * Status: droopy + water-drop badge (watering overdue), amber badge
//     (fertilizing/spraying overdue), red badge + yellowed leaves (sick)
//   * Day/night from the real clock, clouds/rain/storm from the weather
//   * Cute extras: forest border, hut, scarecrow, pond, butterflies,
//     fireflies at night, leaves swaying in the wind
//
// Battery: rendering pauses when the tab/canvas is hidden; with effects off
// it only renders when something changes; "low" quality caps at 30 fps,
// disables shadows and uses fewer particles.
// =====================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Site, Tree, Variety, TreeNeeds, Sky } from '@kebun/shared';
import { ageYears, effectivePhase, growthScale, growthStage } from '@kebun/shared';

export type Quality = 'low' | 'high';

export interface GardenData {
  site: Site;
  trees: Tree[];
  varieties: Variety[];
  needs: Map<string, TreeNeeds>;
}

export interface GardenEnv {
  hour: number;       // 0..24 local time
  sky: Sky;           // from weather
  wind: number;       // km/h
  effects: boolean;   // animated extras on/off
}

interface TreeInfo {
  tree: Tree;
  x: number; z: number;
  g: number;           // growth factor 0.18..1
  height: number;      // top of canopy
  phase: string;
  droop: boolean;
  sway: number;        // per-tree phase offset
}

const C = {
  grass: new THREE.Color('#79b04a'),
  grassDark: new THREE.Color('#5f9440'),
  floor: new THREE.Color('#3e6b33'),
  soil: new THREE.Color('#7a5534'),
  mulch: new THREE.Color('#8a6440'),
  trunk: new THREE.Color('#7b5236'),
  trunkDead: new THREE.Color('#8d8a84'),
  dry: new THREE.Color('#a8913f'),
  sickLeaf: new THREE.Color('#b08a35'),
  watchLeaf: new THREE.Color('#b6b046'),
  thirsty: new THREE.Color('#8f9a4c'),
  fruitGreen: new THREE.Color('#7f9a32'),
  fruitReady: new THREE.Color('#d9b83a'),
  flower: new THREE.Color('#f6eccd'),
  pine: [new THREE.Color('#2f5d3a'), new THREE.Color('#2a5233'), new THREE.Color('#386b3f')],
  roundTree: [new THREE.Color('#3f7a3a'), new THREE.Color('#4d8a3f'), new THREE.Color('#5a9444')],
};

// Sky colors through the day (hour → color)
const SKY_STOPS: [number, string][] = [
  [0, '#101d33'], [4.8, '#1d2d4d'], [5.8, '#f0a77a'], [7, '#a6d6ea'], [12, '#8ccfea'],
  [16.6, '#a6d6ea'], [17.8, '#f29a6a'], [18.8, '#3a3466'], [20, '#152342'], [24, '#101d33'],
];

function skyColorAt(h: number): THREE.Color {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const [h0, c0] = SKY_STOPS[i];
    const [h1, c1] = SKY_STOPS[i + 1];
    if (h >= h0 && h <= h1) return new THREE.Color(c0).lerp(new THREE.Color(c1), (h - h0) / (h1 - h0));
  }
  return new THREE.Color(SKY_STOPS[0][1]);
}

/** Sun height: 1 at noon, 0 at 6:00/18:00, negative at night. */
function sunElevation(h: number) {
  return Math.sin((Math.PI * (h - 6)) / 12);
}

/** Stable pseudo-random number from a string (so trees look the same every load). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

// ---------------------------------------------------------------------
// Small canvas textures for icons, labels and sparkles
// ---------------------------------------------------------------------
function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function badge(bg: string, glyph: (g: CanvasRenderingContext2D, s: number) => void) {
  return canvasTexture(128, (g, s) => {
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#ffffff'; g.fill();
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
    g.fillStyle = bg; g.fill();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff';
    glyph(g, s);
  });
}

const ICONS = {
  water: () => badge('#3d8fd1', (g, s) => {
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.27);
    g.bezierCurveTo(s * 0.62, s * 0.42, s * 0.66, s * 0.5, s * 0.66, s * 0.58);
    g.arc(s * 0.5, s * 0.58, s * 0.16, 0, Math.PI);
    g.bezierCurveTo(s * 0.34, s * 0.5, s * 0.38, s * 0.42, s * 0.5, s * 0.27);
    g.fill();
  }),
  care: () => badge('#e0962b', (g, s) => {
    // little sprout = needs fertilizing / spraying
    g.lineWidth = s * 0.06; g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * 0.5, s * 0.7); g.lineTo(s * 0.5, s * 0.45); g.stroke();
    g.beginPath(); g.ellipse(s * 0.39, s * 0.42, s * 0.12, s * 0.07, -0.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(s * 0.61, s * 0.38, s * 0.12, s * 0.07, 0.6, 0, Math.PI * 2); g.fill();
  }),
  sick: () => badge('#d2483c', (g, s) => {
    g.fillRect(s * 0.455, s * 0.27, s * 0.09, s * 0.3);
    g.beginPath(); g.arc(s * 0.5, s * 0.68, s * 0.055, 0, Math.PI * 2); g.fill();
  }),
};

function glowTexture() {
  return canvasTexture(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,230,140,0.9)');
    grd.addColorStop(0.4, 'rgba(255,210,90,0.35)');
    grd.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  });
}

function starTexture() {
  return canvasTexture(64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,240,170,0.9)');
    grd.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(s * 0.47, s * 0.1, s * 0.06, s * 0.8);
    g.fillRect(s * 0.1, s * 0.47, s * 0.8, s * 0.06);
  });
}

function labelTexture(text: string) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = '700 44px "Fredoka", "Plus Jakarta Sans", system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 48;
  c.width = w; c.height = 76;
  g.font = font;
  g.fillStyle = 'rgba(255,253,245,0.96)';
  const r = 34;
  g.beginPath();
  g.moveTo(r, 4); g.lineTo(w - r, 4); g.arc(w - r, 38, r, -Math.PI / 2, Math.PI / 2);
  g.lineTo(r, 72); g.arc(r, 38, r, Math.PI / 2, -Math.PI / 2); g.fill();
  g.fillStyle = '#1f3b2c'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(text, w / 2, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / 76 };
}

// =====================================================================
export class GardenScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private sun = new THREE.DirectionalLight('#fff4d6', 1.6);
  private hemi = new THREE.HemisphereLight('#cfeaff', '#4a6b35', 0.9);
  private ambient = new THREE.AmbientLight('#ffffff', 0.15);

  private world = new THREE.Group();     // ground, forest, props (rebuilt per site)
  private treeLayer = new THREE.Group(); // trees (rebuilt when data changes)
  private fxLayer = new THREE.Group();   // clouds, rain, butterflies, fireflies

  private infos: TreeInfo[] = [];
  private canopy?: THREE.InstancedMesh;
  private canopyBase: { pos: THREE.Vector3; scale: THREE.Vector3; tilt: number; owner: number }[] = [];
  private trunk?: THREE.InstancedMesh;
  private trunkOwner: number[] = [];
  private icons: { sprite: THREE.Sprite; baseY: number; phase: number }[] = [];
  private glows: { sprite: THREE.Sprite; phase: number }[] = [];
  private sparkles?: THREE.Points;
  private sparkleBase: { x: number; y: number; z: number; r: number; a: number; speed: number }[] = [];
  private selectRing?: THREE.Mesh;
  private selectLabel?: THREE.Sprite;
  private hoverLabel?: THREE.Sprite;
  private hoverIndex = -1;

  private clouds: { group: THREE.Group; speed: number }[] = [];
  private rain?: THREE.LineSegments;
  private butterflies: { mesh: THREE.Group; center: THREE.Vector3; r: number; speed: number; phase: number }[] = [];
  private fireflies?: THREE.Points;
  private hutWindow?: THREE.MeshStandardMaterial;
  private lightningTimer = 0;

  private textures = {
    water: ICONS.water(), care: ICONS.care(), sick: ICONS.sick(), glow: glowTexture(), star: starTexture(),
  };

  private plotW = 96;
  private plotD = 96;
  private env: GardenEnv = { hour: 12, sky: 'clear', wind: 5, effects: true };
  private data?: GardenData;
  private selectedId: string | null = null;

  private running = false;
  private visible = true;
  private needsRender = true;
  private lastFrame = 0;
  private ro: ResizeObserver;
  private io?: IntersectionObserver;
  private resetAnim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number } | null = null;
  private downAt: { x: number; y: number; time: number } | null = null;

  constructor(
    private container: HTMLElement,
    private opts: { quality: Quality; onSelect: (treeId: string | null) => void },
  ) {
    const low = opts.quality === 'low';
    this.renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: low ? 'low-power' : 'default' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 260;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener('change', () => { this.needsRender = true; });

    this.sun.castShadow = !low;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target, this.hemi, this.ambient, this.world, this.treeLayer, this.fxLayer);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerleave', () => this.setHover(-1));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.needsRender = true; });
      this.io.observe(container);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
    this.start();
  }

  // ------------------------------------------------------------------ public API

  setData(data: GardenData) {
    const siteChanged = !this.data || this.data.site.id !== data.site.id ||
      this.data.site.grid_rows !== data.site.grid_rows || this.data.site.grid_cols !== data.site.grid_cols ||
      this.data.site.spacing_m !== data.site.spacing_m;
    this.data = data;
    this.plotW = data.site.grid_cols * Number(data.site.spacing_m);
    this.plotD = data.site.grid_rows * Number(data.site.spacing_m);
    if (siteChanged) {
      this.buildWorld();
      this.buildEffects();
      this.resetView(false);
    }
    this.buildTrees();
    this.applySelection();
    this.applyEnv();
    this.needsRender = true;
  }

  setEnv(env: Partial<GardenEnv>) {
    const prevSky = this.env.sky;
    const prevFx = this.env.effects;
    this.env = { ...this.env, ...env };
    if (this.data && (prevSky !== this.env.sky || prevFx !== this.env.effects)) this.buildEffects();
    this.applyEnv();
    this.needsRender = true;
  }

  select(treeId: string | null, focus = false) {
    this.selectedId = treeId;
    this.applySelection();
    if (focus && treeId) {
      const info = this.infos.find((i) => i.tree.id === treeId);
      if (info) this.animateTo(new THREE.Vector3(info.x, 0, info.z), 48);
    }
    this.needsRender = true;
  }

  resetView(animated = true) {
    const span = Math.max(this.plotW, this.plotD);
    const pos = new THREE.Vector3(span * 0.12, span * 0.95, span * 1.3);
    const target = new THREE.Vector3(0, 0, 0);
    if (!animated) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
    } else {
      this.resetAnim = { from: this.camera.position.clone(), to: pos, tFrom: this.controls.target.clone(), tTo: target, t: 0 };
    }
    this.needsRender = true;
  }

  dispose() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.controls.dispose();
    this.scene.traverse((o: any) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m?.dispose?.();
    });
    Object.values(this.textures).forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ------------------------------------------------------------------ building

  private clearGroup(g: THREE.Group) {
    for (const o of [...g.children]) {
      o.traverse((x: any) => {
        x.geometry?.dispose?.();
        const m = x.material;
        if (Array.isArray(m)) m.forEach((y: THREE.Material) => y.dispose());
        else if (m) { if (m.map && !Object.values(this.textures).includes(m.map)) m.map.dispose(); m.dispose(); }
      });
      g.remove(o);
    }
  }

  private buildWorld() {
    this.clearGroup(this.world);
    const low = this.opts.quality === 'low';
    const W = this.plotW, D = this.plotD;
    const rand = seeded(7);

    // Forest floor
    const floorGeo = new THREE.CircleGeometry(Math.max(W, D) * 2.2, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: C.floor, roughness: 1 }));
    floor.position.y = -0.4;
    floor.receiveShadow = true;
    this.world.add(floor);

    // The plot: a slightly raised grass field with gentle color patches
    const seg = low ? 12 : 24;
    const plotGeo = new THREE.BoxGeometry(W + 8, 0.6, D + 8, seg, 1, seg);
    const pos = plotGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) col.copy(C.grass).lerp(C.grassDark, 0.5 + 0.5 * Math.sin(pos.getX(i) * 0.11) * Math.cos(pos.getZ(i) * 0.09));
      else col.copy(C.soil);
      colors.set([col.r, col.g, col.b], i * 3);
    }
    plotGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const plot = new THREE.Mesh(plotGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    plot.position.y = -0.3;
    plot.receiveShadow = true;
    this.world.add(plot);

    // Fence posts around the plot
    const postGeo = new THREE.BoxGeometry(0.35, 1.3, 0.35);
    postGeo.translate(0, 0.65, 0);
    const perim: THREE.Vector3[] = [];
    const step = 6;
    for (let x = -W / 2 - 4; x <= W / 2 + 4; x += step) { perim.push(new THREE.Vector3(x, 0, -D / 2 - 4), new THREE.Vector3(x, 0, D / 2 + 4)); }
    for (let z = -D / 2 - 4 + step; z < D / 2 + 4; z += step) { perim.push(new THREE.Vector3(-W / 2 - 4, 0, z), new THREE.Vector3(W / 2 + 4, 0, z)); }
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: '#8b6a45', roughness: 1 }), perim.length);
    const m = new THREE.Matrix4();
    perim.forEach((p, i) => posts.setMatrixAt(i, m.makeTranslation(p.x, 0, p.z)));
    this.world.add(posts);
    // Rails
    const railMat = new THREE.MeshStandardMaterial({ color: '#9b7a52', roughness: 1 });
    for (const [w, d, x, z] of [[W + 8, 0.15, 0, -D / 2 - 4], [W + 8, 0.15, 0, D / 2 + 4], [0.15, D + 8, -W / 2 - 4, 0], [0.15, D + 8, W / 2 + 4, 0]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), railMat);
      rail.position.set(x, 0.95, z);
      this.world.add(rail);
    }

    // Forest around the plot: pines and round trees, instanced
    const nForest = low ? 70 : 140;
    const pineGeo = new THREE.ConeGeometry(1, 1, 6);
    pineGeo.translate(0, 0.5, 0);
    const roundGeo = new THREE.IcosahedronGeometry(1, low ? 0 : 1);
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1, 5);
    trunkGeo.translate(0, 0.5, 0);
    const pines = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), nForest * 2);
    const rounds = new THREE.InstancedMesh(roundGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), nForest);
    const ftrunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: C.trunk, roughness: 1 }), nForest);
    const dummy = new THREE.Object3D();
    let pi = 0, ri = 0;
    for (let i = 0; i < nForest; i++) {
      // random point in a ring outside the fence: walk out along a random direction
      // to the fence rectangle (+6m clearance so canopies never cross the rails), then beyond
      const ang = rand() * Math.PI * 2;
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const edge = Math.min((W / 2 + 10) / Math.abs(dx), (D / 2 + 10) / Math.abs(dz));
      const r = edge + rand() * 45;
      const x = dx * r, z = dz * r;
      const h = 7 + rand() * 9;
      dummy.position.set(x, 0, z); dummy.rotation.set(0, rand() * 6, 0);
      dummy.scale.set(1, h * 0.35, 1); dummy.updateMatrix();
      ftrunks.setMatrixAt(i, dummy.matrix);
      if (rand() < 0.55) {
        for (let k = 0; k < 2; k++) {
          const w = (2.8 - k * 0.9) * (0.8 + rand() * 0.4);
          dummy.position.set(x, h * (0.25 + k * 0.28), z);
          dummy.scale.set(w, h * 0.55, w); dummy.updateMatrix();
          pines.setMatrixAt(pi, dummy.matrix);
          pines.setColorAt(pi, C.pine[Math.floor(rand() * 3)]);
          pi++;
        }
      } else {
        const r = 2.5 + rand() * 2;
        dummy.position.set(x, h * 0.35 + r * 0.8, z);
        dummy.scale.set(r, r * 1.1, r); dummy.updateMatrix();
        rounds.setMatrixAt(ri, dummy.matrix);
        rounds.setColorAt(ri, C.roundTree[Math.floor(rand() * 3)]);
        ri++;
      }
    }
    pines.count = pi; rounds.count = ri;
    for (const im of [pines, rounds, ftrunks]) { im.castShadow = !low; this.world.add(im); }

    // Hut (pondok) in a corner, with a window that glows at night
    const hut = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ color: '#c99a62', roughness: 1 }));
    body.position.y = 1.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.6, 4), new THREE.MeshStandardMaterial({ color: '#7a3f2b', roughness: 1, flatShading: true }));
    roof.position.y = 4.3; roof.rotation.y = Math.PI / 4; roof.scale.set(1.1, 1, 0.95);
    this.hutWindow = new THREE.MeshStandardMaterial({ color: '#3a2a1a', emissive: '#ffcc66', emissiveIntensity: 0 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), this.hutWindow);
    win.position.set(0, 1.8, 2.01);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), new THREE.MeshStandardMaterial({ color: '#6b4429' }));
    door.position.set(-1.6, 1, 2.01);
    hut.add(body, roof, win, door);
    hut.position.set(W / 2 + 12, 0, D / 2 + 9);
    hut.rotation.y = -0.5;
    hut.traverse((o: any) => { if (o.isMesh) { o.castShadow = !low; o.receiveShadow = true; } });
    this.world.add(hut);

    // Scarecrow
    const sc = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#8b6a45' });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 5), wood); pole.position.y = 1.7;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 5), wood); arm.rotation.z = Math.PI / 2; arm.position.y = 2.4;
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.5), new THREE.MeshStandardMaterial({ color: '#d0533f' })); shirt.position.y = 2.1;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshStandardMaterial({ color: '#e9cf8f', flatShading: true })); head.position.y = 3.1;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#d8b45a', flatShading: true })); hat.position.y = 3.55;
    sc.add(pole, arm, shirt, head, hat);
    sc.position.set(-W / 2 - 8, 0, D / 2 + 7);
    sc.rotation.y = 0.6;
    sc.traverse((o: any) => { if (o.isMesh) o.castShadow = !low; });
    this.world.add(sc);

    // Pond
    const pond = new THREE.Mesh(new THREE.CircleGeometry(5, 20), new THREE.MeshStandardMaterial({ color: '#4fa3c7', roughness: 0.2, metalness: 0.1 }));
    pond.rotation.x = -Math.PI / 2; pond.scale.set(1.4, 1, 1); pond.position.set(-W / 2 - 16, -0.32, -D / 2 + 10);
    this.world.add(pond);

    // Rocks
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#9a9a8c', flatShading: true }), 12);
    for (let i = 0; i < 12; i++) {
      const s = 0.4 + rand() * 0.9;
      dummy.position.set(-W / 2 - 16 + Math.cos(i) * (7 + rand() * 2), -0.3, -D / 2 + 10 + Math.sin(i) * (5 + rand() * 2));
      if (i > 7) dummy.position.set((rand() - 0.5) * W * 1.6, -0.3, D / 2 + 14 + rand() * 10);
      dummy.scale.set(s, s * 0.6, s); dummy.rotation.set(rand(), rand(), rand()); dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    this.world.add(rocks);

    // Shadow camera covers the plot
    const sh = this.sun.shadow.camera as THREE.OrthographicCamera;
    const half = Math.max(W, D) * 0.75;
    sh.left = -half; sh.right = half; sh.top = half; sh.bottom = -half; sh.near = 1; sh.far = 600;
    sh.updateProjectionMatrix();
  }

  private buildTrees() {
    this.clearGroup(this.treeLayer);
    this.icons = []; this.glows = []; this.canopyBase = []; this.trunkOwner = [];
    this.sparkles = undefined; this.sparkleBase = [];
    this.selectRing = undefined; this.selectLabel = undefined; this.hoverLabel = undefined;
    if (!this.data) return;

    const low = this.opts.quality === 'low';
    const { site, trees, varieties, needs } = this.data;
    const sp = Number(site.spacing_m);
    const vmap = new Map(varieties.map((v) => [v.code, v]));

    this.infos = trees.map((tree) => {
      const years = ageYears(tree);
      const g = growthScale(years);
      const n = needs.get(tree.id);
      const trunkH = 0.6 + 3.4 * g;
      const R = 0.45 + 2.6 * g;
      return {
        tree,
        x: (tree.col_no - (site.grid_cols + 1) / 2) * sp,
        z: (tree.row_no - (site.grid_rows + 1) / 2) * sp,
        g,
        height: trunkH + R * 2.6,
        phase: effectivePhase(tree, vmap.get(tree.variety_code ?? '')),
        droop: !!n?.water,
        sway: hash(tree.id) * Math.PI * 2,
      };
    });

    const N = this.infos.length;
    const canopyGeo = new THREE.IcosahedronGeometry(1, low ? 0 : 1);
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const basinGeo = new THREE.CircleGeometry(1, 14);
    basinGeo.rotateX(-Math.PI / 2);
    const stakeGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 4);
    stakeGeo.translate(0, 0.5, 0);
    const fruitGeo = new THREE.OctahedronGeometry(1, 1);
    const flowerGeo = new THREE.IcosahedronGeometry(1, 0);

    const canopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), N * 3);
    const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), N);
    const basin = new THREE.InstancedMesh(basinGeo, new THREE.MeshStandardMaterial({ color: C.mulch, roughness: 1 }), N);
    const stakes = new THREE.InstancedMesh(stakeGeo, new THREE.MeshStandardMaterial({ color: '#c8b27a' }), N);
    const fruitsCount = this.infos.filter((i) => i.phase === 'fruiting' || i.phase === 'ready').length * 8;
    const flowersCount = this.infos.filter((i) => i.phase === 'flowering').length * 12;
    const fruits = new THREE.InstancedMesh(fruitGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }), Math.max(1, fruitsCount));
    const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: C.flower, emissive: '#fff3cf', emissiveIntensity: 0.25, flatShading: true }), Math.max(1, flowersCount));

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let ci = 0, fi = 0, fli = 0, si = 0;

    this.infos.forEach((info, idx) => {
      const { tree, x, z, g } = info;
      const rnd = seeded(Math.floor(hash(tree.id) * 1e6) + 1);
      const dead = tree.health === 'dead';
      const trunkH = 0.6 + 3.4 * g;
      const R = 0.45 + 2.6 * g;

      // mulch basin
      dummy.position.set(x, 0.02, z); dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0.8, R * 0.95)); dummy.updateMatrix();
      basin.setMatrixAt(idx, dummy.matrix);

      // trunk
      const tw = 0.5 + g * 1.2;
      dummy.position.set(x, 0, z); dummy.scale.set(tw, dead ? trunkH * 1.6 : trunkH + R, tw);
      dummy.rotation.set(0, 0, info.droop ? 0.06 : 0); dummy.updateMatrix();
      trunk.setMatrixAt(idx, dummy.matrix);
      trunk.setColorAt(idx, dead ? C.trunkDead : C.trunk);
      this.trunkOwner[idx] = idx;

      // bamboo stake for young trees
      if (growthStage(ageYears(tree)) <= 1 && !dead) {
        dummy.position.set(x + 0.35, 0, z + 0.2); dummy.scale.set(1, trunkH + R * 1.4, 1);
        dummy.rotation.set(0, 0, -0.05); dummy.updateMatrix();
        stakes.setMatrixAt(si++, dummy.matrix);
      }
      if (dead) return;

      // canopy color: variety tint, small per-tree variation, health & thirst
      const base = new THREE.Color(this.data!.varieties.find((v) => v.code === tree.variety_code)?.color ?? '#4f8a3c');
      const hsl = { h: 0, s: 0, l: 0 };
      base.getHSL(hsl);
      base.setHSL(hsl.h + (rnd() - 0.5) * 0.03, hsl.s, hsl.l * (0.9 + rnd() * 0.2));
      if (tree.health === 'sick') base.lerp(C.sickLeaf, 0.55);
      else if (tree.health === 'watch') base.lerp(C.watchLeaf, 0.3);
      if (info.droop) base.lerp(C.thirsty, 0.4);
      if (info.phase === 'ready') base.lerp(C.fruitReady, 0.22); // golden shimmer on ready trees

      // three stacked blobs → a pyramid-ish durian crown
      const blobs = g < 0.3
        ? [{ r: R, y: trunkH + R * 0.7, ox: 0 }]
        : [
            { r: R, y: trunkH + R * 0.75, ox: 0 },
            { r: R * 0.74, y: trunkH + R * 1.55, ox: (rnd() - 0.5) * R * 0.3 },
            { r: R * 0.46, y: trunkH + R * 2.15, ox: (rnd() - 0.5) * R * 0.2 },
          ];
      const droopY = info.droop ? 0.82 : 1;
      for (const b of blobs) {
        const p = new THREE.Vector3(x + b.ox, b.y * (info.droop ? 0.93 : 1), z + (rnd() - 0.5) * b.r * 0.2);
        const s = new THREE.Vector3(b.r, b.r * 1.05 * droopY, b.r);
        const tilt = info.droop ? 0.22 : 0;
        this.canopyBase.push({ pos: p, scale: s, tilt, owner: idx });
        dummy.position.copy(p); dummy.scale.copy(s); dummy.rotation.set(0, rnd() * 6, tilt); dummy.updateMatrix();
        canopy.setMatrixAt(ci, dummy.matrix);
        color.copy(base).offsetHSL(0, 0, (b.r === R ? -0.02 : 0.03));
        canopy.setColorAt(ci, color);
        ci++;
      }

      // fruits hanging under the lowest blob
      if (info.phase === 'fruiting' || info.phase === 'ready') {
        const ready = info.phase === 'ready';
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + rnd() * 0.5;
          const rr = R * (0.75 + rnd() * 0.2);
          const fs = (ready ? 0.42 : 0.34) + 0.2 * g;
          dummy.position.set(x + Math.cos(a) * rr, trunkH + R * 0.25 - rnd() * 0.4, z + Math.sin(a) * rr);
          dummy.scale.set(fs, fs * 1.2, fs); dummy.rotation.set(rnd(), rnd(), rnd()); dummy.updateMatrix();
          fruits.setMatrixAt(fi, dummy.matrix);
          fruits.setColorAt(fi, ready ? C.fruitReady : C.fruitGreen);
          fi++;
        }
      }
      // flowers on the lower canopy
      if (info.phase === 'flowering') {
        for (let k = 0; k < 12; k++) {
          const a = rnd() * Math.PI * 2;
          const yy = trunkH + R * (0.2 + rnd() * 0.9);
          const rr = R * (0.85 + rnd() * 0.12);
          dummy.position.set(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr);
          dummy.scale.setScalar(0.2 + rnd() * 0.1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
          flowers.setMatrixAt(fli++, dummy.matrix);
        }
      }
    });

    canopy.count = ci; fruits.count = fi; flowers.count = fli; stakes.count = si;
    for (const im of [canopy, trunk, fruits]) { im.castShadow = !low; }
    basin.receiveShadow = true;
    for (const im of [canopy, trunk, basin, stakes, fruits, flowers]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.treeLayer.add(im);
    }
    if (!fruitsCount) fruits.visible = false;
    if (!flowersCount) flowers.visible = false;
    this.canopy = canopy;
    this.trunk = trunk;

    // badges, glows and sparkles
    const sparkleSpots: TreeInfo[] = [];
    for (const info of this.infos) {
      const n = needs.get(info.tree.id);
      const tex = info.tree.health === 'sick' ? this.textures.sick
        : n?.water ? this.textures.water
        : (n?.fertilizer || n?.spray || n?.other) ? this.textures.care
        : null;
      if (tex && info.tree.health !== 'dead') {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
        const s = 1.4 + info.g * 1.1;
        sprite.scale.set(s, s, 1);
        const baseY = info.height + 1.1;
        sprite.position.set(info.x, baseY, info.z);
        sprite.renderOrder = 5;
        this.treeLayer.add(sprite);
        this.icons.push({ sprite, baseY, phase: info.sway });
      }
      if (info.phase === 'ready') {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        const s = 8 + info.g * 7;
        glow.scale.set(s, s, 1);
        glow.position.set(info.x, info.height * 0.55, info.z);
        this.treeLayer.add(glow);
        this.glows.push({ sprite: glow, phase: info.sway });
        sparkleSpots.push(info);
      }
    }
    if (sparkleSpots.length) {
      const per = low ? 4 : 8;
      const posArr = new Float32Array(sparkleSpots.length * per * 3);
      for (const info of sparkleSpots) for (let k = 0; k < per; k++) {
        const R = 0.45 + 2.6 * info.g;
        this.sparkleBase.push({ x: info.x, z: info.z, y: info.height * (0.35 + Math.random() * 0.55), r: R * (1 + Math.random() * 0.35), a: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5 });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      this.sparkles = new THREE.Points(geo, new THREE.PointsMaterial({
        map: this.textures.star, size: low ? 1.0 : 1.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      this.updateSparkles(0);
      this.treeLayer.add(this.sparkles);
    }

    // selection ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.treeLayer.add(ring);
    this.selectRing = ring;
  }

  private buildEffects() {
    this.clearGroup(this.fxLayer);
    this.clouds = []; this.butterflies = []; this.rain = undefined; this.fireflies = undefined;
    const low = this.opts.quality === 'low';
    const { sky, effects } = this.env;
    const W = this.plotW, D = this.plotD;
    const rand = seeded(11);

    // Clouds — number and darkness from the weather
    const nClouds = { clear: 2, partly: 5, cloudy: 9, fog: 6, rain: 10, storm: 12 }[sky] ?? 3;
    const dark = sky === 'rain' || sky === 'storm';
    const cloudMat = new THREE.MeshStandardMaterial({ color: dark ? '#9aa3a8' : '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: 0.95 });
    const blobGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < (low ? Math.ceil(nClouds / 2) : nClouds); i++) {
      const g = new THREE.Group();
      const parts = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < parts; k++) {
        const b = new THREE.Mesh(blobGeo, cloudMat);
        const s = 4 + rand() * 4;
        b.scale.set(s * 1.3, s * 0.8, s);
        b.position.set(k * 5 - parts * 2.5, rand() * 2, rand() * 3);
        g.add(b);
      }
      g.position.set((rand() - 0.5) * W * 2.6, 55 + rand() * 20, -D * 0.4 - rand() * D * 1.4);
      this.fxLayer.add(g);
      this.clouds.push({ group: g, speed: 0.6 + rand() * 0.8 });
    }

    if (!effects) return;

    // Rain
    if (dark) {
      const n = low ? 500 : (sky === 'storm' ? 1800 : 1200);
      const arr = new Float32Array(n * 6);
      const area = Math.max(W, D) * 1.4;
      for (let i = 0; i < n; i++) {
        const x = (rand() - 0.5) * area, y = rand() * 50, z = (rand() - 0.5) * area;
        arr.set([x, y, z, x + 0.15, y - 1.4, z], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#c7d9e8', transparent: true, opacity: 0.55 }));
      this.rain.frustumCulled = false;
      this.fxLayer.add(this.rain);
    }

    // Butterflies (only when it isn't raining)
    if (!dark) {
      const colors = ['#f6c344', '#f08bb4', '#ffffff', '#8fc9f2', '#f4a259'];
      const wingGeo = new THREE.CircleGeometry(0.5, 6);
      for (let i = 0; i < (low ? 4 : 9); i++) {
        const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide });
        const b = new THREE.Group();
        const l = new THREE.Mesh(wingGeo, mat); l.position.x = -0.42;
        const r = new THREE.Mesh(wingGeo, mat); r.position.x = 0.42;
        const lp = new THREE.Group(); lp.add(l);
        const rp = new THREE.Group(); rp.add(r);
        b.add(lp, rp);
        b.userData = { lp, rp };
        this.fxLayer.add(b);
        this.butterflies.push({
          mesh: b,
          center: new THREE.Vector3((rand() - 0.5) * W * 0.9, 2.5 + rand() * 4, (rand() - 0.5) * D * 0.9),
          r: 3 + rand() * 6, speed: 0.3 + rand() * 0.4, phase: rand() * 10,
        });
      }
    }

    // Fireflies (visible at night)
    const nf = low ? 30 : 70;
    const fa = new Float32Array(nf * 3);
    for (let i = 0; i < nf; i++) fa.set([(rand() - 0.5) * W * 1.2, 0.8 + rand() * 4, (rand() - 0.5) * D * 1.2], i * 3);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fa, 3));
    this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ map: this.textures.star, color: '#e9ff8a', size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.fireflies.userData.base = fa.slice();
    this.fxLayer.add(this.fireflies);
  }

  /** Light, sky and fog for the current hour and weather. */
  private applyEnv() {
    const { hour, sky } = this.env;
    const e = sunElevation(hour);
    const day = THREE.MathUtils.clamp(e * 2.2, 0, 1); // 0 night … 1 bright day
    const overcast = { clear: 0, partly: 0.15, cloudy: 0.4, fog: 0.5, rain: 0.6, storm: 0.75 }[sky] ?? 0;

    const skyCol = skyColorAt(hour).lerp(new THREE.Color(day > 0.3 ? '#9aa6ab' : '#2a3140'), overcast * 0.8);
    this.scene.background = skyCol;
    const span = Math.max(this.plotW, this.plotD);
    const fogNear = sky === 'fog' ? span * 0.3 : span * 1.4;
    this.scene.fog = new THREE.Fog(skyCol, fogNear, span * 4.2);

    // Sun travels east (+x) → west (−x)
    const az = ((hour - 6) / 12) * Math.PI;
    const dist = span * 1.6;
    if (e > -0.05) {
      this.sun.position.set(Math.cos(az) * dist, Math.max(0.08, e) * dist, dist * 0.35);
      this.sun.color.set(e < 0.3 ? '#ffc58f' : '#fff4d6');
      this.sun.intensity = (0.6 + 1.2 * day) * (1 - overcast * 0.55);
    } else {
      // moonlight
      this.sun.position.set(-dist * 0.4, dist * 0.8, -dist * 0.3);
      this.sun.color.set('#9fb4ff');
      this.sun.intensity = 0.55;
    }
    this.hemi.intensity = 0.5 + 0.5 * day;
    this.hemi.color.set(day > 0.2 ? '#cfeaff' : '#6d7fb8');
    this.ambient.intensity = 0.12 + (1 - day) * 0.18;
    this.renderer.toneMappingExposure = 1.0 + 0.1 * day;

    if (this.hutWindow) this.hutWindow.emissiveIntensity = day < 0.25 ? 1.6 : 0;
    if (this.fireflies) this.fireflies.visible = day < 0.2 && sky !== 'rain' && sky !== 'storm';
    for (const b of this.butterflies) b.mesh.visible = day > 0.3;
    for (const g of this.glows) (g.sprite.material as THREE.SpriteMaterial).opacity = 1;
  }

  private applySelection() {
    if (!this.selectRing) return;
    if (this.selectLabel) { this.treeLayer.remove(this.selectLabel); this.selectLabel.material.map?.dispose(); this.selectLabel.material.dispose(); this.selectLabel = undefined; }
    const info = this.infos.find((i) => i.tree.id === this.selectedId);
    if (!info) { this.selectRing.visible = false; return; }
    const R = Math.max(1.2, (0.45 + 2.6 * info.g) * 1.05);
    this.selectRing.visible = true;
    this.selectRing.position.set(info.x, 0.06, info.z);
    this.selectRing.scale.setScalar(R);
    this.selectLabel = this.makeLabel(info.tree.name, info);
    this.treeLayer.add(this.selectLabel);
  }

  private makeLabel(text: string, info: TreeInfo) {
    const { tex, aspect } = labelTexture(text);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false }));
    s.scale.set(1.4 * aspect, 1.4, 1);
    s.position.set(info.x, info.height + 3, info.z);
    s.renderOrder = 10;
    return s;
  }

  private setHover(idx: number) {
    if (idx === this.hoverIndex) return;
    this.hoverIndex = idx;
    this.renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'grab';
    if (this.hoverLabel) { this.treeLayer.remove(this.hoverLabel); this.hoverLabel.material.map?.dispose(); this.hoverLabel.material.dispose(); this.hoverLabel = undefined; }
    const info = this.infos[idx];
    if (info && info.tree.id !== this.selectedId) {
      this.hoverLabel = this.makeLabel(info.tree.name, info);
      (this.hoverLabel.material as THREE.SpriteMaterial).opacity = 0.85;
      this.treeLayer.add(this.hoverLabel);
    }
    this.needsRender = true;
  }

  // ------------------------------------------------------------------ input

  private pick(clientX: number, clientY: number): number {
    if (!this.canopy || !this.trunk) return -1;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.canopy, this.trunk], false);
    for (const h of hits) {
      if (h.instanceId == null) continue;
      if (h.object === this.canopy) return this.canopyBase[h.instanceId]?.owner ?? -1;
      if (h.object === this.trunk) return this.trunkOwner[h.instanceId] ?? -1;
    }
    return -1;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY, time: performance.now() };
    this.resetAnim = null;
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.downAt;
    this.downAt = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 8 || performance.now() - d.time > 600) return; // it was a drag
    const idx = this.pick(e.clientX, e.clientY);
    const id = idx >= 0 ? this.infos[idx].tree.id : null;
    this.select(id);
    this.opts.onSelect(id);
  };

  private lastMove = 0;
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now();
    if (now - this.lastMove < 60) return; // throttle raycasts
    this.lastMove = now;
    this.setHover(this.pick(e.clientX, e.clientY));
  };

  private onVisibility = () => {
    this.visible = document.visibilityState === 'visible';
    if (this.visible) { this.clock.getDelta(); this.needsRender = true; }
  };

  // ------------------------------------------------------------------ loop

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  private animateTo(target: THREE.Vector3, distance: number) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.resetAnim = {
      from: this.camera.position.clone(), to: target.clone().add(dir.multiplyScalar(distance)).setY(Math.max(14, distance * 0.6)),
      tFrom: this.controls.target.clone(), tTo: target.clone().setY(3), t: 0,
    };
  }

  private start() {
    this.running = true;
    this.renderer.setAnimationLoop((time: number) => this.frame(time));
  }

  private frame(time: number) {
    if (!this.running || !this.visible) return;
    const low = this.opts.quality === 'low';
    if (low && time - this.lastFrame < 33) return; // ~30 fps cap
    this.lastFrame = time;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    if (this.resetAnim) {
      const a = this.resetAnim;
      a.t = Math.min(1, a.t + dt * 1.6);
      const k = 1 - Math.pow(1 - a.t, 3);
      this.camera.position.lerpVectors(a.from, a.to, k);
      this.controls.target.lerpVectors(a.tFrom, a.tTo, k);
      if (a.t >= 1) this.resetAnim = null;
      this.needsRender = true;
    }
    const controlsMoved = this.controls.update();
    const animating = this.env.effects;
    if (!animating && !this.needsRender && !controlsMoved) return;

    if (animating) this.animate(t, dt);
    if (this.selectRing?.visible) {
      const m = this.selectRing.material as THREE.MeshBasicMaterial;
      m.opacity = 0.6 + 0.35 * Math.sin(t * 4);
    }
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
  }

  private dummy = new THREE.Object3D();
  private animate(t: number, dt: number) {
    // wind: sway canopies
    if (this.canopy) {
      const windAmp = 0.025 + Math.min(this.env.wind, 40) * 0.0016 + (this.env.sky === 'storm' ? 0.04 : 0);
      const d = this.dummy;
      for (let i = 0; i < this.canopyBase.length; i++) {
        const b = this.canopyBase[i];
        const ph = this.infos[b.owner]?.sway ?? 0;
        const sw = Math.sin(t * 1.4 + ph) * windAmp;
        d.position.copy(b.pos);
        d.position.x += sw * b.pos.y * 0.15;
        d.scale.copy(b.scale);
        d.rotation.set(sw * 0.6, ph, b.tilt + sw);
        d.updateMatrix();
        this.canopy.setMatrixAt(i, d.matrix);
      }
      this.canopy.instanceMatrix.needsUpdate = true;
    }
    // bobbing status badges
    for (const ic of this.icons) ic.sprite.position.y = ic.baseY + Math.sin(t * 2 + ic.phase) * 0.35;
    // pulsing glow on ready trees
    for (const g of this.glows) { const s = 1 + Math.sin(t * 2.2 + g.phase) * 0.08; g.sprite.scale.x = g.sprite.scale.y = (g.sprite.userData.s ??= g.sprite.scale.x) * s; }
    this.updateSparkles(t);

    // clouds drift
    const span = Math.max(this.plotW, this.plotD) * 1.4;
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt * (1 + this.env.wind * 0.05);
      if (c.group.position.x > span) c.group.position.x = -span;
    }
    // rain falls
    if (this.rain) {
      const p = this.rain.geometry.attributes.position as THREE.BufferAttribute;
      const arr = p.array as Float32Array;
      const fall = dt * 38;
      for (let i = 0; i < arr.length; i += 6) {
        arr[i + 1] -= fall; arr[i + 4] -= fall;
        if (arr[i + 4] < 0) { arr[i + 1] += 50; arr[i + 4] += 50; }
      }
      p.needsUpdate = true;
    }
    // lightning
    if (this.env.sky === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer < 0) { this.ambient.intensity = 2.5; this.lightningTimer = 4 + Math.random() * 6; }
      else if (this.ambient.intensity > 0.4) this.ambient.intensity *= 0.85;
    }
    // butterflies flutter in loops
    for (const b of this.butterflies) {
      if (!b.mesh.visible) continue;
      const a = t * b.speed + b.phase;
      b.mesh.position.set(b.center.x + Math.cos(a) * b.r, b.center.y + Math.sin(a * 2.3) * 0.8, b.center.z + Math.sin(a) * b.r);
      b.mesh.rotation.y = -a;
      const flap = Math.sin(t * 14 + b.phase) * 0.9;
      b.mesh.userData.lp.rotation.y = flap;
      b.mesh.userData.rp.rotation.y = -flap;
    }
    // fireflies drift & blink
    if (this.fireflies?.visible) {
      const p = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.fireflies.userData.base as Float32Array;
      const arr = p.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = base[i] + Math.sin(t * 0.5 + i) * 1.2;
        arr[i + 1] = base[i + 1] + Math.sin(t * 0.8 + i * 0.3) * 0.6;
        arr[i + 2] = base[i + 2] + Math.cos(t * 0.4 + i) * 1.2;
      }
      p.needsUpdate = true;
      (this.fireflies.material as THREE.PointsMaterial).opacity = 0.6 + 0.4 * Math.sin(t * 3);
    }
  }

  private updateSparkles(t: number) {
    if (!this.sparkles) return;
    const p = this.sparkles.geometry.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    this.sparkleBase.forEach((s, i) => {
      const a = s.a + t * s.speed;
      arr[i * 3] = s.x + Math.cos(a) * s.r;
      arr[i * 3 + 1] = s.y + Math.sin(t * 1.5 + s.a) * 0.6;
      arr[i * 3 + 2] = s.z + Math.sin(a) * s.r;
    });
    p.needsUpdate = true;
    (this.sparkles.material as THREE.PointsMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 5);
  }
}

/** True if this browser can create a WebGL context. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
