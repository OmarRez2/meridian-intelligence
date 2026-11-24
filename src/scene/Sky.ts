import * as THREE from 'three';
import type { SkyData } from '../data/derive';
import { rng, gauss } from '../lib/rng';
import { L, segName, int } from '../i18n';

/**
 * The Meridian sky: one persistent WebGL scene shared by every route.
 *
 *  - a far star field (atmosphere only)
 *  - the planisphere plate: rings, meridians, a 48-month calendar rim (drawn on with a shader)
 *  - eight territory constellations hovering over the plate (demand, sized by revenue share)
 *  - network nodes: suppliers (brass), the warehouse hub (centre), customer clusters (glacier) under their territory
 *  - one morphing particle system with four states, blended on the GPU:
 *      0 territory constellations  ->  1 supply routes  ->  2 refinement strata  ->  3 radial 48-month chart
 *
 * Every particle layout is assigned at random rather than by index, so drawing only the first N
 * particles (adaptive quality) thins every state evenly instead of deleting parts of it.
 *
 * The scene never reads a dataset itself. It is given a `SkyData` (from `data/derive.ts`, fed by the
 * adapter) and rebuilds only its data layer (constellations, nodes, particles) when that changes.
 * An 'empty' SkyData draws the instrument with nothing encoded: equal territories and a bare rim.
 */

/** Constellation centres on the plate: the demo's US territories (x east, z south) and the five customer segments. */
const TERRITORY_XZ: Record<string, [number, number]> = {
  'Novelty Shop': [-2.2, -1.6],
  Supermarket: [4.6, -3.4],
  'Gift Store': [5.4, 2.0],
  'Computer Store': [1.0, 4.8],
  Corporate: [-4.6, 4.0],
  'Far West': [-6.6, -0.4],
  'Rocky Mountain': [-3.7, -3.9],
  Southwest: [-3.6, 3.1],
  Plains: [-0.9, -1.4],
  'Great Lakes': [2.2, -4.2],
  Mideast: [5.1, -0.9],
  Southeast: [3.0, 3.6],
  'New England': [6.5, -4.6],
};

/** Known territory names sit where they would on a US map; any other name is placed on a ring. */
function territoryXZ(name: string, i: number, n: number): [number, number] {
  const known = TERRITORY_XZ[name];
  if (known) return known;
  const a = (i / Math.max(1, n)) * Math.PI * 2;
  return [5.6 * Math.cos(a), 5.6 * Math.sin(a)];
}

/** True for CPU rasterisers (SwiftShader, llvmpipe, Microsoft Basic Render Driver). */
function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

export type Rig = {
  p: number;        // morph progress 0..3
  dist: number;     // camera distance
  elev: number;     // camera elevation (radians)
  azim: number;     // camera azimuth (radians)
  lookY: number;
  plateX: number;   // horizontal offset of the instrument in world units
  draw: number;     // plate line reveal 0..1
  lines: number;    // plate line opacity
  warp: number;     // 0..1 collapse into the hub
  fade: number;     // global fade
  shiftY: number;   // vertical screen offset as a fraction of the viewport (positive lifts the scene); used on mobile
  stars: number;    // territory constellation emphasis 0..1 (lines and anchor stars)
  focus: number;    // 0..1: in the strata state, dim the unordered layers so the top lattice reads
};

/**
 * Adaptive quality. Levels step down one at a time and never back up during a visit:
 *  0 full · 1 lower pixel ratio · 2 also 60% of the particles · 3 also a steady ~30 fps, even while moving.
 * `software` is true when the browser reports a software rasteriser; such devices start at level 3.
 */
export type Quality = { level: 0 | 1 | 2 | 3; pixelRatio: number; particles: number; frameMs: number | null; locked: boolean; software: boolean };

/**
 * Render cadence, in frames per second, chosen per frame:
 *  - while the camera, scroll, pointer or an overlay is changing, and while the supply routes flow: up to 60 fps
 *    (on 120/144 Hz screens every second refresh, so pacing stays even);
 *  - when only the slow ambient drift remains: ~30 fps; behind reading pages: ~20 fps;
 *  - when motion is paused or reduced and nothing is changing: no frames at all (the loop sleeps until woken).
 * `?quality=high` renders every display refresh, as before.
 */
const FPS = { active: 60, idle: 30, ambientIdle: 20, ambientActive: 30 };

const RIG_KEYS = ['p', 'dist', 'elev', 'azim', 'lookY', 'plateX', 'draw', 'lines', 'warp', 'fade', 'shiftY', 'stars', 'focus'] as const satisfies readonly (keyof Rig)[];
// compile-time check that the list names every Rig field
const _rigKeysComplete: Record<Exclude<keyof Rig, (typeof RIG_KEYS)[number]>, never> = {};
void _rigKeysComplete;

const PLATE_R = 10;
/** The calendar rim has 48 positions: four years. */
const RIM_MONTHS = 48;
const RIM_IN = 10.15;
const RIM_OUT = 10.7;
/**
 * Light theme ("Day"): the same instrument engraved in ink on vellum. Additive light would vanish on a pale
 * ground, so every material switches to normal blending and its colour is mapped through `ink()`: near-white
 * becomes deep navy, saturated colours become their darker, printed hue. uInk eases 0 → 1.
 */
const INK = /* glsl */ `
  uniform float uInk;
  vec3 ink(vec3 c){
    float chroma = max(max(c.r,c.g),c.b) - min(min(c.r,c.g),c.b);
    vec3 printed = mix(vec3(.07,.13,.24), c*.52, clamp(chroma*2.6, 0., 1.));
    return mix(c, printed, uInk);
  }
`;
const GROUND = { dark: new THREE.Color('#060f22'), light: new THREE.Color('#efeae0') };

const COLORS = {
  chalk: new THREE.Color('#e8edf2'),
  haze: new THREE.Color('#93a7c2'),
  brass: new THREE.Color('#d4a85a'),
  glacier: new THREE.Color('#8fd8e8'),
  ember: new THREE.Color('#ef7a8a'),
  deep: new THREE.Color('#3d5a86'),
};

