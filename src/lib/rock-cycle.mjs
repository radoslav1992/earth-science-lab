// The Rock Cycle Builder model: the rocks (and the not-yet-rock states magma, sediment and deposited
// layers), the processes that change them, where each process happens and under roughly what conditions,
// the challenge questions, and a shortest-route search used by the challenges and the tests.
// Pure and deterministic: the server render, the browser and the tests all call these same functions.
//
// Sources for the facts and ranges (all values are rounded classroom approximations, not measurements):
// - Earle, S. (2019) Physical Geology, 2nd ed., BCcampus Open Education: ch. 3 (magma, intrusive and
//   extrusive rocks), ch. 4 (magma and lava temperatures: roughly 650–800 °C felsic, 800–1,000 °C
//   intermediate, 1,000–1,200 °C mafic), ch. 5–6 (weathering, sediments, lithification), ch. 7
//   (metamorphism; Table 7.1, the rock each parent becomes at each grade: mudrock → slate → phyllite →
//   schist → gneiss; basalt → chlorite schist (greenschist), then amphibolite from medium grade; granite
//   unchanged until high grade, then granite gneiss; sandstone little changed until medium grade, then
//   quartzite; limestone little changed at very low grade, then marble).
// - The grade temperature bands (about 200–300, 300–400, 400–600 and 600–800 °C) are rounded classroom
//   values in line with common textbook figures; real boundaries are gradual and depend on pressure.
// - USGS Volcano Hazards Program glossary (obsidian, pumice, scoria) and USGS "Rocks and minerals" pages.
// - Typical continental geothermal gradient about 25–30 °C per km (see Earle ch. 9); average crust density
//   about 2,700 kg/m³; long-term uplift and erosion rates of roughly 0.1–10 mm per year in mountain belts.
// - Pure quartz melts above about 1,700 °C; calcite needs far more heat than the crust reaches to melt.

// ---------- Families and make-up ----------
export const FAMILIES = ['magma', 'intrusive', 'extrusive', 'sediment', 'sedimentary', 'metamorphic'];
export const FAMILY_NAMES = {
  magma: 'Magma (molten rock)',
  intrusive: 'Igneous, intrusive',
  extrusive: 'Igneous, extrusive',
  sediment: 'Sediment (not rock yet)',
  sedimentary: 'Sedimentary',
  metamorphic: 'Metamorphic',
};
/** The five stops on the rock cycle diagram. */
export const NODES = ['magma', 'igneous', 'sediment', 'sedimentary', 'metamorphic'];
export const NODE_NAMES = { magma: 'Magma', igneous: 'Igneous rock', sediment: 'Sediment', sedimentary: 'Sedimentary rock', metamorphic: 'Metamorphic rock' };
export const nodeOf = family => (family === 'intrusive' || family === 'extrusive' ? 'igneous' : family);
export const isRockFamily = family => ['intrusive', 'extrusive', 'sedimentary', 'metamorphic'].includes(family);

// What a rock is made of, in broad strokes. Melting gives magma of the same make-up (felsic, intermediate
// or mafic); quartz rock and calcite rock don't melt at temperatures the crust reaches.
export const COMPS = ['felsic', 'intermediate', 'mafic', 'quartz', 'carbonate'];
export const COMP_NAMES = {
  felsic: 'Silica-rich (felsic)',
  intermediate: 'Medium silica (intermediate)',
  mafic: 'Silica-poor (mafic)',
  quartz: 'Mostly quartz',
  carbonate: 'Calcite (calcium carbonate)',
};
// Typical silica content of the magma types (percent by weight, rounded; Earle ch. 3).
export const SILICA_PERCENT = { felsic: 70, intermediate: 60, mafic: 50 };
// Rough temperatures at which each make-up of rock starts to melt, and of its magma and lava (°C).
// Water lowers the melting point, which is why wet silica-rich rock can begin to melt near 650 °C.
export const MELT_C = { felsic: [650, 800], intermediate: [800, 1000], mafic: [1000, 1200] };

// ---------- Conditions: the classroom geotherm, pressure and uplift ----------
export const GRADIENT_C_PER_KM = 25; // about 25 °C hotter for each km down (real gradients vary a lot)
export const CRUST_DENSITY = 2700; // kg per cubic meter
export const G = 9.81; // m per s²
export const ATM_PA = 101325; // air pressure at sea level, in pascals
export const UPLIFT_MM_PER_YR = 1; // a round, middle-of-the-range uplift and erosion rate
/** Depth (km) at which the classroom geotherm reaches a temperature (ignores the few °C at the surface). */
export const depthForTempKm = tempC => tempC / GRADIENT_C_PER_KM;
export const tempAtDepthC = km => km * GRADIENT_C_PER_KM;
/** Pressure from the rock above, as a multiple of air pressure at sea level: ρ g h / 1 atm. */
export const pressureAtm = km => (CRUST_DENSITY * G * km * 1000) / ATM_PA;
/** 1 mm per year for 1 million years is 1,000,000 mm = 1 km, so time (millions of years) = km ÷ (mm/yr). */
export const upliftMyr = (km, mmPerYr = UPLIFT_MM_PER_YR) => km / mmPerYr;

// ---------- Metamorphic grades (regional metamorphism: heat and squeezing under mountains) ----------
export const GRADES = [
  { n: 1, id: 'very-low', name: 'Very low grade', temp: [200, 300] },
  { n: 2, id: 'low', name: 'Low grade', temp: [300, 400] },
  { n: 3, id: 'medium', name: 'Medium grade', temp: [400, 600] },
  { n: 4, id: 'high', name: 'High grade', temp: [600, 800] },
];
export const gradeDepth = g => GRADES[g - 1].temp.map(depthForTempKm);

