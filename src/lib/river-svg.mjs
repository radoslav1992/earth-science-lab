// Drawings for the River Erosion Sandbox, shared by the server render, the browser and the worksheet:
// the stream table seen from above (plan view), the side view along the channel (long profile) and the
// Hjulström diagram. All return SVG markup; classes are styled in src/components/river/river.css.
import {
  TRAY, XS, NODES, SHORE_NODE, CHANNEL_WIDTH, SPREAD, SIDE_CUT, SIDE_FILL, GRAINS, SIZE_CLASSES, SIZE_RANGE, SPEED_AXIS, ZONE_NAMES,
  erosionSpeed, settlingSpeed, zoneAt, grainById, snapshotAt, measure, activity, normalDepth, fmt, fmtSpeed, fmtDepth, fmtThreshold,
} from './river.mjs';

const r1 = v => Math.round(v * 10) / 10;
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pts = list => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
const poly = (cls, list, extra = '') => `<polygon class="${cls}" points="${pts(list)}"${extra}/>`;
function mix(a, b, t) {
  const p = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
  const [x, y] = [p(a), p(b)], f = clamp(t, 0, 1);
  return '#' + x.map((v, k) => Math.round(v + (y[k] - v) * f).toString(16).padStart(2, '0')).join('');
}
const SAND = '#e6d2a6', SHALLOW = '#c4e1e2', DEEP = '#6aa6b4', WATER = '#3d8fb8';
const waterAt = depth => mix(SHALLOW, DEEP, depth / TRAY.seaDepth);

// ---------- Plan view: the tray from above ----------
// 4 px per cm. The channel's path is drawn with three bends; the model works along the tray's length.
export const PLAN = { width: 860, height: 318, ox: 40, oy: 26, px: 4 };
const AMP = 9; // cm, how far the bends swing from the middle of the tray
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** The channel's middle line across the tray (cm from the top edge) at distance x down the tray. */
export const centerY = x => TRAY.width / 2 + AMP * Math.sin((2 * Math.PI * (x - 10)) / 80) * smoothstep(0, 18, x) * (1 - smoothstep(118, TRAY.shore, x));
const PX = (x, y) => [PLAN.ox + x * PLAN.px, PLAN.oy + y * PLAN.px];
function frame(x) {
  const y = centerY(x), dy = centerY(x + 0.5) - centerY(x - 0.5), len = Math.hypot(1, dy);
  return { x, y, nx: -dy / len, ny: 1 / len };
}
const offset = (f, d) => PX(f.x + f.nx * d, f.y + f.ny * d);
/** The side a bend bulges toward is its outside: +1 when the outside is toward the bottom edge of the tray. */
const outsideSign = x => (Math.sin((2 * Math.PI * (x - 10)) / 80) > 0 ? 1 : -1);

