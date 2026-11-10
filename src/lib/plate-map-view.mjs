// Drawing and markup for the Plate Boundaries Map, shared by the server and the browser.
// The map is a plain latitude–longitude grid (an equirectangular projection): x is longitude and y is
// latitude, both times K. That keeps the shapes familiar and lets a close-up cross the 180° line simply
// by drawing the land a second time, one world-width to the east.
import { LAND } from './plate-map-land.mjs';
import {
  WORLD, PLATES, BOUNDARIES, QUAKES, VOLCANOES, TYPES, TYPE_LABELS, TYPE_MOTION, QUAKE_NEAR_KM, VOLCANO_NEAR_KM,
  boundaryType, splitAtDateLine, describeBoundary, describePlate, describeFeature, evidence, inView,
} from './plate-map.mjs';

/** Drawing units per degree. */
export const K = 3;
export const WORLD_WIDTH = 360 * K;
export const VIEW = { x: WORLD.west * K, y: -WORLD.north * K, width: WORLD_WIDTH, height: (WORLD.north - WORLD.south) * K };
/** Marker and label sizes are in screen pixels; this is the scale used before the script measures the map. */
export const DEFAULT_SCALE = 1.45;
const round = v => Math.round(v * 10) / 10;
export const mapX = lon => round(lon * K);
export const mapY = lat => round(-lat * K);
const line = pts => `M${pts.map(([lon, lat]) => `${mapX(lon)} ${mapY(lat)}`).join('L')}`;

/** The land outlines as one path. */
export const landPath = () => LAND.map(ring => `${line(ring)}Z`).join('');

/** The view box for a region: its bounds, widened or heightened to the given width ÷ height shape. */
export function viewBoxFor(region, aspect = VIEW.width / VIEW.height) {
  const [w, e, s, n] = region.bounds;
  let width = (e - w) * K, height = (n - s) * K;
  const cx = ((w + e) / 2) * K, cy = (-(n + s) / 2) * K;
  if (width / height < aspect) width = height * aspect; else height = width / aspect;
  return { x: round(cx - width / 2), y: round(cy - height / 2), width: round(width), height: round(height) };
}
/** The shape (width ÷ height) to draw a region in: its own shape, kept between a minimum and the world's. */
export function aspectFor(region, minAspect) {
  const [w, e, s, n] = region.bounds;
  return Math.min(VIEW.width / VIEW.height, Math.max(minAspect, (e - w) / (n - s)));
}
/** Where to draw a longitude so that it falls inside a view that starts at `west` degrees. */
export const lonInView = (lon, west) => (lon < west ? lon + 360 : lon);

/** Every spot where a plate's name can be drawn: the world-map labels first, then the spare ones for close-ups. */
export const plateLabels = plate => [plate.label, plate.label2].filter(Boolean).map(at => ({ at, alt: false })).concat((plate.alt ?? []).map(at => ({ at, alt: true })));
const quakeRadius = m => (m >= 8.5 ? 5.6 : m >= 7.5 ? 4.4 : 3.4);
const shortName = plate => plate.name.replace(/ Plate$/, '');

/**
 * The inner SVG of the map. `prefix` keeps the land's id unique; `markers: false` leaves out the
 * earthquake, volcano and name layers (for the thumbnail on the Labs page). Each boundary piece carries
 * `data-east`, its easternmost longitude, so the script can move it a whole turn east when a close-up
 * starts east of it.
 */