// ---------- Places in the cross-section ----------
// depth: [shallowest, deepest] in km. surface: weathering can reach the material here.
const meltDepth = comp => MELT_C[comp].map(depthForTempKm);
export const PLACES = {
  land: { name: 'At the surface, on land', short: 'at the surface', depth: [0, 0], surface: true },
  volcano: { name: 'At the surface, on a volcano', short: 'at the surface', depth: [0, 0], surface: true },
  stream: { name: 'Carried along by a river', short: 'in a river', depth: [0, 0], surface: true },
  river: { name: 'On a riverbed of fast-flowing water', short: 'on a riverbed', depth: [0, 0], surface: true },
  beach: { name: 'On a beach', short: 'on a beach', depth: [0, 0], surface: true },
  reef: { name: 'On the floor of a warm, shallow sea', short: 'on a shallow sea floor', depth: [0, 0], surface: true },
  seafloor: { name: 'On the floor of quiet, deep water', short: 'on a quiet sea floor', depth: [0, 0], surface: true },
  buried: { name: 'Buried under younger layers', short: 'buried underground', depth: [1, 5] },
  pluton: { name: 'Underground, in a body of cooling magma', short: 'deep underground', depth: [2, 14] },
  meta1: { name: 'Deep under a mountain range', short: 'deep underground', depth: gradeDepth(1) },
  meta2: { name: 'Deep under a mountain range', short: 'deep underground', depth: gradeDepth(2) },
  meta3: { name: 'Deep under a mountain range', short: 'deep underground', depth: gradeDepth(3) },
  meta4: { name: 'Deep under a mountain range', short: 'deep underground', depth: gradeDepth(4) },
  'melt-felsic': { name: 'Deep in the crust', short: 'deep underground', depth: meltDepth('felsic') },
  'melt-intermediate': { name: 'Near the bottom of the crust', short: 'deep underground', depth: meltDepth('intermediate') },
  'melt-mafic': { name: 'In the upper mantle, below the crust', short: 'in the mantle', depth: meltDepth('mafic') },
};
export const midDepth = place => (PLACES[place].depth[0] + PLACES[place].depth[1]) / 2;