/** The inner markup of the plan view for a run at time t (minutes). */
export function planInner(run, t, { labels = true } = {}) {
  const snap = snapshotAt(run, t), m = measure(run, t), { z0, width } = run;
  const out = [];
  const W = TRAY.width, L = TRAY.length;
  // The sea: shaded by its starting depth, then the tray's rim.
  out.push(`<rect class="rv-land" x="${PLAN.ox}" y="${PLAN.oy}" width="${L * PLAN.px}" height="${W * PLAN.px}" rx="6"/>`);
  for (let i = SHORE_NODE; i < NODES - 1; i++) {
    const [x1, y1] = PX(XS[i], 0), [x2] = PX(XS[i + 1], 0);
    out.push(`<rect x="${r1(x1)}" y="${y1}" width="${r1(x2 - x1 + 0.6)}" height="${W * PLAN.px}" fill="${waterAt(-Math.min(0, (z0[i] + z0[i + 1]) / 2))}"/>`);
  }
  // Delta: the sediment laid down in the sea, as wide as the spreading water. Shallow water over it looks
  // paler; where it has built up to sea level it is new land.
  for (let i = SHORE_NODE; i < NODES - 1; i++) {
    const za = snap.z[i], zb = snap.z[i + 1];
    const dep = Math.max(za - z0[i], zb - z0[i + 1]);
    if (dep < 0.05) continue;
    const z = (za + zb) / 2, hw1 = width[i] / 2, hw2 = width[i + 1] / 2, c = W / 2;
    const fill = z >= 0 ? SAND : mix(waterAt(-z), SAND, 0.35 * clamp(dep / 1.5, 0, 1));
    out.push(poly('rv-delta', [PX(XS[i], c - hw1), PX(XS[i + 1] + 0.3, c - hw2), PX(XS[i + 1] + 0.3, c + hw2), PX(XS[i], c + hw1)], ` fill="${fill}"`));
  }
  if (m.deltaLength > 0 || m.newShore > TRAY.shore) {
    const [sx, sy] = PX(TRAY.shore, 0);
    out.push(`<path class="rv-old-shore" d="M${sx} ${sy}v${W * PLAN.px}"/>`);
  }
  // Valley and new sediment along the channel on land, as wide as the model's cross-sections: sand walls
  // slump, so a cut is wider at the top, and sediment dropped on land spreads wider still.
  const land = [];
  for (let i = 0; i <= SHORE_NODE; i++) land.push({ f: frame(XS[i]), d: snap.z[i] - z0[i] });
  for (let i = 0; i < land.length - 1; i++) {
    const a = land[i], b = land[i + 1], d = (a.d + b.d) / 2;
    if (Math.abs(d) < 0.05) continue;
    const hw = dd => CHANNEL_WIDTH / 2 + (d < 0 ? SIDE_CUT * Math.max(0, -dd) : SIDE_FILL * Math.max(0, dd));
    const quad = [offset(a.f, -hw(a.d)), offset(b.f, -hw(b.d)), offset(b.f, hw(b.d)), offset(a.f, hw(a.d))];
    out.push(d < 0
      ? poly('rv-valley', quad, ` opacity="${r1(clamp(0.25 + 0.12 * -d, 0.25, 0.95) * 100) / 100}"`)
      : poly('rv-fan', quad, ` opacity="${r1(clamp(0.45 + 0.15 * d, 0.45, 1) * 100) / 100}"`));
  }
  // Bends: a point bar grows on the inside while the slow water there drops sediment; the fast water on
  // the outside cuts the bank. (Drawn to show where; the model's totals are worked out along the middle.)
  const bendLabels = [];
  snap.bends.forEach(b => {
    const i = Math.round(b.x / 2), f = frame(b.x), s = outsideSign(b.x);
    const hw = CHANNEL_WIDTH / 2 + SIDE_CUT * Math.max(0, z0[i] - snap.z[i]);
    const bar = clamp(b.barMinutes / 4, 0, 1), bank = clamp(b.bankMinutes / 4, 0, 1);
    if (bar > 0.02) {
      const [cx, cy] = offset(f, -s * (hw + 1.4 * bar));
      out.push(`<ellipse class="rv-bar${b.inside === 'deposit' ? ' active' : ''}" cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1((2 + 4 * bar) * PLAN.px)}" ry="${r1((0.6 + 1.1 * bar) * PLAN.px)}"/>`);
      bendLabels.push({ kind: 'bar', at: offset(f, -s * (hw + 3.5)), s: -s });
    }
    if (bank > 0.02) {
      const arc = [-7, -5, -3, -1, 1, 3, 5, 7].map(dx => { const g = frame(b.x + dx); return offset(g, s * (CHANNEL_WIDTH / 2 + SIDE_CUT * Math.max(0, z0[Math.round((b.x + dx) / 2)] - snap.z[Math.round((b.x + dx) / 2)]) + 0.4)); });
      out.push(`<polyline class="rv-bank${b.outside === 'erode' ? ' active' : ''}" points="${pts(arc)}" stroke-width="${r1(1.5 + 3 * bank)}"/>`);
      bendLabels.push({ kind: 'bank', at: offset(f, s * (hw + 4)), s });
    }
  });
  // The water: the channel on land, across any new land, then fanning out into the sea. It turns muddy when it
  // carries a lot of sediment for its size (fine grains stay up and cloud the water).
  const carried = snap.load[SHORE_NODE] / ((run.settings.flow * 1000) / 60);
  const muddy = clamp(carried / 0.01, 0, 1);
  const water = mix(WATER, run.grain.color, 0.65 * muddy);
  const mouth = Math.max(TRAY.shore, m.newShore);
  const line = [];
  for (let x = 0; x <= mouth; x += 2) line.push(PX(x, centerY(x)));
  out.push(`<polyline class="rv-water" points="${pts(line)}" stroke="${water}" stroke-width="${CHANNEL_WIDTH * PLAN.px}"/>`);
  out.push(`<polyline class="rv-flow" points="${pts(line)}"/>`);
  const plumeEnd = Math.min(L, mouth + 26 + 40 * muddy);
  const half = x => (CHANNEL_WIDTH + SPREAD * (x - TRAY.shore)) / 2;
  const plume = [PX(mouth, W / 2 - half(mouth)), PX(plumeEnd, W / 2 - half(plumeEnd)), PX(plumeEnd, W / 2 + half(plumeEnd)), PX(mouth, W / 2 + half(mouth))];
  out.push(poly('rv-plume', plume, ` fill="${water}" fill-opacity="${r1((0.22 + 0.3 * muddy) * 100) / 100}"`));
  const outRate = snap.load[NODES - 1];
  if (outRate > 0.01) {
    const mud = clamp(outRate / 0.6, 0.15, 0.6);
    out.push(`<rect class="rv-mud" x="${r1(PX(mouth, 0)[0])}" y="${PLAN.oy}" width="${r1((L - mouth) * PLAN.px)}" height="${W * PLAN.px}" fill="${run.grain.color}" fill-opacity="${r1(mud * 100) / 100}"/>`);
  }
  // Inlet hose and drain.
  const [ix, iy] = PX(0, W / 2);
  out.push(`<path class="rv-hose" d="M4 ${r1(iy - 30)}C20 ${r1(iy - 30)} ${ix - 18} ${r1(iy - 8)} ${ix + 2} ${iy}"/>`);
  const [dx, dy] = PX(L - 3, W - 5);
  out.push(`<circle class="rv-drain" cx="${dx}" cy="${dy}" r="7"/><path class="rv-drain-x" d="M${dx - 4} ${dy}h8M${dx} ${dy - 4}v8"/>`);
  out.push(`<rect class="rv-rim" x="${PLAN.ox}" y="${PLAN.oy}" width="${L * PLAN.px}" height="${W * PLAN.px}" rx="6"/>`);
  // Labels and the scale bar.
  if (labels) {
    const lab = [];
    const label = (x, y, text, cls = '', anchor = 'middle') => lab.push(`<text class="rv-label${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${esc(text)}</text>`);
    label(ix - 2, iy - 38, 'Water in', ' small', 'start');
    label(PX(TRAY.shore + 30, 0)[0], PX(0, 6)[1], 'Sea');
    label(PX(L, 0)[0] - 4, PX(0, W - 1.5)[1], 'Drain', ' small', 'end');
    if (m.deltaLength > 0) label(PX(TRAY.shore + m.deltaLength / 2 + 2, 0)[0], PX(0, W / 2 + half(TRAY.shore + m.deltaLength / 2) + 5)[1], 'Delta', ' wide');
    const firstBar = bendLabels.find(b => b.kind === 'bar'), firstBank = bendLabels.find(b => b.kind === 'bank');
    if (firstBar) label(firstBar.at[0], firstBar.at[1] + (firstBar.s > 0 ? 14 : -4), 'Point bar', ' small wide');
    if (firstBank) label(firstBank.at[0], firstBank.at[1] + (firstBank.s > 0 ? 14 : -4), 'Cut bank', ' small wide');
    out.push(`<g class="rv-labels">${lab.join('')}</g>`);
  }
  const sy = PLAN.oy + W * PLAN.px + 16;
  out.push(`<g class="rv-scale"><rect x="${PLAN.ox}" y="${sy}" width="${25 * PLAN.px}" height="6"/><rect class="alt" x="${PLAN.ox + 25 * PLAN.px}" y="${sy}" width="${25 * PLAN.px}" height="6"/><text x="${PLAN.ox}" y="${sy + 20}">0</text><text x="${PLAN.ox + 50 * PLAN.px}" y="${sy + 20}" text-anchor="middle">50 cm</text></g>`);
  return out.join('');
}