export function mapSvg({ prefix = 'pm', markers = true, scale = DEFAULT_SCALE } = {}) {
  const x0 = VIEW.x, span = WORLD_WIDTH * 2;
  let grid = '';
  for (let lon = -180; lon <= 540; lon += 30) grid += `M${mapX(lon)} ${VIEW.y}v${VIEW.height}`;
  for (let lat = -60; lat <= 60; lat += 30) if (lat) grid += `M${x0} ${mapY(lat)}h${span}`;
  const lines = BOUNDARIES.flatMap(b => splitAtDateLine(b.pts).map(pts => ({ b, d: line(pts), east: Math.max(...pts.map(p => p[0])) })));
  // Wide boundary zones first, so that the sharp boundaries are drawn over them.
  const order = ['zone', 'transform', 'divergent', 'convergent'];
  const visible = [...lines].sort((p, q) => order.indexOf(boundaryType(p.b)) - order.indexOf(boundaryType(q.b)))
    .map(({ b, d, east }) => `<path class="pm-b pm-${boundaryType(b)}" data-b="${b.id}" data-east="${east}" d="${d}"/>`).join('');
  const hits = !markers ? '' : lines.map(({ b, d, east }) => `<path class="pm-hit pm-${boundaryType(b)}" data-b="${b.id}" data-east="${east}" d="${d}"/>`).join('');
  const at = (lon, lat) => `data-lon="${lon}" data-lat="${lat}" transform="translate(${mapX(lon)} ${mapY(lat)}) scale(${scale})"`;
  // Each plate's name: on the world map, and at spare spots (`data-alt`) that only close-ups use.
  const names = !markers ? '' : PLATES.flatMap(p => plateLabels(p).map(({ at: [lon, lat], alt }) =>
    `<text class="pm-name${p.small ? ' pm-name-small' : ''}" data-plate="${p.id}"${alt ? ' data-alt' : ''} ${at(lon, lat)} text-anchor="middle">${shortName(p)}</text>`)).join('');
  const quakes = !markers ? '' : QUAKES.map(q => `<g class="pm-q" data-f="${q.id}" ${at(q.lon, q.lat)}><circle class="pm-touch" r="11"/><circle class="pm-dot" r="${quakeRadius(q.magnitude)}"/></g>`).join('');
  const volcanoes = !markers ? '' : VOLCANOES.map(v => `<g class="pm-v${v.hotspot ? ' pm-hotspot' : ''}" data-f="${v.id}" ${at(v.lon, v.lat)}><circle class="pm-touch" r="11"/><path class="pm-tri" d="M0 -5.6L5.2 4H-5.2Z"/></g>`).join('');
  return `<defs><path id="${prefix}-land" class="pm-land" d="${landPath()}"/></defs>`
    + `<rect class="pm-ocean" x="${x0}" y="${VIEW.y}" width="${span}" height="${VIEW.height}"/><path class="pm-grid" d="${grid}"/>`
    + `<path class="pm-equator" d="M${x0} 0h${span}"/>`
    + `<use href="#${prefix}-land" x="${-WORLD_WIDTH}"/><use href="#${prefix}-land"/><use href="#${prefix}-land" x="${WORLD_WIDTH}"/>`
    + `<g class="pm-lines">${visible}</g><g class="pm-halo" data-halo></g><g class="pm-hits">${hits}</g>`
    + `<g class="pm-names">${names}</g><g class="pm-quakes">${quakes}</g><g class="pm-volcanoes">${volcanoes}</g><g class="pm-ring" data-ring></g>`;
}

/** The map in words, for screen readers. */
export function describeMap() {
  const e = evidence();
  const count = type => BOUNDARIES.filter(b => boundaryType(b) === type).length;
  return `World map of ${PLATES.length} tectonic plates and the boundaries between them: ${count('divergent')} divergent, ${count('convergent')} convergent and ${count('transform')} transform boundary lines. `
    + `Trenches ring the Pacific Ocean, ridges run down the middle of the Atlantic and around Antarctica, and a collision zone crosses Asia from the Mediterranean to the Himalaya. `
    + `${e.quakes.near} of ${e.quakes.total} earthquake examples and ${e.volcanoes.near} of ${e.volcanoes.total} volcano examples lie along plate boundaries. Use the lists below the map to read about each one.`;
}

