# Earth Science Lab

**Change the conditions. See how Earth responds.**

Free interactive earth science simulations for students aged about 10–16 and their teachers, at
[earthsciencelab.org](https://earthsciencelab.org). From the makers of
[Interactive Periodic Table](https://interactiveperiodictable.net/).

The first lab is the **Earthquake Epicenter Finder** (`/tools/earthquake-epicenter/`): read three synthetic
seismograms, measure each S–P lag, turn it into a distance (lag × 8.4 km) and triangulate the epicenter.
It has Guided, Challenge (three scored quakes, shareable by link) and Explore modes, a printable worksheet
and a teacher answer key.

The second lab is the **Plate Tectonics Explorer** (`/tools/plate-tectonics/`): animated cross-sections of
all six plate-boundary types with earthquake depths, volcanoes and landforms, a rate × time calculator and a
challenge mode, plus its own worksheet and answer key.

The third lab is the **Contour Map Playground** (`/tools/contour-map/`): sculpt a landscape beside its live
contour map and a shaded relief or 3D view, switch the contour interval and sea level, overlay index lines,
steep slopes and the V-rule, draw cross-sections and try map-reading challenges. Sculpted landscapes are kept in
the browser (`contourSculpt` in local storage); everything else travels in the share link.

The fourth lab is the **River Erosion Sandbox** (`/tools/river-erosion/`): a virtual stream table where students set
the slope, water flow, sediment size and supply, then watch the channel erode, point bars grow and a delta build,
with an interactive Hjulström diagram explaining which grains are eroded, carried or dropped.

The fifth lab is the **Water Cycle Explorer** (`/tools/water-cycle/`): students follow one droplet between ten
reservoirs by choice or by seeded chance, adding up typical residence times, see USGS reservoir volumes as zoom
bars, and try colder or warmer climates or switch off the sun or gravity.

The sixth lab is the **Rock Cycle Builder** (`/tools/rock-cycle/`): students melt, cool, weather, deposit, cement,
metamorphose and uplift material through 21 real rocks, with only geologically sound changes allowed and the depth,
temperature, time and energy source shown for each step.

`/tools/` lists every lab (from `src/lib/labs.mjs`), and lab pages sit under **Labs** in the menu and breadcrumbs.

Static site: Astro 5, `@astrojs/sitemap`, vanilla TypeScript islands, no framework runtime.

## Local development

Requires Node 22 (see `.nvmrc`).

```sh
npm ci
npm run dev        # http://localhost:4321
npm test           # model, share-link, worksheet and config tests (node --test)
npm run build      # writes dist/
npm run check      # checks dist/: unique titles and H1s, valid JSON-LD, local links, answer keys noindex and out of the sitemap
npm run preview    # serves dist/
npm run og-image   # re-renders public/og-image.png (1200×630) with Playwright
```

`npm run og-image` uses an installed Playwright and Chromium (`npx playwright install chromium`); point
`PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` at another install if needed.

## Project layout

| Path | What it is |
| --- | --- |
| `src/lib/seismology.mjs` | The model: wave speeds, lag ↔ distance, least-squares trilateration, error triangle, local magnitude, seeded scenarios |
| `src/lib/seismogram.mjs` | Synthetic seismogram traces and drawing geometry, shared by the server and the browser |
| `src/lib/share-state.mjs` | Share-link parsing and serializing (`?mode=challenge&seed=4821&snap=0`, `?mode=explore&x=320&y=150&m=5.2`) |
| `src/lib/activities.mjs` | Worksheet and answer-key content; every printed number is computed from the model and checked by tests |
| `src/scripts/epicenter.ts` | The finder's interactive code |
| `src/lib/plates.mjs` | Plate tectonics model: boundary facts, rate × time and seafloor-age math, deterministic cross-section geometry |
| `src/lib/activities/plate-tectonics.mjs` | The plate boundaries worksheet and answer key (imported by `activities.mjs`) |
| `src/components/plates/` | The explorer's cross-section, map inset, styles and interactive code (`explorer.ts`) |
| `src/lib/terrain.mjs` | Contour map model: preset landscapes as height grids, sculpting brushes, sampling, river paths and cross-section profiles |
| `src/lib/contours.mjs` | Marching-squares contour lines for any interval and sea level |
| `src/lib/relief.mjs` | Landscape colors: a color-by-height tint times hillshade, with water below sea level |
| `src/lib/contour-svg.mjs` | Map SVG (contours, index lines, steep-slope and V-rule overlays, marks), shared by the server and the browser |
| `src/lib/contour-share.mjs` | Contour share-link parsing and serializing (`?preset=river&ci=20&ov=index,vrule`, `?mode=challenge`) |
| `src/lib/contour-challenges.mjs` | The eight Match & Read challenge questions, each answer worked out from the model |
| `src/lib/activities/contour-map.mjs` | The contour map worksheet and answer key (imported by `activities.mjs`) |
| `src/components/contour/`, `src/scripts/contour.ts`, `src/styles/contour.css` | The playground's markup, interactive code and styles |
| `src/lib/river.mjs` | River model: Hjulström-style erosion and settling thresholds, Manning water speed, a sediment budget with slumping banks, share links and the Challenge questions |
| `src/lib/river-svg.mjs` | Stream table plan view, side view and Hjulström diagram SVG, shared by the server and the browser |
| `src/lib/activities/river-erosion.mjs` | The erosion and deposition worksheet and answer key (imported by `activities.mjs`) |
| `src/components/river/` | The sandbox's markup, interactive code (`sandbox.ts`), styles and answer-key figure |
| `src/lib/water-cycle.mjs` | Water cycle model: USGS reservoir volumes, typical residence times, every move with its process, driver and chance, climate shifts, seeded chance, share links, scene geometry, zoom bars and the challenge questions |
| `src/lib/activities/water-cycle.mjs` | The water cycle journey worksheet and answer key (chance code 10), imported by `activities.mjs` |
| `src/components/water/` | The explorer's markup (`WaterExplorer.astro`), interactive code (`explorer.ts`) and styles (`water.css`) |
| `src/lib/rock-cycle.mjs` | Rock cycle model: 21 rocks plus magma, sediment and layers, seven processes with only sound changes, conditions (temperature, depth, pressure, time, energy), shortest-route search and challenge questions |
| `src/lib/rock-view.mjs` | Seeded original rock textures, the crust cross-section with the journey, the rock cycle diagram, and the card, conditions and journey HTML, shared by the server and the browser |
| `src/lib/rock-share.mjs` | Rock cycle share links (`?start=granite&steps=up.we.dm.cc.h1`, `?mode=challenge`) with friendly fallback notes |
| `src/lib/activities/rock-cycle.mjs` | The rock cycle journey worksheet and answer key (imported by `activities.mjs`) |
| `src/components/rock/` | The builder's markup (`RockBuilder.astro`), interactive code (`builder.ts`) and styles (`rock.css`) |
| `src/lib/labs.mjs` | Every lab in menu order: name, menu section, topic and blurb for the Labs hub and the home page |
| `src/lib/site.mjs` | Site name, URL, contact address and the Google Analytics ID |
| `src/lib/ads.mjs` | Adsterra keys (empty: no ads) |
| `src/lib/learning-apps.mjs` | Sister apps shown in the footer and on the home page |

## Deploy (Cloudflare Workers static assets)

1. In the Cloudflare dashboard: **Workers & Pages → Create → Import a repository**, and pick this repository.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`. `wrangler.jsonc` serves `./dist`
   with trailing-slash URLs and `404.html` for missing pages.
3. Add the custom domain **earthsciencelab.org** to the Worker (Settings → Domains & Routes). If you also own
   earthsciencelab.net, add a redirect rule sending it to `https://earthsciencelab.org` with a 301.
4. On the zone: turn on **SSL/TLS → Edge Certificates → Always Use HTTPS**, and **Caching → Configuration →
   Crawler Hints**.
5. After launch, add the site to Google Search Console and Bing Webmaster Tools and submit
   `https://earthsciencelab.org/sitemap-index.xml`.

`public/_headers` sets security headers and long caching for `/_astro/*`.

## Google Analytics 4

The measurement ID lives in `src/lib/site.mjs` (currently `G-JE3DTV9N7R`):

```js
analyticsId: 'G-JE3DTV9N7R',
```

While it is empty, no Google tag is rendered and no cookies are set, so the cookie banner and the footer's
**Cookie settings** button are left out too. Google Consent Mode defaults (`ConsentDefaults.astro`) always
run: storage is denied by default in the EEA, UK and Switzerland and granted elsewhere. As soon as an ID is
set, the tag loads, visitors in those regions see the banner (Accept / Reject, remembered for 180 days), and
the privacy page's wording switches to match. Update the privacy page's date when you do.

Events sent with `track()` (`src/lib/analytics.ts`, a no-op without a Google tag):

| Event | When | Parameters |
| --- | --- | --- |
| `epicenter_solved` | Reveal the epicenter (Guided or Challenge) | `mode`, `error_km` |
| `epicenter_challenge_complete` | Third quake of a challenge revealed | `score` (0–300), `seed` |
| `plates_explore` | Change boundary type or plates in the explorer (debounced) | `type`, `plates` |
| `plates_challenge_complete` | Last plate-boundary challenge answered | `score`, `total` |
| `contour_edit` | Sculpting the landscape (debounced) | `preset` |
| `contour_profile_drawn` | A cross-section line is drawn | `preset`, `how` |
| `contour_challenge_complete` | Last contour challenge answered | `score` |
| `river_explore` | Change the sandbox settings (debounced) | `slope`, `flow`, `grain`, `supply` |
| `river_run_complete` | A run reaches 20 minutes | `slope`, `flow`, `grain`, `supply`, `delta_cm`, `eroded_cm3` |
| `river_challenge_complete` | Last river challenge answered | `score`, `total` |
| `water_explore` | Change the climate, switches or view (debounced) | `view`, `climate`, `sun`, `gravity` |
| `water_journey` | A droplet journey reaches 5 moves | `start`, `how` |
| `water_challenge_complete` | Last water cycle challenge answered | `score`, `total` |
| `rock_explore` | Take a step or change the start (debounced) | `process`, `rock`, `steps` |
| `rock_challenge_complete` | Last rock cycle challenge answered | `score`, `total` |
| `worksheet_print` | Print button on a worksheet or answer key | `page` |
| `share_classroom` | A Share to Google Classroom link is clicked | `page` |

## Ads (Adsterra)

There are no ads yet. `AdSlot.astro` renders nothing at all while its keys in `src/lib/ads.mjs` are empty.
To switch ads on once Adsterra approves the site, copy the unit keys (32 hex characters) from the publisher
dashboard into `src/lib/ads.mjs`:

```js
native: '…',      // native banner
leaderboard: '…', // 728×90, needs `mobile` too
mobile: '…',      // 320×50
rectangle: '…',   // 300×250
```

Then:

- The slots on the home page and tool pages reserve space and load lazily, only on `earthsciencelab.org`.
- Ads wait for **Accept** in consent regions, and the banner wording mentions ads automatically.
- Teacher pages and answer keys never show ads (`ads={false}`).
- Students who arrive from Google Classroom, Canvas or Schoology, or through a Share to Google Classroom link
  (`?classroom=1`), get no ads on that device for 30 days (`AdFree.astro`, `adFreeUntil` in local storage).
- Update the Ads section of the privacy page (it switches its wording automatically, but check it reads right).

## The model, honestly

The finder uses the real method with a simplified Earth: P waves at 6.0 km/s and S waves at 3.5 km/s
through a uniform crust, straight paths along a flat surface, and the focus treated as if it were at the
surface. That gives S–P lag = d × (1/3.5 − 1/6.0), exactly 1 s per 8.4 km. Real seismologists use
travel-time tables, many stations, and solve for depth and origin time too. The optional magnitude,
ML = log10(A) + 3·log10(8·Δt) − 2.92 (a fit to the Richter nomogram, after Lillie), is labeled as a classroom
approximation. The map, towns and seismograms are fictional and generated by the model.