export function describePlan(run, t) {
  const m = measure(run, t), g = run.grain.name.toLowerCase();
  const parts = [`Stream table from above after ${fmt(m.t)} minutes: water enters at the left and flows through three bends to the sea on the right.`];
  if (m.eroded >= 0.5) parts.push(`The channel has cut a valley up to ${fmtDepth(m.deepestCut)} cm deep.`);
  if (m.landDeposit >= 0.5) parts.push(`New ${g} lies along the channel.`);
  const snap = snapshotAt(run, t);
  if (snap.bends.some(b => b.barMinutes > 0.1)) parts.push('Point bars have formed on the inside of bends.');
  if (m.deltaLength > 0) parts.push(`A delta reaches ${m.deltaLength} cm into the sea.`);
  if (snap.load[NODES - 1] > 0.01) parts.push(`Muddy water carries ${g} out to the drain.`);
  return parts.join(' ');
}

// ---------- Side view: the long profile down the channel ----------
// 4 px per cm along the tray and 8 px per cm up and down, so heights are stretched ×2.
export const PROFILE = { width: 860, height: 280, ox: 40, px: 4, top: 14, zTop: 20, zBottom: -7, pz: 8 };
// Heights above the frame (a big pile of sediment at the inlet) are drawn at its top edge.
const PZ = z => PROFILE.top + (PROFILE.zTop - Math.min(z, PROFILE.zTop + 1)) * PROFILE.pz;
const PXP = x => PROFILE.ox + x * PROFILE.px;