// ---------- Materials ----------
// formedBy: the step that makes it (used for the conditions shown when a journey starts from it).
// texture: the drawing style for its rock card (see rock-view.mjs).
export const MATERIALS = {
  'felsic-magma': {
    name: 'Rhyolitic magma', family: 'magma', comp: 'felsic', formedBy: 'me', texture: 'magma',
    look: 'Molten rock: thick and sticky, with dissolved gas and a few crystals',
    forms: 'Silica-rich rock deep in the crust melts, often helped by water. This sticky magma can make granite, rhyolite, obsidian or pumice.',
    example: 'Fed the giant explosive eruptions that formed Yellowstone’s calderas.',
    madeOf: `Melted minerals, about ${SILICA_PERCENT.felsic}% silica`,
  },
  'intermediate-magma': {
    name: 'Andesitic magma', family: 'magma', comp: 'intermediate', formedBy: 'me', texture: 'magma',
    look: 'Molten rock: fairly thick, with dissolved gas and some crystals',
    forms: 'Rock melts deep under volcanoes where one plate sinks under another. This magma can make diorite, andesite or pumice.',
    example: 'Feeds the steep volcanoes of the Andes and the Cascades.',
    madeOf: `Melted minerals, about ${SILICA_PERCENT.intermediate}% silica`,
  },
  'mafic-magma': {
    name: 'Basaltic magma', family: 'magma', comp: 'mafic', formedBy: 'me', texture: 'magma',
    look: 'Molten rock: very hot and runny',
    forms: 'Rock in the upper mantle partly melts, for example under mid-ocean ridges and hot spots. This runny magma can make gabbro, basalt or scoria.',
    example: 'Feeds the lava flows of Hawaii and Iceland, and new ocean crust at mid-ocean ridges.',
    madeOf: `Melted minerals, about ${SILICA_PERCENT.mafic}% silica`,
  },
  granite: {
    name: 'Granite', family: 'intrusive', comp: 'felsic', formedBy: 'cs', texture: 'granite',
    look: 'Coarse-grained: big interlocking crystals you can see',
    forms: 'Silica-rich magma cools slowly, deep underground. Slow cooling gives crystals thousands of years to grow large.',
    example: 'Kitchen countertops, and Mount Rushmore, which is carved in granite.',
    madeOf: 'Quartz, feldspar and a little dark mica',
  },
  diorite: {
    name: 'Diorite', family: 'intrusive', comp: 'intermediate', formedBy: 'cs', texture: 'diorite',
    look: 'Coarse-grained: black and white crystals, like salt and pepper',
    forms: 'Andesitic magma cools slowly, deep underground, and grows large crystals.',
    example: 'Black-and-white speckled stone sold as “granite” for countertops is often diorite.',
    madeOf: 'White plagioclase feldspar and black hornblende',
  },
  gabbro: {
    name: 'Gabbro', family: 'intrusive', comp: 'mafic', formedBy: 'cs', texture: 'gabbro',
    look: 'Coarse-grained: dark crystals you can see',
    forms: 'Basaltic magma cools slowly underground. The lower part of the ocean crust is gabbro.',
    example: 'Dark stone sold as “black granite” for countertops and gravestones.',
    madeOf: 'Plagioclase feldspar and dark pyroxene',
  },
  rhyolite: {
    name: 'Rhyolite', family: 'extrusive', comp: 'felsic', formedBy: 'cf', texture: 'rhyolite',
    look: 'Fine-grained: crystals too small to see, often with flow bands',
    forms: 'Silica-rich lava cools quickly at the surface, so its crystals stay tiny. It has the same minerals as granite.',
    example: 'The pink and pale lava flows and canyon walls of Yellowstone National Park.',
    madeOf: 'Quartz and feldspar in tiny crystals, with some glass',
  },
  andesite: {
    name: 'Andesite', family: 'extrusive', comp: 'intermediate', formedBy: 'cf', texture: 'andesite',
    look: 'Fine-grained gray rock, often with a few larger crystals',
    forms: 'Andesitic lava cools quickly at the surface. A few crystals that grew in the magma chamber stand out in it.',
    example: 'Named after the Andes Mountains, whose volcanoes erupt it.',
    madeOf: 'Plagioclase feldspar with hornblende or pyroxene',
  },
  basalt: {
    name: 'Basalt', family: 'extrusive', comp: 'mafic', formedBy: 'cf', texture: 'basalt',
    look: 'Fine-grained: dark, with crystals too small to see',
    forms: 'Runny basaltic lava cools quickly at the surface. It is the most common volcanic rock on Earth, because the ocean crust is made of it.',
    example: 'Hawaii’s lava flows, the columns of the Giant’s Causeway, and the dark patches on the Moon.',
    madeOf: 'Plagioclase feldspar and pyroxene in tiny crystals',
  },
  obsidian: {
    name: 'Obsidian', family: 'extrusive', comp: 'felsic', formedBy: 'cg', texture: 'obsidian',
    look: 'Glassy: smooth and shiny, with no crystals at all',
    forms: 'Thick, silica-rich lava cools before crystals can grow, so it sets as natural glass.',
    example: 'Ancient people chipped it into razor-sharp arrowheads and blades.',
    madeOf: `Volcanic glass, about ${SILICA_PERCENT.felsic}% silica`,
  },
  pumice: {
    name: 'Pumice', family: 'extrusive', comp: 'felsic', formedBy: 'cv', texture: 'pumice',
    look: 'Vesicular: pale and frothy, full of tiny gas holes',
    forms: 'In an explosive eruption, gas froths sticky lava like a shaken soda. It cools in seconds into a glassy foam.',
    example: 'Light enough to float on water; used in pumice stones and to make “stonewashed” jeans.',
    madeOf: 'Frothy volcanic glass from silica-rich or andesitic magma',
  },
  scoria: {
    name: 'Scoria', family: 'extrusive', comp: 'mafic', formedBy: 'cv', texture: 'scoria',
    look: 'Vesicular: dark red or black, with many large gas holes',
    forms: 'Gas-rich basaltic lava is thrown out of a vent in fountains and cools full of bubbles.',
    example: 'The red or black “lava rock” in gardens and gas grills; cinder cones like Sunset Crater in Arizona.',
    madeOf: 'Glass and tiny crystals of basalt’s minerals',
  },
  sediment: {
    name: 'Sediment', family: 'sediment', comp: null, formedBy: 'we', texture: 'sediment',
    look: 'Loose grains: pebbles, sand, silt and clay',
    forms: 'Weathering breaks rock into pieces and dissolves some of it. Erosion carries the pieces away in water, wind or ice.',
    example: 'Sand on a beach, mud in a puddle and pebbles in a stream.',
    madeOf: 'Bits of older rock and minerals, plus minerals dissolved in water',
  },
  gravel: {
    name: 'Gravel layers', family: 'sediment', comp: null, formedBy: 'dg', texture: 'gravel', layer: true,
    look: 'Loose, rounded pebbles with sand between them',
    forms: 'Fast-flowing rivers can carry pebbles. Where the water slows, it drops them in layers.',
    example: 'A riverbed of smooth, rounded stones.',
    madeOf: 'Rounded pebbles and sand',
  },
  sand: {
    name: 'Sand layers', family: 'sediment', comp: null, formedBy: 'ds', texture: 'sand', layer: true,
    look: 'Loose sand grains in layers',
    forms: 'Waves, rivers and wind sort grains by size and leave sand on beaches, sandbars and dunes.',
    example: 'A beach or a desert sand dune.',
    madeOf: 'Sand grains, mostly quartz',
  },
  mud: {
    name: 'Mud layers', family: 'sediment', comp: null, formedBy: 'dm', texture: 'mud', layer: true,
    look: 'Soft, wet mud in thin layers',
    forms: 'Tiny clay and silt grains stay floating until the water is very still, then settle in thin layers.',
    example: 'Mudflats, lake bottoms and the deep sea floor.',
    madeOf: 'Clay and silt',
  },
  shells: {
    name: 'Shell layers', family: 'sediment', comp: null, formedBy: 'dc', texture: 'shells', layer: true,
    look: 'Shells, coral pieces and lime mud',
    forms: 'Rivers carry calcium dissolved out of weathered rock to the sea. In warm, shallow water, shellfish and corals use it to build shells of calcite.',
    example: 'Coral reefs and shell beds, like the Great Barrier Reef.',
    madeOf: 'Calcite shells and lime mud',
  },
  conglomerate: {
    name: 'Conglomerate', family: 'sedimentary', comp: 'felsic', formedBy: 'cc', texture: 'conglomerate',
    look: 'Rounded pebbles cemented together, like natural concrete',
    forms: 'Layers of river gravel are buried, squeezed and glued together by minerals left by water.',
    example: 'The tilted red rock layers of Red Rocks Amphitheatre near Denver.',
    madeOf: 'Pebbles of older rock in sand, held by natural cement',
  },
  sandstone: {
    name: 'Sandstone', family: 'sedimentary', comp: 'quartz', formedBy: 'cc', texture: 'sandstone',
    look: 'Sand-sized grains cemented together; feels gritty',
    forms: 'Layers of sand are buried, squeezed and cemented. Slanting lines inside it can show where old dunes or ripples were.',
    example: 'The red cliffs of Zion and Arches National Parks, and many old buildings.',
    madeOf: 'Sand grains, mostly quartz, and natural cement',
  },
  shale: {
    name: 'Shale', family: 'sedimentary', comp: 'felsic', formedBy: 'cc', texture: 'shale',
    look: 'Very fine grains in thin layers; splits into flakes',
    forms: 'Layers of mud are buried and squeezed until the water is pressed out. It is the most common sedimentary rock.',
    example: 'Ground up to make bricks; the Burgess Shale in Canada holds famous fossils.',
    madeOf: 'Clay minerals and tiny quartz grains',
  },
  limestone: {
    name: 'Limestone', family: 'sedimentary', comp: 'carbonate', formedBy: 'cc', texture: 'limestone',
    look: 'Pale rock of calcite, often with fossil shells',
    forms: 'Layers of shells, coral and lime mud are buried and cemented.',
    example: 'Used to make cement; the White Cliffs of Dover are chalk, a kind of limestone.',
    madeOf: 'Calcite from shells and lime mud',
  },
  slate: {
    name: 'Slate', family: 'metamorphic', comp: 'felsic', formedBy: 'h1', texture: 'slate', foliated: true,
    look: 'Foliated: dull and smooth; splits into flat sheets',
    forms: 'Shale is squeezed and warmed. Its tiny flat minerals line up, so it splits cleanly along one direction.',
    example: 'Roof tiles, old school chalkboards and the beds of pool tables.',
    madeOf: 'Tiny mica and clay minerals, lined up, with quartz',
  },
  phyllite: {
    name: 'Phyllite', family: 'metamorphic', comp: 'felsic', formedBy: 'h2', texture: 'phyllite', foliated: true,
    look: 'Foliated: shiny, silky and often wavy',
    forms: 'Slate is heated a little more. Its mica crystals grow just big enough to give it a silky shine.',
    example: 'Found in old mountain belts such as the Appalachians.',
    madeOf: 'Fine mica, chlorite and quartz',
  },
  schist: {
    name: 'Schist', family: 'metamorphic', comp: 'felsic', formedBy: 'h3', texture: 'schist', foliated: true,
    look: 'Foliated: sparkly flakes of mica you can see, sometimes with garnets',
    forms: 'Hotter still, the mica grows into flakes you can see, and new minerals such as garnet can form.',
    example: 'Manhattan Schist is the bedrock that holds up New York City’s skyscrapers.',
    madeOf: 'Mica, quartz and often red garnet',
  },
  gneiss: {
    name: 'Gneiss', family: 'metamorphic', comp: 'felsic', formedBy: 'h4', texture: 'gneiss', foliated: true,
    look: 'Banded: light and dark stripes of minerals',
    forms: 'At high grade, minerals separate into light and dark bands. Shale, schist or granite can all become gneiss.',
    example: 'Some of Earth’s oldest known rocks, the Acasta Gneiss in Canada, are about 4 billion years old.',
    madeOf: 'Light quartz and feldspar, dark mica and hornblende',
  },
  marble: {
    name: 'Marble', family: 'metamorphic', comp: 'carbonate', formedBy: 'h3', texture: 'marble',
    look: 'Non-foliated: interlocking calcite crystals, often white',
    forms: 'Heat and pressure make the calcite in limestone grow into larger crystals that lock together. Fossils disappear.',
    example: 'Michelangelo’s statue David and the Taj Mahal are made of marble.',
    madeOf: 'Calcite crystals',
  },
  quartzite: {
    name: 'Quartzite', family: 'metamorphic', comp: 'quartz', formedBy: 'h3', texture: 'quartzite',
    look: 'Non-foliated: quartz grains fused together; very hard',
    forms: 'Heat and pressure fuse the quartz grains of sandstone. It breaks across the grains, not around them.',
    example: 'Hard stone for countertops and the gravel under railroad tracks.',
    madeOf: 'Quartz',
  },
  greenschist: {
    name: 'Greenschist', family: 'metamorphic', comp: 'mafic', formedBy: 'h2', texture: 'greenschist', foliated: true,
    look: 'Foliated: green and flaky',
    forms: 'Basalt, gabbro or andesite is squeezed and warmed with water. Green minerals such as chlorite grow and line up.',
    example: 'Found in “greenstone belts”, some of the oldest rocks on Earth.',
    madeOf: 'Green chlorite and epidote, with feldspar',
  },
  amphibolite: {
    name: 'Amphibolite', family: 'metamorphic', comp: 'mafic', formedBy: 'h3', texture: 'amphibolite', foliated: true,
    look: 'Dark and heavy, with lined-up black crystals',
    forms: 'Basalt, gabbro or andesite is heated to medium or high grade. Long black hornblende crystals grow, often lined up.',
    example: 'Polished as dark building stone and countertops.',
    madeOf: 'Hornblende and plagioclase feldspar',
  },
};
export const MATERIAL_IDS = Object.keys(MATERIALS);
export const ROCK_IDS = MATERIAL_IDS.filter(id => isRockFamily(MATERIALS[id].family));
export const MAGMA_IDS = MATERIAL_IDS.filter(id => MATERIALS[id].family === 'magma');
/** What a journey can start from: the three magmas and every rock. */
export const START_IDS = [...MAGMA_IDS, ...ROCK_IDS];
export const DEFAULT_START = 'granite';
const the = id => `the ${MATERIALS[id].name.toLowerCase()}`;
const The = id => `The ${MATERIALS[id].name.toLowerCase()}`;
export const magmaOf = comp => `${comp}-magma`;