export type NodeInfo = { kind: 'supplier' | 'hub' | 'customer'; label: string; detail: string; pos: THREE.Vector3 };
/** `share` is null when the instrument is empty (no data to size it by). */
export type TerritoryInfo = { label: string; share: number | null; centre: THREE.Vector3; labelPos: THREE.Vector3 };

export class Sky {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private plate = new THREE.Group();
  /** everything whose shape depends on the data; rebuilt by setData */
  private dataLayer = new THREE.Group();
  private data!: SkyData;
  private morph!: THREE.Points;
  private morphMat!: THREE.ShaderMaterial;
  private lineMat!: THREE.ShaderMaterial;
  private starMat!: THREE.ShaderMaterial;
  private nodeMat!: THREE.ShaderMaterial;
  private constMat!: THREE.ShaderMaterial;
  private anchorMat!: THREE.ShaderMaterial;
  private raf = 0;
  private visible = true;
  private lastFrame = 0;
  private pointer = new THREE.Vector2(0, 0);
  private pointerSmooth = new THREE.Vector2(0, 0);
  private spin = 0;
  /** scene clock in seconds; it stops while motion is paused */
  private clock = 0;
  private appliedShift = NaN;
  private dirty = true;
  private readonly lookTarget = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private maxPixelRatio: number;
  private particleCount: number;
  private frameSamples: number[] = [];
  /** display refresh interval (ms), estimated from requestAnimationFrame gaps */
  private vsyncMs = 1000 / 60;
  private vsyncSamples: number[] = [];
  private lastTick = 0;
  /** display refreshes since the last rendered frame */
  private skipped = 0;
  /** something besides the ambient drift changed recently: render at the full cadence */
  private active = true;
  private lost = false;
  private started = false;
  /** rendered frames to ignore before sampling quality again (after waking or a route change) */
  private warm = 30;
  private slowWindows = 0;
  /** rendered frames since start (read by QA scripts) */
  renders = 0;
  /** called with false when the WebGL context is lost and true when it is restored */
  onContext?: (ok: boolean) => void;
  private _ambient = false;

  readonly nodes: NodeInfo[] = [];
  readonly territories: TerritoryInfo[] = [];
  readonly rimYears: { year: number; pos: THREE.Vector3 }[] = [];
  /** target the rig eases toward; `rig` is the smoothed state actually rendered */
  target: Rig;
  rig: Rig;
  reduced: boolean;
  /** visitor-controlled pause for all autonomous motion (WCAG 2.2.2); camera still follows scroll */
  paused = false;
  quality: Quality;
  onFrame?: () => void;

  /** shared by every material, so one write re-inks the whole scene */
  private readonly ink = { value: 0 };
  private light = false;