export function profileInner(run, t, { labels = true } = {}) {
  const snap = snapshotAt(run, t), m = measure(run, t), { z0, floor } = run;
  const out = [], n = NODES;
  const yBottom = PZ(PROFILE.zBottom);
  out.push(`<rect class="rv-air" x="${PROFILE.ox}" y="${PROFILE.top}" width="${TRAY.length * PROFILE.px}" height="${r1(yBottom - PROFILE.top)}"/>`);
  // Sea water over the bed, up to sea level.
  const seaFrom = Math.max(0, SHORE_NODE - 25);
  const sea = [];
  for (let i = seaFrom; i < n; i++) sea.push([PXP(XS[i]), PZ(0)]);
  for (let i = n - 1; i >= seaFrom; i--) sea.push([PXP(XS[i]), PZ(Math.min(0, snap.z[i]))]);
  out.push(poly('rv-sea', sea));
  // Sediment between the tray's bottom and the bed, then what was cut away and what was laid down.
  const bed = Array.from(snap.z, (z, i) => [PXP(XS[i]), PZ(z)]);
  const bottom = floor.map((z, i) => [PXP(XS[i]), PZ(z)]).reverse();
  out.push(poly('rv-sediment', [...bed, ...bottom]));
  const cut = [...z0.map((z, i) => [PXP(XS[i]), PZ(z)]), ...z0.map((z, i) => [PXP(XS[i]), PZ(Math.min(z, snap.z[i]))]).reverse()];
  const laid = [...z0.map((z, i) => [PXP(XS[i]), PZ(Math.max(z, snap.z[i]))]), ...z0.map((z, i) => [PXP(XS[i]), PZ(z)]).reverse()];
  out.push(poly('rv-cut', cut), poly('rv-laid', laid));
  out.push(`<polyline class="rv-start" points="${pts(z0.map((z, i) => [PXP(XS[i]), PZ(z)]))}"/>`);
  // The river's water on land (its depth comes from the model, drawn at the same stretch).
  // Drawn from the slope averaged over 12 cm, and never rising downstream (water fills any hollow).
  let last = 0;
  while (last < n - 2 && snap.z[last + 1] >= 0) last++;
  const q = (run.settings.flow * 1000) / 60, surface = [];
  for (let i = 0; i <= last; i++) {
    const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3);
    const s = Math.max(0.002, (snap.z[a] - snap.z[b]) / (XS[b] - XS[a]));
    surface[i] = snap.z[i] + normalDepth(q, CHANNEL_WIDTH, s);
  }
  for (let i = last - 1; i >= 0; i--) surface[i] = Math.max(surface[i], surface[i + 1]);
  if (last > 0) {
    const river = surface.map((w, i) => [PXP(XS[i]), PZ(w)]);
    const riverBed = surface.map((w, i) => [PXP(XS[i]), PZ(snap.z[i])]).reverse();
    out.push(poly('rv-river', [...river, ...riverBed]));
  }
  out.push(`<polyline class="rv-bed" points="${pts(bed)}"/>`);
  out.push(`<path class="rv-tray" d="M${PXP(0)} ${r1(PZ(z0[0] + 4))}V${r1(PZ(floor[0]))}L${pts(floor.map((z, i) => [PXP(XS[i]), PZ(z)])).split(' ').join('L')}V${r1(PZ(1.5))}"/>`);
  // Where the bed is being cut down (red) or built up (gold) right now.
  const rate = activity(run, t), stripY = yBottom + 6;
  out.push(`<g class="rv-strip">`);
  for (let i = 0; i < n - 1; i++) {
    const v = (rate[i] + rate[i + 1]) / 2;
    if (Math.abs(v) < 0.004) continue;
    out.push(`<rect class="${v < 0 ? 'rv-cutting' : 'rv-building'}" x="${r1(PXP(XS[i]))}" y="${r1(stripY)}" width="${r1(2 * PROFILE.px + 0.4)}" height="8" fill-opacity="${r1(clamp(Math.abs(v) / 0.3, 0.25, 1) * 100) / 100}"/>`);
  }
  out.push(`</g>`);
  // Axes.
  const ax = [];
  for (let z = -5; z <= 20; z += 5) ax.push(`<path class="rv-tick" d="M${PROFILE.ox - 6} ${PZ(z)}H${PROFILE.ox}"/><text class="rv-axis" x="${PROFILE.ox - 9}" y="${PZ(z) + 4}" text-anchor="end">${z}</text>`);
  for (let x = 0; x <= TRAY.length; x += 50) ax.push(`<text class="rv-axis" x="${PXP(x)}" y="${r1(stripY + 28)}" text-anchor="${x === 0 ? 'start' : x === TRAY.length ? 'end' : 'middle'}">${x}${x === TRAY.length ? ' cm' : ''}</text>`);
  out.push(`<rect class="rv-axis-bg" x="0" y="0" width="${PROFILE.ox - 1}" height="${PROFILE.height}"/>`, ax.join(''));
  out.push(`<text class="rv-axis rv-axis-title" x="4" y="${PROFILE.top + 10}">cm</text>`);
  if (labels) {
    const lab = [];
    const label = (x, y, text, cls = '', anchor = 'middle') => lab.push(`<text class="rv-label${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${esc(text)}</text>`);
    label(PXP(2), PZ(Math.max(z0[0], snap.z[0])) - 10, 'Water in', ' small', 'start');
    label(PXP(185), PZ(0) - 6, 'Sea level', ' small');
    label(PXP(TRAY.shore) - 8, PZ(0) + 18, 'Old shoreline', ' small minor', 'end');
    out.push(`<path class="rv-shore-tick" d="M${PXP(TRAY.shore)} ${r1(PZ(0) - 2)}v12"/>`);
    if (m.deepestCut >= 0.3) {
      const x = PXP(m.cutAt) + 12, y1 = PZ(z0[Math.round(m.cutAt / 2)]), y2 = PZ(snap.z[Math.round(m.cutAt / 2)]);
      lab.push(`<path class="rv-measure" d="M${r1(x)} ${r1(y1)}V${r1(y2)}M${r1(x - 4)} ${r1(y1)}h8M${r1(x - 4)} ${r1(y2)}h8"/>`);
      label(x + 8, (y1 + y2) / 2 + 4, `Cut ${fmtDepth(m.deepestCut)} cm`, ' small', 'start');
    }
    if (m.deltaLength > 0) label(PXP(TRAY.shore) + 8, PZ(-3.6), `Delta ${m.deltaLength} cm`, ' small', 'start');
    out.push(`<g class="rv-labels">${lab.join('')}</g>`);
  }
  return out.join('');
}