// ---------- Processes ----------
export const PROCESSES = [
  { id: 'cool', name: 'Cooling and crystallizing', blurb: 'Magma cools and hardens into igneous rock.' },
  { id: 'uplift', name: 'Uplift and exposure', blurb: 'Mountain building lifts buried rock; erosion uncovers it.' },
  { id: 'weather', name: 'Weathering and erosion', blurb: 'Rain, ice and wind break rock down and carry it away.' },
  { id: 'deposit', name: 'Deposition', blurb: 'Loose grains settle in layers where water or wind slows.' },
  { id: 'lithify', name: 'Compaction and cementation', blurb: 'Buried layers are squeezed and glued into rock.' },
  { id: 'meta', name: 'Heat and pressure', blurb: 'Buried deep under mountains, solid rock changes without melting.' },
  { id: 'melt', name: 'Melting', blurb: 'Carried deep, rock gets hot enough to melt into magma.' },
];
export const PROCESS_BY_ID = Object.fromEntries(PROCESSES.map(p => [p.id, p]));
// Every option a student can choose, with its short code for share links.
export const OPTIONS = [
  { code: 'cs', process: 'cool', label: 'Slowly, deep underground', short: 'slowly underground' },
  { code: 'cf', process: 'cool', label: 'Quickly, as lava at the surface', short: 'quickly as lava' },
  { code: 'cg', process: 'cool', label: 'Very quickly, into glass', short: 'into glass' },
  { code: 'cv', process: 'cool', label: 'Full of gas bubbles', short: 'full of gas bubbles' },
  { code: 'up', process: 'uplift', label: 'Lift it to the surface', short: '' },
  { code: 'we', process: 'weather', label: 'Weather and erode it', short: '' },
  { code: 'dg', process: 'deposit', label: 'Gravel, in a fast river', short: 'gravel in a fast river' },
  { code: 'ds', process: 'deposit', label: 'Sand, on a beach', short: 'sand on a beach' },
  { code: 'dm', process: 'deposit', label: 'Mud, in quiet water', short: 'mud in quiet water' },
  { code: 'dc', process: 'deposit', label: 'Shells, in a warm, shallow sea', short: 'shells in a warm sea' },
  { code: 'cc', process: 'lithify', label: 'Bury, squeeze and cement it', short: '' },
  ...GRADES.map(g => ({ code: `h${g.n}`, process: 'meta', grade: g.n, label: `${g.name}, ${g.temp[0]}–${g.temp[1]}\u00a0°C`, short: g.name.toLowerCase() })),
  { code: 'me', process: 'melt', label: 'Melt it', short: '' },
];
export const OPTION_BY_CODE = Object.fromEntries(OPTIONS.map(o => [o.code, o]));
export const CODES = OPTIONS.map(o => o.code);
/** "Heat and pressure, medium grade" or "Melting". */
export const stepName = code => {
  const o = OPTION_BY_CODE[code];
  return o.short ? `${PROCESS_BY_ID[o.process].name}, ${o.short}` : PROCESS_BY_ID[o.process].name;
};

