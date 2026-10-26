// Colors for the landscape view: a hypsometric tint (color by height) multiplied by hillshade
// (light from the north-west), with water below sea level. Pure functions on a heightmap, so the
// browser canvas, the server-rendered fallback and the tests all use the same numbers.

// [elevation m, [r, g, b]]: lowland green through tan and brown to pale summits.
/** @type {[number, number[]][]} */
export const RAMP = [
  [0, [118, 165, 110]],
  [150, [166, 190, 121]],
  [300, [216, 205, 142]],
  [450, [203, 163, 111]],
  [600, [164, 121, 86]],
  [750, [190, 170, 156]],
  [900, [238, 233, 226]],
];
export const WATER_SHALLOW = [150, 199, 205];
export const WATER_DEEP = [46, 106, 124];

export function rampColor(h) {
  if (h <= RAMP[0][0]) return RAMP[0][1];
  for (let k = 1; k < RAMP.length; k++) {
    const [h1, c1] = RAMP[k];
    if (h <= h1) {
      const [h0, c0] = RAMP[k - 1], f = (h - h0) / (h1 - h0);
      return [0, 1, 2].map(n => c0[n] + (c1[n] - c0[n]) * f);
    }
  }
  return RAMP[RAMP.length - 1][1];
}

export function waterColor(depth) {
  const f = Math.min(1, Math.max(0, depth / 160));
  return [0, 1, 2].map(n => WATER_SHALLOW[n] + (WATER_DEEP[n] - WATER_SHALLOW[n]) * f);
}

export const rgb = c => `rgb(${c.map(v => Math.round(v)).join(' ')})`;

/**
 * Hillshade brightness at every node: 1 on flat ground, above 1 on slopes facing the light (north-west),
 * below 1 facing away. `lift` exaggerates the relief so gentle slopes still read.
 */
export function hillshade(t, lift = 4) {
  const { nx, ny, cell, h } = t, out = new Float32Array(nx * ny);
  const lx = -1, ly = -1, lz = 1.2, ll = Math.hypot(lx, ly, lz), flat = lz / ll;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(ny - 1, j + 1);
      const gx = ((h[j * nx + i1] - h[j * nx + i0]) / ((i1 - i0) * cell)) * lift;
      const gy = ((h[j1 * nx + i] - h[j0 * nx + i]) / ((j1 - j0) * cell)) * lift;
      const dot = (-gx * lx - gy * ly + lz) / (Math.hypot(gx, gy, 1) * ll);
      out[j * nx + i] = Math.max(0, dot) / flat;
    }
  }
  return out;
}

/** Shade factor applied to a color: flat ground keeps its color, lit slopes brighten, shaded ones darken. */
export const shadeFactor = s => 0.6 + 0.4 * Math.min(1.8, s);

/** RGBA pixels of the shaded-relief view, `width` × `height`, covering the whole map. */
export function reliefPixels(t, { width, height, seaLevel = 0, shade = hillshade(t) }) {
  const { nx, ny, h } = t, data = new Uint8ClampedArray(width * height * 4);
  const lut = new Uint8ClampedArray(1201 * 3);
  for (let m = 0; m <= 1200; m++) lut.set(rampColor(m - 200).map(Math.round), m * 3);
  for (let py = 0; py < height; py++) {
    const fy = Math.min(ny - 1.0001, ((py + 0.5) / height) * (ny - 1)), j = Math.floor(fy), v = fy - j;
    for (let px = 0; px < width; px++) {
      const fx = Math.min(nx - 1.0001, ((px + 0.5) / width) * (nx - 1)), i = Math.floor(fx), u = fx - i, k = j * nx + i;
      const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
      const z = h[k] * w00 + h[k + 1] * w10 + h[k + nx] * w01 + h[k + nx + 1] * w11;
      const o = (py * width + px) * 4;
      if (z < seaLevel) {
        const c = waterColor(seaLevel - z);
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
      } else {
        const s = shadeFactor(shade[k] * w00 + shade[k + 1] * w10 + shade[k + nx] * w01 + shade[k + nx + 1] * w11);
        const m = Math.max(0, Math.min(1200, Math.round(z + 200))) * 3;
        data[o] = lut[m] * s; data[o + 1] = lut[m + 1] * s; data[o + 2] = lut[m + 2] * s;
      }
      data[o + 3] = 255;
    }
  }
  return data;
}