export function describeProfile(run, t) {
  const m = measure(run, t);
  const parts = [`Side view along the channel after ${fmt(m.t)} minutes, heights stretched two times. The dashed line is the starting surface.`];
  parts.push(m.eroded >= 0.5 ? `The bed has been cut down up to ${fmtDepth(m.deepestCut)} cm.` : 'The bed has not been cut down.');
  if (m.buildUp >= 0.3) parts.push(`On land, new sediment has built the bed up as much as ${fmtDepth(m.buildUp)} cm.`);
  if (m.deltaLength > 0) parts.push(`Under the sea, a delta reaches ${m.deltaLength} cm past the old shoreline.`);
  return parts.join(' ');
}

// ---------- The Hjulström diagram ----------
// Log–log axes: grain size 0.001–100 mm across, water speed 0.1–1000 cm/s up.
export const HJ = { width: 560, height: 430, left: 70, right: 544, top: 58, bottom: 360 };
const lx = mm => HJ.left + ((Math.log10(mm) - Math.log10(SIZE_RANGE[0])) / (Math.log10(SIZE_RANGE[1]) - Math.log10(SIZE_RANGE[0]))) * (HJ.right - HJ.left);
const ly = v => HJ.top + ((Math.log10(SPEED_AXIS[1]) - Math.log10(v)) / (Math.log10(SPEED_AXIS[1]) - Math.log10(SPEED_AXIS[0]))) * (HJ.bottom - HJ.top);
/** Diagram point (SVG units) to grain size (mm) and speed (cm/s), for pointing at the diagram. */
export function hjAt(x, y) {
  const fx = clamp((x - HJ.left) / (HJ.right - HJ.left), 0, 1), fy = clamp((y - HJ.top) / (HJ.bottom - HJ.top), 0, 1);
  const mm = 10 ** (Math.log10(SIZE_RANGE[0]) + fx * (Math.log10(SIZE_RANGE[1]) - Math.log10(SIZE_RANGE[0])));
  const v = 10 ** (Math.log10(SPEED_AXIS[1]) - fy * (Math.log10(SPEED_AXIS[1]) - Math.log10(SPEED_AXIS[0])));
  return { mm, v };
}
export const hjPoint = (mm, v) => ({ x: lx(mm), y: ly(clamp(v, SPEED_AXIS[0], SPEED_AXIS[1])) });
const BAND = 1.35; // the erosion band drawn around the model's curve, a reminder that real thresholds vary