// Cooling: magma make-up → rock for each way of cooling. null means this model doesn't make that rock.
const COOLING = {
  cs: { felsic: 'granite', intermediate: 'diorite', mafic: 'gabbro' },
  cf: { felsic: 'rhyolite', intermediate: 'andesite', mafic: 'basalt' },
  cg: { felsic: 'obsidian', intermediate: null, mafic: null },
  cv: { felsic: 'pumice', intermediate: 'pumice', mafic: 'scoria' },
};
const DEPOSITS = { dg: ['gravel', 'river'], ds: ['sand', 'beach'], dm: ['mud', 'seafloor'], dc: ['shells', 'reef'] };
const LITHIFIED = { gravel: 'conglomerate', sand: 'sandstone', mud: 'shale', shells: 'limestone' };
// The mudrock ladder (Earle Table 7.1): each grade has its own rock.
export const MUD_LADDER = ['shale', 'slate', 'phyllite', 'schist', 'gneiss'];

function metamorphose(state, g) {
  const { id, comp } = state;
  const m = MATERIALS[id];
  const rank = MUD_LADDER.indexOf(id);
  if (rank >= 0) {
    if (g > rank) return { id: MUD_LADDER[g], comp: 'felsic' };
    if (id === 'gneiss') return { reason: 'Gneiss is already high grade. Any hotter and it would start to melt: try Melting.' };
    return { reason: `${The(id)} has already been through ${GRADES[rank - 1].name.toLowerCase()} conditions. In this model, metamorphism only moves up in grade. Try a higher grade.` };
  }
  if (id === 'sandstone') {
    if (g >= 3) return { id: 'quartzite', comp: 'quartz' };
    return { reason: 'Sandstone’s quartz grains barely change at this grade. It takes medium or high grade to fuse them into quartzite.' };
  }
  if (id === 'limestone') {
    if (g >= 2) return { id: 'marble', comp: 'carbonate' };
    return { reason: 'At very low grade, limestone changes only a little. From low grade up, its calcite grows into the interlocking crystals of marble.' };
  }
  if (id === 'quartzite') return { reason: 'Quartzite is almost pure quartz. More heat and pressure only make it quartzite again.' };
  if (id === 'marble') return { reason: 'Marble is calcite. More heat and pressure only make it marble again.' };
  if (id === 'conglomerate') return { reason: 'Heat and pressure would squash conglomerate’s pebbles into metaconglomerate, a rock this model leaves out. Try weathering it, or melting it.' };
  if (id === 'amphibolite') return { reason: 'Amphibolite is already medium to high grade. Hotter still, it would start to melt: try Melting.' };
  if (id === 'greenschist') {
    if (g >= 3) return { id: 'amphibolite', comp };
    return { reason: 'Greenschist is already low grade. Try medium or high grade to turn it into amphibolite.' };
  }
  if (m.family === 'intrusive' || m.family === 'extrusive') {
    if (comp === 'felsic') {
      if (g === 4) return { id: 'gneiss', comp: 'felsic' };
      const glass = id === 'obsidian' || id === 'pumice';
      return { reason: glass
        ? `Heating slowly turns volcanic glass into tiny crystals, but in this model ${the(id)} only becomes a new rock at high grade, when it turns into gneiss.`
        : `${The(id)} is made of quartz and feldspar, which barely change at this grade. It takes high grade to turn it into gneiss.` };
    }
    return { id: g <= 2 ? 'greenschist' : 'amphibolite', comp };
  }
  return { reason: `${The(id)} isn’t solid rock yet.` };
}