// ---------- Markup ----------
const km = n => n.toLocaleString('en-US');
const dot = type => `<span class="pm-key pm-key-${type}" aria-hidden="true"></span>`;
/** What a region shows, with the count of examples that line up with the boundaries. */
export function regionHtml(region) {
  const e = evidence();
  const quakes = e.quakes.near === e.quakes.total ? `All ${e.quakes.total} earthquake examples lie` : `${e.quakes.near} of the ${e.quakes.total} earthquake examples lie`;
  const lines = region.id !== 'world' ? '' : `<p class="pm-evidence"><strong>What the examples show.</strong> ${quakes} within ${km(QUAKE_NEAR_KM)} km of a plate boundary. `
    + `${e.volcanoes.near} of the ${e.volcanoes.total} volcano examples lie within ${km(VOLCANO_NEAR_KM)} km of a boundary where plates move apart or together, and none belongs to a transform boundary. The other ${e.volcanoes.away.length} are hotspot volcanoes, such as ${e.volcanoes.away[0].name} in Hawaii.</p>`;
  return `<h3>${region.name}</h3><p>${region.text}</p>${lines}`;
}
/** Details of one boundary. */
export function boundaryHtml(b) {
  const d = describeBoundary(b);
  return `<h3>${d.title}</h3><p class="pm-type">${dot(d.type)}<strong>${d.typeLabel}</strong></p><p>${d.plates} ${d.text}</p>`
    + (d.href ? `<p><a class="pm-cross" href="${d.href}">See this kind of boundary in cross-section: ${d.link} →</a></p>` : '');
}
/** Details of one plate. */
export function plateHtml(plate) {
  const d = describePlate(plate);
  return `<h3>${d.title}</h3><p>${d.text}</p><p>${d.neighbors} ${d.boundaries}</p>`;
}
/** Details of one earthquake or volcano example. */
export function featureHtml(f) {
  const d = describeFeature(f);
  return `<h3>${d.title}</h3><p class="pm-type"><strong>${d.fact}</strong></p><p>${d.where} ${d.text}</p>`;
}
/** Everything in a region as buttons, so that every feature can be reached without a mouse. */
export function listHtml(region, layers, { disabled = false } = {}) {
  const view = inView(region);
  const off = disabled ? ' disabled' : '';
  const group = (title, items) => (items.length ? `<div class="pm-list-group"><h4>${title} (${items.length})</h4><div class="pm-list-items">${items.join('')}</div></div>` : '');
  const boundaries = view.boundaries.filter(b => boundaryType(b) === 'zone' || layers.includes(boundaryType(b)))
    .map(b => `<button type="button" class="pm-item" data-pick-b="${b.id}"${off}>${dot(boundaryType(b))}${b.name}</button>`);
  const quakes = !layers.includes('quakes') ? [] : [...view.quakes].sort((a, b) => b.magnitude - a.magnitude)
    .map(q => `<button type="button" class="pm-item" data-pick-f="${q.id}"${off}>${q.name}, ${q.year} <span class="pm-item-more">M${q.magnitude.toFixed(1)}</span></button>`);
  const volcanoes = !layers.includes('volcanoes') ? [] : view.volcanoes
    .map(v => `<button type="button" class="pm-item" data-pick-f="${v.id}"${off}>${v.name} <span class="pm-item-more">${v.place}${v.hotspot ? ', hotspot' : ''}</span></button>`);
  const plates = !layers.includes('names') ? [] : PLATES.filter(p => plateLabels(p).some(({ at: [lon, lat] }) => {
    const [w, e, s, n] = region.bounds;
    return lat >= s && lat <= n && ((lon >= w && lon <= e) || (lon + 360 >= w && lon + 360 <= e));
  })).map(p => `<button type="button" class="pm-item" data-pick-p="${p.id}"${off}>${p.name}</button>`);
  return group('Boundaries in this view', boundaries) + group('Earthquake examples', quakes) + group('Volcano examples', volcanoes) + group('Plates named in this view', plates);
}
/** The legend: one line sample for each boundary type, then the markers. */
export function legendHtml() {
  return TYPES.map(type => `<li>${dot(type)}<span><strong>${TYPE_LABELS[type]}</strong>${type === 'zone' ? '' : `: ${TYPE_MOTION[type]}`}</span></li>`).join('')
    + '<li><span class="pm-key pm-key-quake" aria-hidden="true"></span><span><strong>Earthquake</strong>: larger dot, larger magnitude</span></li>'
    + '<li><span class="pm-key pm-key-volcano" aria-hidden="true"></span><span><strong>Volcano</strong>: hollow for a hotspot</span></li>';
}