let staticCache = null;
function hjStatic() {
  if (staticCache) return staticCache;
  const out = [];
  const sizes = [];
  for (let k = 0; k <= 250; k++) sizes.push(10 ** (-3 + (5 * k) / 250));
  const topV = SPEED_AXIS[1], botV = SPEED_AXIS[0];
  const erosion = sizes.map(mm => [lx(mm), ly(clamp(erosionSpeed(mm), botV, topV))]);
  const settling = sizes.filter(mm => settlingSpeed(mm) >= botV).map(mm => [lx(mm), ly(clamp(settlingSpeed(mm), botV, topV))]);
  const firstSettle = settling[0];
  // Zones.
  out.push(poly('hj-zone hj-transport', [[HJ.left, HJ.top], [HJ.right, HJ.top], [HJ.right, HJ.bottom], [HJ.left, HJ.bottom]]));
  out.push(poly('hj-zone hj-erode', [[HJ.left, HJ.top], [HJ.right, HJ.top], ...erosion.slice().reverse()]));
  out.push(poly('hj-zone hj-deposit', [[firstSettle[0], HJ.bottom], ...settling, [HJ.right, HJ.bottom]]));
  // Grain-size classes across the top.
  for (const c of SIZE_CLASSES) {
    const x1 = lx(c.min), x2 = lx(Math.min(c.max, SIZE_RANGE[1]));
    out.push(`<rect class="hj-class hj-class-${c.name.toLowerCase()}" x="${r1(x1)}" y="${HJ.top - 26}" width="${r1(x2 - x1)}" height="22"/><text class="hj-class-name" x="${r1((x1 + x2) / 2)}" y="${HJ.top - 10}" text-anchor="middle">${c.name}</text>`);
  }
  // Grid and axes.
  for (let e = -3; e <= 2; e++) {
    const x = lx(10 ** e);
    out.push(`<path class="hj-grid" d="M${r1(x)} ${HJ.top}V${HJ.bottom}"/><text class="hj-axis" x="${r1(x)}" y="${HJ.bottom + 18}" text-anchor="middle">${String(10 ** e).replace(/^0\./, '0.')}</text>`);
  }
  for (let e = -1; e <= 3; e++) {
    const y = ly(10 ** e);
    out.push(`<path class="hj-grid" d="M${HJ.left} ${r1(y)}H${HJ.right}"/><text class="hj-axis" x="${HJ.left - 8}" y="${r1(y + 4)}" text-anchor="end">${10 ** e}</text>`);
  }
  out.push(`<text class="hj-axis-title" x="${(HJ.left + HJ.right) / 2}" y="${HJ.bottom + 40}" text-anchor="middle">Grain size (mm)</text>`);
  out.push(`<text class="hj-axis-title" transform="translate(18 ${(HJ.top + HJ.bottom) / 2}) rotate(-90)" text-anchor="middle">Water speed (cm/s)</text>`);
  // Curves: a band around the erosion curve (thresholds really vary), the curve itself, and the settling curve.
  const bandUp = sizes.map(mm => [lx(mm), ly(clamp(erosionSpeed(mm) * BAND, botV, topV))]);
  const bandDown = sizes.map(mm => [lx(mm), ly(clamp(erosionSpeed(mm) / BAND, botV, topV))]).reverse();
  out.push(poly('hj-band', [...bandUp, ...bandDown]));
  out.push(`<polyline class="hj-erosion" points="${pts(erosion)}"/>`, `<polyline class="hj-settling" points="${pts(settling)}"/>`);
  out.push(`<rect class="hj-frame" x="${HJ.left}" y="${HJ.top}" width="${HJ.right - HJ.left}" height="${HJ.bottom - HJ.top}"/>`);
  // Zone names.
  out.push(`<text class="hj-zone-name" x="${r1(lx(0.6))}" y="${r1(ly(260))}" text-anchor="middle">Erosion</text>`);
  out.push(`<text class="hj-zone-name" x="${r1(lx(0.05))}" y="${r1(ly(3.2))}" text-anchor="middle">Transport</text>`);
  out.push(`<text class="hj-zone-name" x="${r1(lx(8))}" y="${r1(ly(0.45))}" text-anchor="middle">Deposition</text>`);
  out.push(`<text class="hj-curve-name" x="${r1(lx(0.0012))}" y="${r1(ly(erosionSpeed(0.0012)) - 12)}">picked up above this line</text>`);
  out.push(`<text class="hj-curve-name settle" x="${r1(lx(0.11))}" y="${r1(ly(0.2))}">settle out below this line</text>`);
  staticCache = out.join('');
  return staticCache;
}