/**
 * Applies one step. state: { id, place, comp, from? }. Returns { ok: true, state } or { ok: false, reason }.
 * Only geologically sound changes are allowed; every refusal explains why in plain words.
 */
export function apply(state, code) {
  const o = OPTION_BY_CODE[code];
  if (!o) return { ok: false, reason: `“${code}” isn’t a process here.` };
  const { id, place, comp } = state;
  const m = MATERIALS[id];
  const fam = m.family;
  const fail = reason => ({ ok: false, reason });
  const ok = next => ({ ok: true, state: next });
  const notRockYet = fam === 'sediment' ? `${The(id)} ${m.layer ? 'are' : 'is'} loose, not solid rock yet.` : '';

  switch (o.process) {
    case 'cool': {
      if (fam === 'sediment') return fail(`${notRockYet} Only magma can cool and crystallize.`);
      if (fam !== 'magma') return fail(`${The(id)} is already solid. Only magma can cool and crystallize.`);
      const product = COOLING[code][comp];
      if (!product) {
        return fail(comp === 'mafic'
          ? 'Runny basaltic lava grows crystals even when it cools fast. It makes glass only as thin crusts and threads, so this model doesn’t make obsidian from it. Obsidian comes from silica-rich lava.'
          : 'Obsidian comes from thick, silica-rich lava. Andesitic lava usually grows tiny crystals instead, so this model doesn’t make glass from it.');
      }
      return ok({ id: product, place: code === 'cs' ? 'pluton' : 'volcano', comp });
    }
    case 'uplift': {
      if (fam === 'magma') return fail('Magma rises on its own and reaches the surface by erupting. Try Cooling: quickly, as lava at the surface.');
      if (fam === 'sediment') return fail(`${The(id)} ${m.layer ? 'are' : 'is'} already at the surface.`);
      if (PLACES[place].surface) return fail(`${The(id)} is already at the surface.`);
      return ok({ id, place: 'land', comp });
    }
    case 'weather': {
      if (fam === 'magma') return fail('Magma is molten and underground. It has to cool into rock, and that rock must reach the surface, before it can be weathered.');
      if (id === 'sediment') return fail('The sediment is already loose grains on the move. Try Deposition to let it settle.');
      if (!PLACES[place].surface) return fail(`${The(id)} is ${PLACES[place].short}, out of reach of rain, ice and wind. Uplift and exposure must bring it to the surface first.`);
      return ok({ id: 'sediment', place: 'stream', comp: null, from: m.layer ? state.from ?? null : id });
    }
    case 'deposit': {
      if (id !== 'sediment') {
        if (fam === 'sediment') return fail(`${The(id)} have already settled. Try Compaction and cementation to turn them into rock.`);
        if (fam === 'magma') return fail('Magma can’t settle in layers. Only loose sediment can be deposited.');
        return fail(`${The(id)} is solid rock. It must be weathered and eroded into loose grains before they can be deposited.`);
      }
      const [layer, at] = DEPOSITS[code];
      return ok({ id: layer, place: at, comp: null, from: state.from ?? null });
    }
    case 'lithify': {
      if (!m.layer) {
        if (id === 'sediment') return fail('The sediment is still moving. It has to settle in layers first: try Deposition.');
        if (fam === 'magma') return fail('Magma doesn’t turn into rock by being squeezed. It has to cool.');
        return fail(`${The(id)} is already solid rock. Only loose layers of sediment are compacted and cemented.`);
      }
      const rock = LITHIFIED[id];
      return ok({ id: rock, place: 'buried', comp: MATERIALS[rock].comp });
    }
    case 'meta': {
      if (fam === 'magma') return fail('Magma is molten. It has to cool into rock before heat and pressure can change it.');
      if (fam === 'sediment') return fail(`${notRockYet} It has to be buried and cemented into rock first.`);
      const r = metamorphose(state, o.grade);
      if (r.reason) return fail(r.reason);
      return ok({ id: r.id, place: `meta${o.grade}`, comp: r.comp });
    }
    case 'melt': {
      if (fam === 'magma') return fail(`${The(id)} is already molten.`);
      if (fam === 'sediment') return fail(`${notRockYet} It has to be buried and turned into rock first.`);
      if (comp === 'quartz') return fail(`${The(id)} is almost pure quartz, which melts only above about 1,700 °C, far hotter than the crust gets. Try heat and pressure, or weathering.`);
      if (comp === 'carbonate') return fail(`${The(id)} is calcite, which needs far more heat to melt than the crust reaches. Try heat and pressure, or weathering.`);
      return ok({ id: magmaOf(comp), place: `melt-${comp}`, comp });
    }
  }
  return fail('Unknown process.');
}

/** Where a journey begins: a start material sitting where it forms. */
export function startState(id) {
  const m = MATERIALS[id];
  if (!m) throw new Error(`Unknown material ${id}`);
  const code = m.formedBy;
  const o = OPTION_BY_CODE[code];
  let place;
  if (o.process === 'melt') place = `melt-${m.comp}`;
  else if (o.process === 'cool') place = code === 'cs' ? 'pluton' : 'volcano';
  else if (o.process === 'deposit') place = DEPOSITS[code][1];
  else if (o.process === 'weather') place = 'stream';
  else if (o.process === 'lithify') place = 'buried';
  else place = `meta${o.grade}`;
  return { id, place, comp: m.comp ?? null };
}

/**
 * Replays a journey. Returns { start, states: [start, after step 1, …], steps: [{ code, from, to }],
 * stoppedAt (index of the first step that couldn't happen, or -1), reason }.
 */