  constructor(canvas: HTMLCanvasElement, opts: { reduced: boolean; coarse: boolean; data: SkyData; light?: boolean }) {
    this.light = !!opts.light;
    this.ink.value = this.light ? 1 : 0;
    this.reduced = opts.reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.maxPixelRatio = Math.min(window.devicePixelRatio, opts.coarse ? 1.5 : 2);
    this.renderer.setPixelRatio(this.maxPixelRatio);
    this.renderer.setClearColor(this.light ? GROUND.light : GROUND.dark, 1);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
    this.scene.fog = new THREE.FogExp2(this.light ? GROUND.light : GROUND.dark, 0.0045);

    const base: Rig = { p: 0, dist: 25, elev: 0.42, azim: 0, lookY: 1.2, plateX: 4.6, draw: 1, lines: 1, warp: 0, fade: 1, shiftY: 0, stars: 1, focus: 0 };
    // any write to the target (scroll, route rigs, GSAP timelines) wakes the loop
    this.target = new Proxy({ ...base }, {
      set: (o, k, v) => {
        const r = o as Record<string | symbol, unknown>;
        if (r[k] !== v) { r[k] = v; this.kick(); }
        return true;
      },
    });
    this.rig = { ...base };

    this.particleCount = opts.coarse ? 4200 : 9600;
    const locked = new URLSearchParams(location.search).get('quality') === 'high';
    const software = isSoftwareRenderer(this.renderer.getContext());
    this.quality = { level: 0, pixelRatio: this.maxPixelRatio, particles: this.particleCount, frameMs: null, locked, software };
    if (software && !locked) {
      // a CPU rasteriser: start at the lightest level instead of discovering it frame by frame
      this.quality.level = 3;
      this.quality.pixelRatio = 1;
      this.quality.particles = Math.round(this.particleCount * 0.6);
      this.renderer.setPixelRatio(1);
    }

    this.buildStars(opts.coarse ? 1400 : 2600);
    this.buildPlate();
    this.plate.add(this.dataLayer);
    this.buildData(opts.data);
    this.scene.add(this.plate);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      if (!this.reduced) this.kick();
    }, { passive: true });
    // background tabs: the browser stops requestAnimationFrame; on return, start without a time jump
    document.addEventListener('visibilitychange', () => {
      this.visible = document.visibilityState === 'visible';
      if (this.visible) { this.lastFrame = 0; this.warm = 30; this.dirty = true; this.kick(); }
    });
    // GPU resets (driver update, too many contexts, a phone reclaiming memory): show the static
    // fallback while the context is gone; Three.js re-uploads everything when it comes back
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.onContext?.(false);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.resize();
      this.onContext?.(true);
      this.kick();
    });
  }

  /** ambient mode: the sky sits behind a reading page and renders at a lower cadence */
  get ambient() { return this._ambient; }
  set ambient(a: boolean) {
    if (a === this._ambient) return;
    this._ambient = a;
    this.warm = 30; // route changes are not representative frames
    this.kick();
  }

  /* ------------------------------------------------------------------ build */

  private buildStars(n: number) {
    const r = rng(77);
    const pos = new Float32Array(n * 3);
    const mag = new Float32Array(n);
    const tw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, rad = 140 + r() * 120;
      const s = Math.sqrt(1 - u * u);
      pos.set([rad * s * Math.cos(th), rad * u * 0.8 + 20, rad * s * Math.sin(th)], i * 3);
      mag[i] = Math.pow(r(), 5) * 3.2 + 0.6;
      tw[i] = r() * 6.283;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    g.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
    this.starMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: this.blend(),
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uFade: { value: 1 }, uTwinkle: { value: this.reduced ? 0 : 1 }, uInk: this.ink },
      vertexShader: /* glsl */ `
        attribute float aMag; attribute float aTw;
        uniform float uTime, uPixel, uTwinkle; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position,1.);
          gl_Position = projectionMatrix * mv;
          float tw = 0.75 + 0.25*sin(uTime*(0.6+aTw*0.2)+aTw*7.)*uTwinkle;
          vA = clamp(aMag/3.8,0.15,1.)*tw;
          gl_PointSize = aMag * uPixel * 1.2;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade; varying float vA; ${INK}
        void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(ink(vec3(.86,.9,.96)), a*vA*uFade*mix(.8,.5,uInk)); }`,
    });
    this.scene.add(new THREE.Points(g, this.starMat));
  }

  private buildPlate() {
    const pos: number[] = [];
    const u: number[] = [];
    const tone: number[] = []; // 0 haze line, 1 brass line, 2 faint
    const seg = (a: THREE.Vector3, b: THREE.Vector3, ua: number, ub: number, t: number) => {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z); u.push(ua, ub); tone.push(t, t);
    };
    const P = (r: number, th: number, y = 0) => new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th));
    // concentric declination rings
    const rings = [2.5, 5, 7.5, PLATE_R];
    rings.forEach((rr, k) => {
      const n = 180;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2;
        seg(P(rr, a), P(rr, b), 0.05 + k * 0.06 + (i / n) * 0.55, 0.05 + k * 0.06 + ((i + 1) / n) * 0.55, k === rings.length - 1 ? 0 : 2);
      }
    });
    // rim band
    for (const rr of [RIM_IN, RIM_OUT]) {
      const n = 240;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2;
        seg(P(rr, a), P(rr, b), 0.3 + (i / n) * 0.5, 0.3 + ((i + 1) / n) * 0.5, 1);
      }
    }
    // meridians every 30°
    for (let k = 0; k < 12; k++) {
      const th = (k / 12) * Math.PI * 2;
      seg(P(0.6, th), P(PLATE_R, th), 0.1 + k * 0.03, 0.45 + k * 0.03, 2);
    }
    // calendar ticks: 48 months, years marked longer
    for (let m = 0; m < RIM_MONTHS; m++) {
      const th = this.monthAngle(m);
      const year = m % 12 === 0;
      seg(P(RIM_IN, th), P(year ? RIM_OUT + 0.9 : RIM_OUT, th), 0.6 + (m / RIM_MONTHS) * 0.35, 0.62 + (m / RIM_MONTHS) * 0.35, 1);
      // quarter sub ticks
      for (const q of [1 / 3, 2 / 3]) {
        const t2 = this.monthAngle(m + q);
        seg(P(RIM_IN, t2), P(RIM_IN + 0.18, t2), 0.7, 0.72, 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
    this.lineMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uDraw: { value: 1 }, uOpacity: { value: 1 }, uFade: { value: 1 }, uInk: this.ink },
      vertexShader: /* glsl */ `
        attribute float aU; attribute float aTone; varying float vU; varying float vTone; varying float vDepth;
        void main(){ vU=aU; vTone=aTone; vec4 mv=modelViewMatrix*vec4(position,1.); vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uDraw, uOpacity, uFade; varying float vU; varying float vTone; varying float vDepth; ${INK}
        void main(){
          if(vU > uDraw) discard;
          float head = smoothstep(uDraw-0.04, uDraw, vU);
          vec3 haze = vec3(.58,.65,.76); vec3 brass = vec3(.83,.66,.35);
          vec3 c = vTone > .5 && vTone < 1.5 ? brass : haze;
          float a = vTone > 1.5 ? .16 : (vTone > .5 ? .55 : .34);
          a *= smoothstep(60., 14., vDepth);
          gl_FragColor = vec4(ink(mix(c, vec3(1.), head)), (a + head*.6) * uOpacity * uFade);
        }`,
    });
    this.plate.add(new THREE.LineSegments(g, this.lineMat));
  }

  /** Builds the data layer. Seeds are fixed, so the same data always draws the same sky. */
  private buildData(data: SkyData) {
    this.data = data;
    this.rimYears.length = 0;
    if (data.startYear !== null) {
      for (let k = 0; k < RIM_MONTHS / 12; k++) {
        const th = this.monthAngle(k * 12) + 0.11, rr = RIM_OUT + 1.6;
        this.rimYears.push({ year: data.startYear + k, pos: new THREE.Vector3(rr * Math.cos(th), 0, rr * Math.sin(th)) });
      }
    }
    this.buildNodes();
    this.buildMorph(this.particleCount);
    this.buildConstellations();
    this.morph.geometry.setDrawRange(0, this.quality.particles);
  }

  /** Swaps the data the instrument encodes (for example demo → verified). Only the data layer is rebuilt. */
  setData(data: SkyData) {
    if (data === this.data) return;
    for (const obj of [...this.dataLayer.children]) {
      this.dataLayer.remove(obj);
      const o = obj as THREE.Points | THREE.LineSegments;
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    this.nodes.length = 0;
    this.territories.length = 0;
    this.anchors = [];
    this.spreads = [];
    this.supplierPos = [];
    this.customerPos = [];
    this.buildData(data);
    this.updatePixelUniforms();
    this.dirty = true;
    this.kick();
  }

  /** 'data' or 'empty': what the instrument currently encodes (read by QA scripts) */
  get dataKind() { return this.data.kind; }

  monthAngle(m: number) {
    // Calendar begins at the 10 o'clock position and runs clockwise as seen from above.
    return -Math.PI * 0.78 + (m / RIM_MONTHS) * Math.PI * 2;
  }

  private supplierPos: THREE.Vector3[] = [];
  private customerPos: THREE.Vector3[] = [];
  private buildNodes() {
    const r = rng(1201);
    const hub = new THREE.Vector3(0, 0.02, 0);
    const q = this.data.qualifier;
    this.nodes.push({ kind: 'hub', label: L('Warehouse hub', 'المستودع المركزي'), detail: q === 'demo' ? L('Every order and receipt in the demo network passes through one warehouse.', 'كل طلب واستلام في الشبكة التجريبية يمر عبر مستودع واحد.') : L('Every order and receipt passes through one warehouse in the source data.', 'كل طلب واستلام في بيانات المصدر يمر عبر مستودع واحد.'), pos: hub });
    // suppliers sit on the outer ring: goods arrive from beyond the territories (ten fill the arc; more share it)
    const sups = this.data.suppliers;
    const stepA = 0.2 * Math.min(1, 10 / Math.max(1, sups.length));
    sups.forEach((s, i) => {
      const th = Math.PI * (0.62 + i * stepA) + gauss(r) * 0.03;
      const rr = 8.7 + r() * 0.9;
      r(); // keeps the seeded sequence, and so the demo layout, unchanged
      const p = new THREE.Vector3(rr * Math.cos(th), 0.02, rr * Math.sin(th));
      this.supplierPos.push(p);
      const detail = s.orders === null ? L('No project data is loaded', 'لم تُحمَّل بيانات المشروع') : L(`${int(s.orders)} purchase orders`, `${int(s.orders)} أمر شراء`);
      this.nodes.push({ kind: 'supplier', label: s.label, detail, pos: p });
    });
    // customer clusters sit on the plate directly under their territory's constellation
    const empty = this.data.kind === 'empty';
    this.data.territories.forEach((ter, t) => {
      const [cx, cz] = territoryXZ(ter.label, t, this.data.territories.length);
      const count = Math.max(1, Math.round(ter.share * 18));
      for (let k = 0; k < count; k++) {
        const a = r() * 6.283, d = k === 0 ? 0 : 0.7 + r() * 0.9;
        const p = new THREE.Vector3(cx + d * Math.cos(a), 0.02, cz + d * Math.sin(a));
        this.customerPos.push(p);
        const n = this.data.customers[t];
        this.nodes.push({ kind: 'customer', label: segName(ter.label), detail: empty || n === null ? L('Segment position only; no project data is loaded', 'موضع الشريحة فقط؛ لم تُحمَّل بيانات المشروع') : L(`${int(n)} customers in this segment`, `${int(n)} عميلًا في هذه الشريحة`), pos: p });
      }
    });
    const n = this.nodes.length;
    const pos = new Float32Array(n * 3), kind = new Float32Array(n), seed = new Float32Array(n);
    this.nodes.forEach((nd, i) => { pos.set([nd.pos.x, nd.pos.y, nd.pos.z], i * 3); kind[i] = nd.kind === 'hub' ? 2 : nd.kind === 'supplier' ? 0 : 1; seed[i] = r(); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.nodeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: this.blend(),
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uShow: { value: 1 }, uHover: { value: -1 }, uFade: { value: 1 }, uInk: this.ink },
      vertexShader: /* glsl */ `
        attribute float aKind; attribute float aSeed; uniform float uTime, uPixel, uShow, uHover;
        varying float vKind; varying float vHot; varying float vPulse;
        void main(){
          vKind=aKind; vHot = abs(float(gl_VertexID) - uHover) < .5 ? 1. : 0.;
          vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
          vPulse = .5+.5*sin(uTime*1.6 + aSeed*6.283);
          float s = aKind > 1.5 ? 46. : (aKind < .5 ? 20. : 15.);
          gl_PointSize = s * uPixel * (24. / -mv.z) * (1. + vHot*.7) * uShow;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uShow, uFade; varying float vKind; varying float vHot; varying float vPulse; ${INK}
        void main(){
          vec2 q = gl_PointCoord-.5; float d=length(q);
          vec3 c = vKind > 1.5 ? vec3(.95,.97,1.) : (vKind < .5 ? vec3(.83,.66,.35) : vec3(.56,.85,.91));
          float core = smoothstep(.16,.0,d);
          float ring = smoothstep(.035,.0,abs(d-.36)) * (vKind>1.5 ? .9 : .55+vHot*.45);
          float glow = smoothstep(.5,.0,d)*.25*(.6+.4*vPulse);
          float a = (core + ring + glow) * uShow * uFade;
          if(a<.01) discard;
          gl_FragColor=vec4(ink(c), min(1., a*mix(1., 1.25, uInk)));
        }`,
    });
    this.dataLayer.add(new THREE.Points(g, this.nodeMat));
  }

  private buildMorph(n: number) {
    const r = rng(4242);
    const s0 = new Float32Array(n * 3), A = new Float32Array(n * 3), C = new Float32Array(n * 3), B = new Float32Array(n * 3);
    const s2 = new Float32Array(n * 3), s3 = new Float32Array(n * 3);
    const c0 = new Float32Array(n * 3), c1 = new Float32Array(n * 3), c2 = new Float32Array(n * 3), c3 = new Float32Array(n * 3);
    const delay = new Float32Array(n), uu = new Float32Array(n), speed = new Float32Array(n), rnd = new Float32Array(n * 3);
    const layer = new Float32Array(n); // strata order 0 (raw) .. 1 (lattice)
    const hub = new THREE.Vector3(0, 0, 0);

    // state 0: one constellation per territory hovering above its customers, plus loose dust
    this.layoutTerritories();
    const cum: number[] = [];
    this.data.territories.reduce((a, t, i) => (cum[i] = a + t.share), 0);
    const pickTerritory = (x: number) => { const i = cum.findIndex((c) => x <= c); return i < 0 ? cum.length - 1 : i; };
    // state 1: routes
    const routes: { a: THREE.Vector3; b: THREE.Vector3; inbound: boolean }[] = [];
    this.supplierPos.forEach((p) => routes.push({ a: p, b: hub, inbound: true }));
    this.customerPos.forEach((p) => routes.push({ a: hub, b: p, inbound: false }));
    if (this.supplierPos.length) for (let i = 0; i < 6; i++) routes.push({ a: this.supplierPos[(i * 3) % this.supplierPos.length], b: hub, inbound: true });
    // state 3: radial dial bars, one column per data month (none when there is no data)
    const dial = this.data.dial;
    const months = dial.length;
    const maxV = months ? Math.max(...dial) : 1, minV = months ? Math.min(...dial) : 0;
    const range = maxV - minV || 1;

    const LAYERS = 5;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      // s0: 74% of particles belong to a territory (chosen by revenue share), clinging to its anchor stars
      const t0 = 0.55 + r() * 0.45;
      if (r() < 0.74) {
        const ter = this.territories[pickTerritory(r())];
        const anchors = this.anchors[this.territories.indexOf(ter)];
        const spread = this.spreads[this.territories.indexOf(ter)];
        if (r() < 0.5) {
          const a = anchors[Math.floor(r() * anchors.length)];
          s0.set([a.x + gauss(r) * 0.22, a.y + gauss(r) * 0.16, a.z + gauss(r) * 0.22], o);
        } else {
          s0.set([ter.centre.x + gauss(r) * spread * 0.55, ter.centre.y + gauss(r) * spread * 0.32, ter.centre.z + gauss(r) * spread * 0.55], o);
        }
        const col0 = r() < 0.2 ? COLORS.glacier : COLORS.chalk;
        c0.set([col0.r * t0, col0.g * t0, col0.b * t0], o);
      } else {
        const rr = Math.sqrt(r()) * 13, th = r() * 6.283;
        s0.set([rr * Math.cos(th), 0.4 + r() * 9, rr * Math.sin(th)], o);
        const col0 = r() < 0.15 ? COLORS.brass : COLORS.haze;
        c0.set([col0.r * t0 * 0.7, col0.g * t0 * 0.7, col0.b * t0 * 0.7], o);
      }

      // s1
      const rt = routes[Math.floor(r() * routes.length)];
      const mid = rt.a.clone().add(rt.b).multiplyScalar(0.5);
      mid.y += rt.a.distanceTo(rt.b) * 0.34;
      mid.x += gauss(r) * 0.08; mid.z += gauss(r) * 0.08;
      A.set([rt.a.x, rt.a.y, rt.a.z], o); C.set([mid.x, mid.y, mid.z], o); B.set([rt.b.x, rt.b.y, rt.b.z], o);
      const col1 = rt.inbound ? COLORS.brass : COLORS.glacier;
      c1.set([col1.r, col1.g, col1.b], o);

      // s2: refinement strata — noise at the bottom, a precise polar lattice at the top
      const L = Math.floor(r() * LAYERS);
      const order = L / (LAYERS - 1);
      const y = 0.9 + L * 1.9;
      const lr = 9.4 - L * 0.9;
      const rings = 6 + L * 2;
      const ringIdx = Math.floor(r() * rings);
      const spokes = 36 + L * 12;
      const sp = Math.floor(r() * spokes);
      const gridR = ((ringIdx + 1) / rings) * lr, gridT = (sp / spokes) * 6.283;
      const rr = Math.sqrt(r()) * lr, th = r() * 6.283;
      const rx = rr * Math.cos(th), rz = rr * Math.sin(th);
      const gx = gridR * Math.cos(gridT), gz = gridR * Math.sin(gridT);
      const jitter = (1 - order) * 0.35;
      s2.set([rx + (gx - rx) * order + gauss(r) * jitter, y + gauss(r) * 0.18 * (1 - order), rz + (gz - rz) * order + gauss(r) * jitter], o);
      const col2 = COLORS.deep.clone().lerp(COLORS.chalk, 0.25 + order * 0.75);
      if (L === 0 && r() < 0.22) col2.copy(COLORS.ember).multiplyScalar(1.9); // defects found before cleaning
      c2.set([col2.r, col2.g, col2.b], o);

      // s3: dial bars. Month and height come from the R2 low-discrepancy sequence, so every prefix
      // of the particle list (adaptive quality) still fills each column evenly from base to top.
      if (months && i % 50 < 47) {
        const m = Math.floor(((0.5 + i * 0.7548776662466927) % 1) * months);
        const f = (0.5 + i * 0.5698402909980532) % 1;
        const h = 0.8 + ((dial[m] - minV) / range) * 5.6;
        const th3 = this.monthAngle(m + 0.5) + (r() - 0.5) * 0.032;
        const r3 = 9.3 + (r() - 0.5) * 0.2;
        s3.set([r3 * Math.cos(th3), f * h, r3 * Math.sin(th3)], o);
        const yr = Math.floor(m / 12);
        const col3 = (yr % 2 === 0 ? COLORS.brass : COLORS.glacier).clone().lerp(COLORS.chalk, f * 0.35).multiplyScalar(1.15);
        c3.set([col3.r, col3.g, col3.b], o);
      } else {
        // leftovers settle as a faint baseline ring along the empty part of the calendar
        const th3 = this.monthAngle(months + r() * (RIM_MONTHS - months));
        s3.set([9.25 * Math.cos(th3), 0.02, 9.25 * Math.sin(th3)], o);
        c3.set([0.25, 0.3, 0.4], o);
      }

      delay[i] = r(); uu[i] = r(); speed[i] = 0.035 + r() * 0.05;
      layer[i] = order;
      rnd.set([r(), r(), r()], o);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(s0, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(A, 3));
    g.setAttribute('aC', new THREE.BufferAttribute(C, 3));
    g.setAttribute('aB', new THREE.BufferAttribute(B, 3));
    g.setAttribute('aS2', new THREE.BufferAttribute(s2, 3));
    g.setAttribute('aS3', new THREE.BufferAttribute(s3, 3));
    g.setAttribute('aC0', new THREE.BufferAttribute(c0, 3));
    g.setAttribute('aC1', new THREE.BufferAttribute(c1, 3));
    g.setAttribute('aC2', new THREE.BufferAttribute(c2, 3));
    g.setAttribute('aC3', new THREE.BufferAttribute(c3, 3));
    // four per-particle scalars share one vec4 to stay well inside the 16-attribute WebGL limit
    const meta = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) meta.set([delay[i], uu[i], speed[i], layer[i]], i * 4);
    g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 30);

    this.morphMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: this.blend(),
      uniforms: { uInk: this.ink, uP: { value: 0 }, uTime: { value: 0 }, uPixel: { value: 1 }, uWarp: { value: 0 }, uFlow: { value: this.reduced ? 0 : 1 }, uFade: { value: 1 }, uFocus: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 aA, aC, aB, aS2, aS3, aC0, aC1, aC2, aC3, aRnd;
        attribute vec4 aMeta;
        #define aDelay aMeta.x
        #define aU aMeta.y
        #define aSpeed aMeta.z
        #define aLayer aMeta.w
        uniform float uP, uTime, uPixel, uWarp, uFlow, uFocus;
        varying vec3 vCol; varying float vA;
        float stage(float k){ return smoothstep(0.,1., clamp((uP - k)*1.55 - aDelay*.55, 0., 1.)); }
        vec3 bez(vec3 a, vec3 c, vec3 b, float t){ float it=1.-t; return it*it*a + 2.*it*t*c + t*t*b; }
        void main(){
          float e1 = stage(0.), e2 = stage(1.), e3 = stage(2.);
          vec3 s0 = position + vec3(sin(uTime*.25+aRnd.x*6.28), sin(uTime*.31+aRnd.y*6.28)*.6, cos(uTime*.22+aRnd.z*6.28)) * .12 * uFlow;
          float t = fract(aU + uTime*aSpeed*uFlow);
          vec3 s1 = bez(aA, aC, aB, t);
          vec3 p = mix(s0, s1, e1);
          p = mix(p, aS2, e2);
          p = mix(p, aS3, e3);
          // in-between turbulence: particles swirl around the axis while changing state
          float k = e1*(1.-e1) + e2*(1.-e2) + e3*(1.-e3);
          float ang = k * 2.4 * (aDelay - .35);
          float cs = cos(ang), sn = sin(ang);
          p.xz = mat2(cs, -sn, sn, cs) * p.xz;
          p += (aRnd - .5) * k * 3.2;
          // warp: everything is drawn into the hub
          float w = uWarp*uWarp;
          float ra = aRnd.x*6.2832 + uTime*.9; float rr = 1.05 + aRnd.y*.28;
          vec3 ring = vec3(cos(ra)*rr, .25 + (aRnd.z-.5)*.12, sin(ra)*rr);
          p = mix(p, ring, w);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          vec3 col = mix(aC0, aC1, e1); col = mix(col, aC2, e2); col = mix(col, aC3, e3);
          vCol = col;
          float ends = mix(1., smoothstep(0., .06, t) * smoothstep(1., .9, t), e1*(1.-e2));
          // layer focus: only while the strata are formed, the unordered layers recede
          float fz = uFocus * e2 * (1. - e3);
          float lf = mix(1., .12 + .88*aLayer*aLayer, fz);
          vA = (.55 + .45*aRnd.x) * ends * (1. - w*.62) * lf;
          float size = mix(mix(mix(2.3, 1.7, e1), 1.55, e2), 2.05, e3) * (1. - w*.45) * mix(1., .75 + .7*aLayer, fz);
          gl_PointSize = size * uPixel * (26. / -mv.z) * (0.7 + aRnd.y*.6);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade; varying vec3 vCol; varying float vA; ${INK}
        void main(){
          float d = length(gl_PointCoord - .5);
          float a = smoothstep(.5, .05, d);
          gl_FragColor = vec4(ink(vCol), a * vA * uFade * mix(1., .85, uInk));
        }`,
    });
    this.morph = new THREE.Points(g, this.morphMat);
    this.dataLayer.add(this.morph);
  }

  private anchors: THREE.Vector3[][] = [];
  private spreads: number[] = [];
  /** Places each territory's constellation above its customers; size follows revenue share. */
  private layoutTerritories() {
    if (this.territories.length) return;
    const r = rng(8080);
    const ters = this.data.territories;
    const maxShare = Math.max(...ters.map((t) => t.share)) || 1;
    ters.forEach(({ label: name, share }, t) => {
      const [x, z] = territoryXZ(name, t, ters.length);
      const rel = Math.sqrt(share / maxShare);
      const spread = 0.9 + rel * 1.5;
      const y = 3.4 + ((t * 5) % 3) * 0.95;
      const centre = new THREE.Vector3(x, y, z);
      const count = 4 + Math.round(rel * 4);
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < count; k++) {
        const a = (k / count) * 6.283 + r() * 0.9;
        const d = spread * (0.35 + r() * 0.65);
        pts.push(new THREE.Vector3(x + d * Math.cos(a), y + (r() - 0.5) * spread * 0.7, z + d * Math.sin(a)));
      }
      this.anchors.push(pts);
      this.spreads.push(spread);
      this.territories.push({ label: name, share: this.data.kind === 'empty' ? null : share, centre, labelPos: new THREE.Vector3(x, y + spread * 0.55 + 0.7, z) });
    });
  }

  /** The constellation figures: bright anchor stars joined by a nearest-neighbour path. */
  private buildConstellations() {
    const linePos: number[] = [];
    const starPos: number[] = [];
    const starMag: number[] = [];
    const r = rng(5150);
    this.anchors.forEach((pts) => {
      const left = pts.slice(1);
      let cur = pts[0];
      starPos.push(cur.x, cur.y, cur.z); starMag.push(0.7 + r() * 0.6);
      while (left.length) {
        let bi = 0, bd = Infinity;
        left.forEach((p, i) => { const d = p.distanceToSquared(cur); if (d < bd) { bd = d; bi = i; } });
        const next = left.splice(bi, 1)[0];
        linePos.push(cur.x, cur.y, cur.z, next.x, next.y, next.z);
        starPos.push(next.x, next.y, next.z); starMag.push(0.55 + r() * 0.7);
        cur = next;
      }
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    this.constMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: this.blend(),
      uniforms: { uAlpha: { value: 1 }, uInk: this.ink },
      vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: /* glsl */ `uniform float uAlpha; ${INK} void main(){ gl_FragColor = vec4(ink(vec3(.62,.76,.86)), mix(.32, .42, uInk)*uAlpha); }`,
    });
    this.dataLayer.add(new THREE.LineSegments(lg, this.constMat));

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    sg.setAttribute('aMag', new THREE.Float32BufferAttribute(starMag, 1));
    this.anchorMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: this.blend(),
      uniforms: { uAlpha: { value: 1 }, uPixel: { value: 1 }, uInk: this.ink },
      vertexShader: /* glsl */ `
        attribute float aMag; uniform float uPixel;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = aMag * 9. * uPixel * (24. / -mv.z); }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha; ${INK}
        void main(){
          vec2 q = gl_PointCoord - .5; float d = length(q);
          float core = smoothstep(.14, .0, d);
          float spike = (smoothstep(.04,.0,abs(q.x)) + smoothstep(.04,.0,abs(q.y))) * smoothstep(.5,.1,d) * .45;
          float a = (core + spike + smoothstep(.5,.0,d)*.18) * uAlpha;
          if (a < .01) discard;
          gl_FragColor = vec4(ink(vec3(.93,.95,1.)), a);
        }`,
    });
    this.dataLayer.add(new THREE.Points(sg, this.anchorMat));
  }

  /* ---------------------------------------------------------------- runtime */

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.appliedShift = NaN; // re-apply the view offset for the new size
    this.updatePixelUniforms();
    this.dirty = true;
    this.kick();
  }

  private updatePixelUniforms() {
    const px = this.renderer.getPixelRatio() * Math.min(1.25, Math.max(0.8, window.innerHeight / 900));
    for (const m of [this.morphMat, this.starMat, this.nodeMat, this.anchorMat]) m.uniforms.uPixel.value = px;
  }

  setPointer(x: number, y: number) { this.pointer.set(x, y); }

  setPaused(p: boolean) { this.paused = p; this.dirty = true; this.kick(); }

  private blend() { return this.light ? THREE.NormalBlending : THREE.AdditiveBlending; }

  /** Day/night: re-inks every material and swaps the ground. No geometry is rebuilt. */
  setTheme(light: boolean) {
    if (light === this.light) return;
    this.light = light;
    this.ink.value = light ? 1 : 0;
    const g = light ? GROUND.light : GROUND.dark;
    this.renderer.setClearColor(g, 1);
    (this.scene.fog as THREE.FogExp2).color.copy(g);
    for (const m of [this.starMat, this.nodeMat, this.morphMat, this.constMat, this.anchorMat]) { m.blending = this.blend(); m.needsUpdate = true; }
    this.dirty = true;
    this.kick();
  }
  /** request one redraw, e.g. when an overlay needs fresh projections while the scene is still */
  invalidate() { this.dirty = true; this.kick(); }

  /**
   * Compiles the shaders without blocking the main thread where the browser can (KHR_parallel_shader_compile),
   * then starts the loop. Until then the page mounts and the canvas shows the background colour.
   */
  start() {
    if (this.started) return;
    const go = () => { this.started = true; this.kick(); };
    this.renderer.compileAsync(this.scene, this.camera).then(go, go);
  }

  /** something changed: render at the full cadence, and restart the loop if it was asleep */
  private kick() {
    this.active = true;
    if (!this.started || this.raf || !this.visible || this.lost) return;
    this.skipped = 1e9; // the first frame after sleeping renders on the next refresh
    this.raf = requestAnimationFrame(this.loop);
  }

  /** display refreshes per rendered frame for the current state */
  private cadence(): number {
    if (this.quality.locked) return 1;
    // the supply routes flow along the network; that motion is the content, so it keeps the full cadence
    const flowing = !this._ambient && !this.paused && !this.reduced && Math.abs(this.rig.p - 1) < 0.45;
    const fps = this._ambient
      ? (this.active ? FPS.ambientActive : FPS.ambientIdle)
      : this.quality.level >= 3 ? FPS.idle
      : this.active || flowing ? FPS.active : FPS.idle;
    return Math.max(1, Math.floor(1000 / fps / this.vsyncMs + 0.05));
  }

  private trackVsync(gap: number) {
    if (gap <= 0 || gap > 100) return;
    this.vsyncSamples.push(gap);
    if (this.vsyncSamples.length < 30) return;
    // the refresh interval is the short end of the gaps: long gaps are frames the browser could not make
    const s = this.vsyncSamples.sort((a, b) => a - b);
    this.vsyncMs = Math.max(4, s[Math.floor(s.length * 0.25)]);
    this.vsyncSamples = [];
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (!this.visible || this.lost) return;
    this.trackVsync(now - this.lastTick);
    this.lastTick = now;
    this.raf = requestAnimationFrame(this.loop);
    const k = this.cadence();
    if (++this.skipped < k) return;
    this.skipped = 0;
    const raw = this.lastFrame ? now - this.lastFrame : 0;
    this.lastFrame = now;
    if (!this.step(Math.min(0.05, raw / 1000))) {
      // nothing moves and nothing changed: sleep until kick() wakes the loop
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastFrame = 0;
      return;
    }
    if (++this.renders === 1) performance.measure('sky:first-frame', { start: now }); // includes shader compilation
    this.sampleFrame(raw, k);
  };

  /**
   * Adaptive quality. After a warm-up, frame intervals are compared with the cadence the frame was
   * scheduled for. Two consecutive windows whose median runs 45% late step the quality down one level:
   * the pixel ratio first, then the particle count, then a steady ~30 fps. Disabled with ?quality=high.
   */
  private sampleFrame(ms: number, stride: number) {
    if (this.warm > 0) { this.warm--; return; }
    if (this._ambient || this.paused || this.reduced || ms <= 0 || ms > 250) return;
    this.frameSamples.push(ms / (stride * this.vsyncMs));
    if (this.frameSamples.length < 90) return;
    const sorted = this.frameSamples.slice().sort((a, b) => a - b);
    const lateness = sorted[Math.floor(sorted.length / 2)];
    this.frameSamples = [];
    this.quality.frameMs = Math.round(lateness * stride * this.vsyncMs * 10) / 10;
    if (this.quality.locked || this.quality.level >= 3) return;
    this.slowWindows = lateness > 1.45 ? this.slowWindows + 1 : 0;
    if (this.slowWindows < 2) return;
    this.slowWindows = 0;
    this.quality.level = (this.quality.level + 1) as 1 | 2 | 3;
    if (this.quality.level === 1) {
      this.quality.pixelRatio = Math.max(1, this.maxPixelRatio * 0.7);
      this.renderer.setPixelRatio(this.quality.pixelRatio);
      this.resize();
    } else if (this.quality.level === 2) {
      this.quality.particles = Math.round(this.particleCount * 0.6);
      this.morph.geometry.setDrawRange(0, this.quality.particles);
    }
    this.warm = 20;
  }

  /** advances the rig and renders; returns false when there was nothing to draw */
  private step(dt: number): boolean {
    // critically damped approach toward target: smooth, never overshoots
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    const R = this.rig as Record<string, number>, T = this.target as Record<string, number>;
    let moving = 0;
    // a fixed key list: GSAP adds its own `_gsap` property to objects it tweens, and a for-in over the
    // target would damp that too, produce NaN and keep the scene from ever counting as settled
    for (const key of RIG_KEYS) {
      const d = T[key] - R[key];
      R[key] += d * (key === 'warp' || key === 'fade' ? Math.min(1, k * 2.2) : k);
      moving = Math.max(moving, Math.abs(d));
    }
    const still = this.paused || this.reduced;
    const pointerGap = this.reduced ? 0 : this.pointerSmooth.distanceToSquared(this.pointer);
    const pointerMoving = pointerGap > 1e-6;
    // when nothing autonomous is animating and the camera has settled, skip the frame entirely
    if (still && !this.dirty && moving < 1e-4 && !pointerMoving) return false;
    // the last stretch of a damped approach is sub-pixel: the slower cadence is enough for it
    this.active = this.dirty || moving > 2e-3 || pointerGap > 1e-4;
    this.dirty = false;

    if (!still) this.clock += dt;
    const t = this.clock;
    this.pointerSmooth.lerp(this.pointer, this.reduced ? 0 : 1 - Math.exp(-dt * 2.5));
    if (!still) this.spin += dt * (this.ambient ? 0.012 : 0.028) * (1 - this.rig.warp);

    const { dist, elev, azim, lookY, plateX, shiftY } = this.rig;
    if (Math.abs(shiftY - this.appliedShift) > 1e-4 || Number.isNaN(this.appliedShift)) {
      const w = window.innerWidth, h = window.innerHeight;
      if (Math.abs(shiftY) < 1e-4) this.camera.clearViewOffset();
      else this.camera.setViewOffset(w, h, 0, shiftY * h, w, h);
      this.appliedShift = shiftY;
    }
    const az = azim + this.pointerSmooth.x * 0.09;
    const el = Math.max(0.05, elev - this.pointerSmooth.y * 0.05);
    this.plate.position.x = plateX;
    this.plate.rotation.y = this.spin;
    const target = this.lookTarget.set(plateX * 0.55, lookY, 0);
    this.camera.position.set(target.x + dist * Math.cos(el) * Math.sin(az), lookY + dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
    this.camera.lookAt(target);

    // constellation figures read only while the particles are still stars
    const starsA = Math.max(0, 1 - this.rig.p * 2.2) * this.rig.stars * Math.min(1, this.rig.draw * 1.4) * (1 - this.rig.warp) * this.rig.fade;
    this.constMat.uniforms.uAlpha.value = starsA;
    this.anchorMat.uniforms.uAlpha.value = starsA;

    this.morphMat.uniforms.uP.value = this.rig.p;
    this.morphMat.uniforms.uTime.value = t;
    this.morphMat.uniforms.uWarp.value = this.rig.warp;
    this.morphMat.uniforms.uFocus.value = this.rig.focus;
    this.morphMat.uniforms.uFade.value = this.rig.fade;
    this.starMat.uniforms.uTime.value = t;
    this.starMat.uniforms.uFade.value = this.rig.fade;
    this.lineMat.uniforms.uDraw.value = this.rig.draw;
    this.lineMat.uniforms.uOpacity.value = this.rig.lines;
    this.lineMat.uniforms.uFade.value = this.rig.fade;
    this.nodeMat.uniforms.uTime.value = t;
    // nodes are most legible while the routes are formed
    const show = Math.max(0, 1 - Math.abs(this.rig.p - 1) * 1.1) * 0.85 + 0.15;
    this.nodeMat.uniforms.uShow.value = show * (1 - this.rig.warp) * Math.min(1, this.rig.draw * 1.5);
    this.nodeMat.uniforms.uFade.value = this.rig.fade;

    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
    return true;
  }

  /** world → screen px for HTML overlays */
  project(local: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const v = this.tmp.copy(local).applyMatrix4(this.plate.matrixWorld).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, behind: v.z > 1 };
  }

  nodeVisibility() { return this.nodeMat.uniforms.uShow.value as number; }
  /** how legible the territory constellations currently are, 0..1 */
  constellationVisibility() { return this.constMat.uniforms.uAlpha.value as number; }
  setHover(i: number) { if (this.nodeMat.uniforms.uHover.value !== i) { this.nodeMat.uniforms.uHover.value = i; this.invalidate(); } }
  snap() { for (const k of RIG_KEYS) this.rig[k] = this.target[k]; this.invalidate(); }
}