/** The current water speed across the diagram, and where each sediment in the sandbox sits at that speed. */
export function hjSpeedLayer(speed, selected, { neutral = false } = {}) {
  const v = clamp(speed, SPEED_AXIS[0], SPEED_AXIS[1]), y = r1(ly(v)), out = [];
  out.push(`<path class="hj-speed" d="M${HJ.left} ${y}H${HJ.right}"/>`);
  for (const g of GRAINS) {
    if (neutral && g.id !== selected) continue;
    const x = r1(lx(g.mm)), zone = neutral ? 'neutral' : zoneAt(g.mm, v), on = g.id === selected;
    out.push(`<path class="hj-guide${on ? ' on' : ''}" d="M${x} ${HJ.top}V${HJ.bottom}"/>`);
    out.push(`<circle class="hj-dot hj-dot-${zone}${on ? ' on' : ''}" cx="${x}" cy="${y}" r="${on ? 8 : 5.5}"/>`);
  }
  out.push(`<text class="hj-speed-label" x="${HJ.right - 6}" y="${r1(y - 8)}" text-anchor="end">${fmtSpeed(v)} cm/s</text>`);
  return out.join('');
}

/** A probe point someone is pointing at. */
export function hjProbeLayer(probe) {
  if (!probe) return '';
  const { x, y } = hjPoint(probe.mm, probe.v), zone = zoneAt(probe.mm, probe.v);
  const text = `${fmtSize(probe.mm)} at ${fmtSpeedPrecise(probe.v)} cm/s: ${ZONE_NAMES[zone].toLowerCase()}`;
  const right = x < HJ.left + (HJ.right - HJ.left) * 0.55, below = y < HJ.top + 40;
  const tx = right ? x + 12 : x - 12, ty = below ? y + 24 : y - 12;
  return `<g class="hj-probe"><path d="M${r1(x)} ${HJ.top}V${HJ.bottom}M${HJ.left} ${r1(y)}H${HJ.right}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="6"/><text x="${r1(tx)}" y="${r1(ty)}" text-anchor="${right ? 'start' : 'end'}">${esc(text)}</text></g>`;
}
export const fmtSize = mm => `${mm >= 10 ? Math.round(mm) : mm >= 1 ? fmt(mm, 1) : String(Number(mm.toPrecision(2)))} mm`;
export const fmtSpeedPrecise = v => (v >= 10 ? String(Math.round(v)) : v >= 1 ? fmt(v, 1) : String(Number(v.toPrecision(2))));