export function replay(startId, codes) {
  const start = startState(startId);
  const states = [start], steps = [];
  for (let i = 0; i < codes.length; i++) {
    const r = apply(states[i], codes[i]);
    if (!r.ok) return { start, states, steps, stoppedAt: i, reason: r.reason };
    steps.push({ code: codes[i], from: states[i], to: r.state });
    states.push(r.state);
  }
  return { start, states, steps, stoppedAt: -1, reason: '' };
}

/** Which options can happen to a state right now: code → { ok, reason }. */
export function options(state) {
  return Object.fromEntries(CODES.map(code => {
    const r = apply(state, code);
    return [code, r.ok ? { ok: true, to: r.state } : { ok: false, reason: r.reason }];
  }));
}

// ---------- Conditions for each step ----------
const ENERGY = {
  sun: 'Sunlight drives the weather and the water cycle; gravity pulls water, ice and grains downhill',
  inside: 'Earth’s internal heat',
};
const thousands = n => Math.round(n).toLocaleString('en-US');
/** Rounds to two significant figures (4,182 → 4,200). */
export const twoSig = n => (n === 0 ? 0 : Number(n.toPrecision(2)));
// Units keep to their number: a leading space in `unit` becomes a non-breaking space.
export const fmtRange = ([a, b], unit = '') => { const u = unit.replace(/^ /, '\u00a0'); return a === b ? `${thousands(a)}${u}` : `${thousands(a)}–${thousands(b)}${u}`; };
export const fmtNum = (n, d = 0) => String(Number(n.toFixed(d)));

/**
 * The conditions of the step that produced `to` from `from` by `code` (or, with no `from`, of the step that
 * formed a starting material). Every number is a rough classroom range.
 * Returns { process, option, where, depth: [km, km], temp: [°C, °C] | null, tempText, pressure, time, energy }.
 */
export function conditions(code, to, from = null) {
  const o = OPTION_BY_CODE[code];
  const place = PLACES[to.place];
  const c = { code, process: PROCESS_BY_ID[o.process].name, option: o.short, where: place.name, depth: [...place.depth], temp: null, tempText: '', time: '', energy: '' };
  const surface = 'Surface temperatures, like the weather';
  switch (o.process) {
    case 'cool': {
      c.temp = [...MELT_C[to.comp]];
      if (code === 'cs') {
        c.where = 'Underground, in a chamber of magma';
        c.tempText = `Magma at about ${fmtRange(c.temp, ' °C')} cools slowly`;
        c.time = 'Thousands to millions of years, so big crystals have time to grow';
        c.energy = 'Heat flows out of the magma into the cooler rock around it';
      } else {
        c.where = { cf: 'At the surface, as a lava flow', cg: 'At the surface, as a thick, sticky lava flow', cv: 'At the surface, in a gas-rich eruption' }[code];
        c.tempText = `Lava at about ${fmtRange(c.temp, ' °C')} cools to air temperature`;
        c.time = { cf: 'Hours to a few years: too fast for big crystals', cg: 'Faster than crystals can grow', cv: 'Seconds to minutes, as gas froths the lava' }[code];
        c.energy = 'Heat escapes from the lava into the air, water and ground';
      }
      break;
    }
    case 'uplift': {
      const km = from ? midDepth(from.place) : 0;
      c.where = 'Brought up to the surface, as mountains rise and erosion strips away the rock above';
      c.depth = [0, 0];
      c.tempText = 'Cools as it rises, ending at surface temperatures';
      c.time = `About ${fmtNum(upliftMyr(km))} million years to rise ${fmtNum(km)} km at ${UPLIFT_MM_PER_YR} mm per year`;
      c.upliftKm = km;
      c.energy = 'Earth’s internal heat drives the plate motions that build mountains; erosion, driven by the Sun, uncovers the rock';
      break;
    }
    case 'weather':
      c.where = 'At the surface';
      c.tempText = surface;
      c.time = 'Years to millions of years';
      c.energy = ENERGY.sun;
      break;
    case 'deposit':
      c.where = { dg: 'A fast-flowing river or mountain stream', ds: 'A beach, sandbar or dune', dm: 'Quiet water: a lake, lagoon or the deep sea floor', dc: 'A warm, clear, shallow sea' }[code];
      c.tempText = surface;
      c.time = 'Years to thousands of years for each layer';
      c.energy = code === 'dc'
        ? 'Living things build the shells, with energy that comes from the Sun through their food'
        : 'Gravity: grains settle when the water or wind carrying them slows down';
      break;
    case 'lithify':
      c.temp = place.depth.map(tempAtDepthC);
      c.tempText = `About ${fmtRange(c.temp, ' °C')}`;
      c.time = 'Thousands to millions of years';
      c.energy = 'Gravity: the weight of the layers above squeezes the grains, and minerals in the water glue them';
      break;
    case 'meta': {
      const g = GRADES[o.grade - 1];
      c.temp = [...g.temp];
      c.tempText = `About ${fmtRange(c.temp, ' °C')} (${g.name.toLowerCase()})`;
      c.time = 'Millions of years';
      c.energy = 'Earth’s internal heat, plus squeezing as plates push together';
      break;
    }
    case 'melt':
      c.temp = [...MELT_C[to.comp]];
      c.tempText = `About ${fmtRange(c.temp, ' °C')} for ${COMP_NAMES[to.comp].toLowerCase()} rock`;
      c.time = 'Thousands to millions of years';
      c.energy = ENERGY.inside;
      break;
  }
  if (!c.tempText) c.tempText = c.temp ? `About ${fmtRange(c.temp, ' °C')}` : surface;
  c.pressure = c.depth.map(km => twoSig(pressureAtm(km)));
  c.pressureText = c.depth[1] === 0 ? 'Air pressure at the surface' : `About ${fmtRange(c.pressure.map(p => Math.max(1, p)))} times the air pressure at sea level`;
  c.depthText = c.depth[1] === 0 ? 'At the surface' : `About ${fmtRange(c.depth)} km down`;
  return c;
}
/** Conditions for the step that made a starting material. */
export const startConditions = start => conditions(MATERIALS[start.id].formedBy, start);