/** The whole diagram as an SVG element. */
export function hjulstromSvg({ speed, grain = 'fine-sand', probe = null, neutral = false, label, className = '', attrs = '' } = {}) {
  const aria = label ?? describeHjulstrom(speed, grain);
  return `<svg class="hj ${className}" viewBox="0 0 ${HJ.width} ${HJ.height}" role="img" aria-label="${esc(aria)}"${attrs}>${hjStatic()}<g data-layer="speed">${speed ? hjSpeedLayer(speed, grain, { neutral }) : ''}</g><g data-layer="probe">${hjProbeLayer(probe)}</g></svg>`;
}

export function describeHjulstrom(speed, grain) {
  const base = 'Hjulström diagram: water speed against grain size, on log scales. Sand is the easiest sediment to pick up, at about 20 cm/s; finer silt and clay need faster water because they stick together, and gravel needs faster water because it is heavy. Moving grains settle out only when the water is slower than the lower curve.';
  if (!speed) return base;
  const at = GRAINS.map(g => `${g.name.toLowerCase()} ${ZONE_NAMES[zoneAt(g.mm, speed)].toLowerCase()}`).join(', ');
  return `${base} At ${fmtSpeed(speed)} cm/s: ${at}.`;
}

/** One sentence per sediment: what happens to it at speed v (for the panel beside the diagram). */
export function grainRows(v) {
  return GRAINS.map(g => {
    const zone = zoneAt(g.mm, v);
    return { id: g.id, name: g.name, mm: g.mm, zone, text: `${ZONE_NAMES[zone]}. Picked up above about ${fmtThreshold(erosionSpeed(g.mm))} cm/s; settles below about ${fmtThreshold(settlingSpeed(g.mm))} cm/s.` };
  });
}