// ---------- Shortest routes ----------
const key = s => `${s.id}|${s.place}|${s.comp}`;
/** Breadth-first search: the fewest steps from a start material to any state of `goalId`. */
export function shortestPath(startId, goalId) {
  const start = startState(startId);
  if (start.id === goalId) return [];
  const seen = new Map([[key(start), null]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const code of CODES) {
        const r = apply(s, code);
        if (!r.ok || seen.has(key(r.state))) continue;
        seen.set(key(r.state), { prev: key(s), code });
        if (r.state.id === goalId) {
          const path = [];
          for (let k = key(r.state); seen.get(k); k = seen.get(k).prev) path.unshift(seen.get(k).code);
          return path;
        }
        next.push(r.state);
      }
    }
    frontier = next;
  }
  return null;
}
/** Every material reachable from a start (used by tests: the cycle has no dead ends). */
export function reachable(startId) {
  const start = startState(startId);
  const seen = new Set([key(start)]), ids = new Set([start.id]);
  const queue = [start];
  while (queue.length) {
    const s = queue.shift();
    for (const code of CODES) {
      const r = apply(s, code);
      if (r.ok && !seen.has(key(r.state))) { seen.add(key(r.state)); ids.add(r.state.id); queue.push(r.state); }
    }
  }
  return ids;
}

// ---------- Challenge ----------
// build: start from a material and reach the goal (fewest: only a route with the fewest steps scores).
// choice: pick an answer; texture questions show a rock card's drawing without its name.
export const FAMILY_CHOICES = ['intrusive', 'extrusive', 'sedimentary', 'metamorphic'];
const meltThenFast = (() => { const r = replay('granite', ['me', 'cf']); return r.states.at(-1).id; })();
export const CHALLENGE = [
  {
    kind: 'build', start: 'mafic-magma', goal: 'marble', fewest: false,
    prompt: 'Turn magma into marble.',
    help: 'Start from basaltic magma. Apply processes until you have marble. Any route counts.',
    explain: 'Marble is metamorphosed limestone, and limestone forms from shells in a warm sea. The shells are built from calcium that weathering dissolves out of rock. So the magma must cool, reach the surface, be weathered, settle as shells, be cemented into limestone, and then be heated and squeezed.',
  },
  {
    kind: 'choice', prompt: 'Which process makes foliation, where minerals line up in flat layers or bands?',
    choices: ['meta', 'lithify', 'cool', 'deposit'], answer: 'meta', choiceNames: true,
    explain: 'Heat and pressure. Squeezing from one direction makes flat minerals like mica grow lined up, as in slate, schist and gneiss. Layers made by deposition are called bedding, not foliation.',
  },
  {
    kind: 'texture', show: 'gneiss', prompt: 'Which rock family has this texture?', choices: FAMILY_CHOICES, answer: 'metamorphic',
    describe: 'A rock with wavy stripes: light bands of pale crystals alternating with dark bands.',
    explain: 'Light and dark minerals separated into bands: that is gneiss, a high-grade metamorphic rock.',
  },
  {
    kind: 'build', start: 'granite', goal: 'slate', fewest: true,
    prompt: 'Make slate from granite in the fewest steps.',
    help: 'Start from granite, deep underground. Slate is made from shale, so think about how granite could become mud first.',
    explain: 'Granite can’t become slate directly: slate forms from fine mud. The granite must be uplifted, weathered into sediment, settle as mud, be cemented into shale, and then be squeezed at very low or low grade.',
  },
  {
    kind: 'texture', show: 'scoria', prompt: 'Which rock family has this texture?', choices: FAMILY_CHOICES, answer: 'extrusive',
    describe: 'A dark red-brown rock full of round holes, like a sponge.',
    explain: 'The holes are gas bubbles trapped as lava cooled fast at the surface: scoria, an extrusive igneous rock.',
  },
  {
    kind: 'choice', prompt: 'You melt granite, then let the magma cool quickly as lava at the surface. Which rock forms?',
    choices: ['basalt', 'rhyolite', 'gabbro', 'granite'], answer: meltThenFast,
    explain: 'Melting granite makes silica-rich magma, so it can’t make basalt. Cooling quickly at the surface gives tiny crystals: rhyolite, with the same minerals as granite.',
  },
  {
    kind: 'texture', show: 'conglomerate', prompt: 'Which rock family has this texture?', choices: FAMILY_CHOICES, answer: 'sedimentary',
    describe: 'Rounded pebbles of different colors held together in a sandy background.',
    explain: 'Rounded pebbles glued together by natural cement: conglomerate, a sedimentary rock made from river gravel.',
  },
  {
    kind: 'choice', prompt: 'Which energy source drives weathering and erosion?',
    choices: ['sun', 'inside', 'moon', 'magma'], answer: 'sun',
    choiceText: { sun: 'Energy from the Sun (with gravity)', inside: 'Heat from Earth’s interior', moon: 'The Moon’s pull on the tides', magma: 'Heat from nearby magma' },
    explain: 'Sunlight drives the weather and the water cycle: rain, ice and wind break rock, and gravity moves the pieces downhill. Earth’s internal heat drives melting, metamorphism and mountain building.',
  },
];
/** The fewest steps for each build question, from the search above. */
export const challengePar = q => shortestPath(q.start, q.goal).length;
/** The text shown on a challenge answer button. */
export function choiceLabel(q, choice) {
  if (q.choiceText) return q.choiceText[choice];
  if (q.choiceNames) return PROCESS_BY_ID[choice].name;
  if (q.kind === 'texture') return FAMILY_NAMES[choice];
  return MATERIALS[choice].name;
}
