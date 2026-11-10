// The Plate Boundaries Map model: a hand-built, simplified world map of the major tectonic plates and the
// boundaries between them, with curated examples of large earthquakes and well-known volcanoes.
// Pure and deterministic: the server render, the browser and the tests all call these same functions.
//
// What this is, and is not:
// - The boundaries are a SIMPLIFIED SCHEMATIC drawn for this lab, not a plate model. Each line is a
//   few points (longitude, latitude in degrees) placed from well-known geography: trenches a little
//   offshore of the coasts and island arcs they follow, ridges through the islands and vent fields that sit
//   on them (Iceland, the Azores, the Galápagos Rift), faults through the towns and lakes they cross.
//   Lines can be a degree or two (100–200 km) from the true position. Small plates and the complicated
//   zones of Southeast Asia, the southwest Pacific and the Mediterranean are merged or smoothed, and
//   every boundary is given one type although real boundaries change along their length.
//   For research-grade boundaries see Bird, P. (2003), "An updated digital model of plate boundaries",
//   Geochemistry, Geophysics, Geosystems 4(3), 1027 (the PB2002 model). No data from it is used here.
// - Boundary types follow standard references: USGS, "This Dynamic Earth: the story of plate tectonics"
//   (Kious and Tilling) and its map of the plates, and Earle, S. (2019) Physical Geology, 2nd ed., ch. 10.
// - Earthquakes and volcanoes are well-known EXAMPLES, not a catalog. Magnitudes and epicenters are
//   rounded values from the USGS earthquake catalog; volcano positions are rounded summit locations as
//   listed by the Smithsonian Global Volcanism Program. Which boundary each one belongs to is not typed in:
//   it is worked out here as the nearest boundary line, and the tests check the distances.
// - Land outlines are Natural Earth data (see plate-map-land.mjs).
import { CASES, CASE_KEYS, TYPE_NAMES, caseTitle } from './plates.mjs';

// ---------- Plates ----------
// `label` is where the name is drawn on the world map; a plate that the map's edge cuts in two has a second
// one, `label2`. `alt` lists other spots on the plate, used in close-ups where the main label is out of view.
export const PLATES = [
  { id: 'pacific', name: 'Pacific Plate', label: [-150, 12], label2: [168, 18], alt: [[-135, 32], [-120, -22]], about: 'The largest plate, almost all ocean floor. Trenches and volcanoes ring most of its edge: the Ring of Fire.' },
  { id: 'namerica', name: 'North American Plate', label: [-98, 50], alt: [[-112, 46], [150, 53]], about: 'North America, Greenland, the western half of the North Atlantic floor and, on this map, the far east of Siberia.' },
  { id: 'samerica', name: 'South American Plate', label: [-55, -12], about: 'South America and the western half of the South Atlantic floor. The Nazca Plate sinks under its western edge and lifts the Andes.' },
  { id: 'eurasia', name: 'Eurasian Plate', label: [85, 55], alt: [[20, 46], [88, 40], [118, 44], [105, 16]], about: 'Europe and most of Asia, plus the eastern half of the North Atlantic floor north of the Azores.' },
  { id: 'africa', name: 'African Plate', label: [18, 8], alt: [[27, 13], [8, 28]], about: 'Africa and the ocean floor around it. It is splitting along the East African Rift; the part east of the rift is the Somali Plate.' },
  { id: 'somali', name: 'Somali Plate', label: [51, -6], small: true, about: 'Eastern Africa and the floor of the western Indian Ocean, slowly pulling away from the rest of Africa along the East African Rift.' },
  { id: 'antarctic', name: 'Antarctic Plate', label: [60, -68], label2: [-125, -68], alt: [[-98, -54]], about: 'Antarctica and the Southern Ocean floor around it. Mid-ocean ridges surround almost all of it.' },
  { id: 'indoaus', name: 'Indo-Australian Plate', label: [112, -27], alt: [[79, 20], [100, -9]], about: 'India, Australia and the ocean floor between them. Many geologists now split it into an Indian Plate and an Australian Plate; this map shows it as one.' },
  { id: 'nazca', name: 'Nazca Plate', label: [-92, -20], about: 'Ocean floor west of South America. It forms at the East Pacific Rise and sinks into the Peru–Chile Trench.' },
  { id: 'cocos', name: 'Cocos Plate', label: [-96, 8.5], small: true, about: 'A small ocean plate west of Central America. It sinks into the Middle America Trench and feeds the volcanoes of Mexico and Central America.' },
  { id: 'caribbean', name: 'Caribbean Plate', label: [-73, 15], small: true, about: 'The floor of the Caribbean Sea and most of Central America. Transform faults bound it to the north and south, subduction zones to the east and west.' },
  { id: 'arabia', name: 'Arabian Plate', label: [46.5, 23], small: true, about: 'The Arabian Peninsula. It is pulling away from Africa at the Red Sea and pushing into Eurasia at the Zagros Mountains.' },
  { id: 'philippine', name: 'Philippine Sea Plate', label: [133, 17], small: true, about: 'Ocean floor between the Philippines and the Mariana Islands, with subduction zones on almost every side. On this map it includes the Philippine islands.' },
  { id: 'juandefuca', name: 'Juan de Fuca Plate', label: [-127.6, 46.3], small: true, about: 'A small ocean plate off the Pacific Northwest, sinking under North America at the Cascadia subduction zone.' },
  { id: 'scotia', name: 'Scotia Plate', label: [-50, -57.3], small: true, about: 'A small ocean plate between South America and Antarctica, with long transform faults on its north and south sides.' },
];
export const PLATE_IDS = PLATES.map(p => p.id);
export const plateById = id => PLATES.find(p => p.id === id);
export const plateName = id => plateById(id).name;

// ---------- Boundaries ----------
export const TYPES = ['divergent', 'convergent', 'transform', 'zone'];
export const TYPE_LABELS = { divergent: 'Divergent', convergent: 'Convergent', transform: 'Transform', zone: 'Wide boundary zone' };
export const TYPE_MOTION = {
  divergent: 'plates move apart',
  convergent: 'plates move together',
  transform: 'plates slide past each other',
  zone: 'no single clear line',
};
// What kind of feature a boundary is, the boundary type it belongs to, and the matching cross-section in
// the Plate Tectonics Explorer.
export const KINDS = {
  ridge: { type: 'divergent', explorer: 'divergent-oo', what: 'A mid-ocean ridge. The plates move apart, magma rises into the gap and new sea floor forms.' },
  rift: { type: 'divergent', explorer: 'divergent-cc', what: 'A continental rift. The continent is being stretched and pulled apart, and may one day split to make a new ocean.' },
  trench: { type: 'convergent', explorer: 'convergent-oc', what: 'A subduction zone. One plate sinks under the other at a deep ocean trench, with a line of volcanoes above it.' },
  arc: { type: 'convergent', explorer: 'convergent-oo', what: 'A subduction zone between two ocean plates. One sinks under the other at a deep trench, and volcanoes build a curved chain of islands.' },
  collision: { type: 'convergent', explorer: 'convergent-cc', what: 'A collision zone. Two continents push together; neither sinks far, so the crust crumples into high mountains.' },
  fault: { type: 'transform', explorer: 'transform-cc', what: 'A transform boundary on land. The plates slide sideways past each other along a long fault.' },
  fracture: { type: 'transform', explorer: 'transform-oo', what: 'A transform boundary under the sea. The plates slide sideways past each other.' },
  zone: { type: 'zone', explorer: null, what: 'A wide zone of slow movement where geologists do not agree on one clear boundary line.' },
};
for (const kind of Object.values(KINDS)) if (kind.explorer && !CASE_KEYS.includes(kind.explorer)) throw new Error(`No cross-section ${kind.explorer} in the explorer`);

// Places where boundaries meet, so that the lines join exactly.
const J = {
  azores: [-29.7, 39.4], bouvet: [-1, -55], rodrigues: [70, -25.5], macquarie: [161, -61.5], afar: [42, 11.6], aqaba: [34.5, 28],
  maras: [36.8, 37.2], owen: [58, 12.8], makran: [66.3, 25.2], pamir: [70.5, 34], syntaxis: [96.8, 28.2], newGuinea: [134.5, -1],
  taiwan: [121.4, 23], boso: [141.8, 34.4], fuji: [138.7, 35.1], kamchatka: [164.3, 54.8], yakutat: [-144, 59.8], explorer: [-130.5, 50.8],
  mendocino: [-124.6, 40.3], gorda: [-127.5, 40.4], salton: [-115.7, 33.2], rivera: [-105.3, 18.3], galapagos: [-102.2, 2.2],
  panamaNorth: [-82.9, 7.3], panamaSouth: [-82.9, 3.2], panama: [-77.9, 7.3], chile: [-76, -46.2], easter: [-110.5, -35],
  magallanes: [-76, -52.5], sandwichNorth: [-29.5, -55], sandwichSouth: [-28.5, -61], shackleton: [-57, -60.9], motagua: [-93.2, 13.8],
  anegada: [-63, 19.4], antilles: [-58.9, 15.6], trinidad: [-61.2, 10.6], atlantic15: [-46.3, 15.3], tonga: [-173.2, -15.2],
  hunter: [172, -23], cook: [174.3, -41.9], puysegur: [166.6, -45.6], laptev: [127, 78], rungwe: [33.7, -9.1],
  gloriaWest: [-24, 37.3], gloriaEast: [-13, 36.7],
};
const east = ([lon, lat]) => [lon + 360, lat]; // the same place, written east of the 180° line
const west = ([lon, lat]) => [lon - 360, lat];

// Each boundary: id, name, kind, the two plates, and for a subduction zone `under`, the plate that sinks.
// Points may run past 180° (for example 186.8 for 173.2°W) so that a line can cross the date line.
export const BOUNDARIES = [
  // --- Atlantic and Arctic ---
  { id: 'gakkel', name: 'Gakkel Ridge', kind: 'ridge', plates: ['namerica', 'eurasia'], pts: [[112, 82], [120, 80.5], J.laptev], note: 'The Arctic end of the ridge system. It crosses the Arctic Ocean and joins the ridge north of Iceland beyond the top of this map.' },
  { id: 'mar-north', name: 'Mid-Atlantic Ridge (Arctic to the Azores)', kind: 'ridge', plates: ['namerica', 'eurasia'], pts: [[-3, 82], [3, 79.8], [7.5, 78], [8, 75], [6.5, 73.5], [0, 72.3], [-6, 71.3], [-12, 70.8], [-15, 69], [-17.5, 67], [-17, 66.2], [-16.8, 65.6], [-17.5, 64.6], [-19.3, 64], [-21.3, 64.1], [-22.7, 63.8], [-25, 62.5], [-28, 60.5], [-31, 58], [-33.5, 56], [-35, 53], [-35, 52.6], [-31, 52.2], [-30, 50], [-28.5, 47.5], [-27.5, 45], [-28.5, 43], [-29.5, 41], J.azores], note: 'The ridge comes above sea level in Iceland, where you can walk between the two plates.' },
  { id: 'mar-central', name: 'Mid-Atlantic Ridge (central Atlantic)', kind: 'ridge', plates: ['namerica', 'africa'], pts: [J.azores, [-31, 38], [-32.3, 37.3], [-33.9, 36.2], [-36, 35], [-38.5, 33.7], [-42, 30], [-44.8, 26], [-45, 23.4], [-45.8, 20], [-46.6, 16.5], J.atlantic15] },
  { id: 'mar-south', name: 'Mid-Atlantic Ridge (South Atlantic)', kind: 'ridge', plates: ['samerica', 'africa'], pts: [J.atlantic15, [-45, 14], [-43.5, 11], [-40.9, 10.5], [-38, 8], [-34, 6], [-31, 3.5], [-29.3, 0.9], [-24.5, 0.3], [-16.5, -0.8], [-13.5, -2], [-12.5, -5], [-13.5, -8], [-13.5, -12], [-14.3, -16], [-13, -20], [-13.5, -24], [-14, -28], [-14.5, -32], [-15.5, -35.5], [-17, -38], [-16.5, -41], [-15, -45], [-11, -48.5], [-8, -51], [-4, -53.5], J.bouvet], note: 'South America and Africa fit together like puzzle pieces because they were joined before this ridge opened the South Atlantic.' },
  { id: 'na-sa', name: 'North America–South America boundary zone', kind: 'zone', plates: ['namerica', 'samerica'], pts: [J.atlantic15, [-52, 15.6], J.antilles], note: 'The two American plates move so little against each other that there is no sharp boundary here.' },
  { id: 'terceira', name: 'Terceira Rift (Azores)', kind: 'ridge', plates: ['eurasia', 'africa'], pts: [J.azores, [-27, 38.4], J.gloriaWest], note: 'A short, very slow rift through the Azores islands, which are volcanoes built along it.' },
  { id: 'gloria', name: 'Gloria Fault', kind: 'fracture', plates: ['eurasia', 'africa'], pts: [J.gloriaWest, [-20, 37], [-15, 36.9], J.gloriaEast] },
  { id: 'america-antarctic', name: 'American–Antarctic Ridge', kind: 'ridge', plates: ['samerica', 'antarctic'], pts: [J.sandwichSouth, [-22, -60.3], [-16, -59.5], [-10, -58.2], [-5, -56.5], J.bouvet] },
  // --- Mediterranean and Middle East ---
  { id: 'mediterranean', name: 'Mediterranean boundary (Gibraltar to Cyprus)', kind: 'trench', plates: ['africa', 'eurasia'], under: 'africa', pts: [J.gloriaEast, [-11, 36.3], [-7.5, 36], [-5.6, 35.95], [-2, 35.6], [1.5, 36.3], [5, 36.9], [9, 37.4], [11.5, 37.6], [13.5, 38.1], [15.6, 38.2], [17.2, 37.4], [19.5, 36.2], [21, 35.6], [22.5, 34.7], [25, 34.2], [27.5, 34.8], [29, 35.6], [30.5, 35.6], [32, 34.4], [34, 34.5], [35.6, 35.9], J.maras], note: 'Africa is moving north into Europe. Ocean floor still sinks under southern Italy and Greece, which is why Etna, Vesuvius and Santorini are here. Farther west and north the continents have collided and raised the Alps. The great Lisbon earthquake of 1755 struck near its western end. The real boundary is a tangle of small plates.' },
  { id: 'dead-sea', name: 'Dead Sea Transform', kind: 'fault', plates: ['arabia', 'africa'], pts: [J.aqaba, [35, 29.6], [35.5, 31.5], [35.6, 33], [36.2, 34.5], [36.4, 36], J.maras], note: 'The Dead Sea and the Jordan Valley lie along this fault.' },
  { id: 'red-sea', name: 'Red Sea Rift', kind: 'rift', plates: ['arabia', 'africa'], pts: [J.aqaba, [36.3, 24], [38, 21], [39.8, 18], [41.2, 15.5], [41.9, 14.6], [42.3, 13.3], J.afar], note: 'A rift that has already flooded: Arabia has pulled away from Africa and new sea floor is forming down the middle of the Red Sea.' },
  { id: 'aden', name: 'Gulf of Aden ridge', kind: 'ridge', plates: ['arabia', 'somali'], pts: [J.afar, [43.3, 11.8], [45, 12], [48, 12.8], [51, 13.5], [54, 14.5], [56.5, 14.2], J.owen] },
  { id: 'owen', name: 'Owen Fracture Zone', kind: 'fracture', plates: ['arabia', 'indoaus'], pts: [J.owen, [59.5, 15.5], [61, 19], [62.5, 22], [64.5, 24], J.makran] },
  { id: 'makran', name: 'Makran Trench', kind: 'trench', plates: ['arabia', 'eurasia'], under: 'arabia', pts: [J.makran, [64, 24.3], [61.5, 24.2], [59, 24.6], [57.3, 25.6], [56.4, 27]] },
  { id: 'zagros', name: 'Zagros collision zone', kind: 'collision', plates: ['arabia', 'eurasia'], pts: [[56.4, 27], [54.5, 28], [52.5, 29.6], [50.5, 31.3], [48.5, 33], [46.8, 34.6], [45.2, 36], [43.8, 37.4], [41.5, 38.2], [39, 38], J.maras], note: 'Arabia pushing into Eurasia has folded the rocks of the Zagros Mountains in Iran.' },
  // --- Africa ---
  { id: 'ear-east', name: 'East African Rift (eastern branch)', kind: 'rift', plates: ['africa', 'somali'], pts: [J.afar, [40.2, 9.5], [39.2, 8.3], [38.5, 7], [37.8, 6.2], [36.8, 4.8], [36.1, 3.4], [36.1, 0.6], [36.3, -1.5], [36, -2.6], [35.8, -3.7], [35.6, -6], [34.6, -7.8], J.rungwe], note: 'A plate boundary in the making. The rift valleys of Ethiopia, Kenya and Tanzania, with Kilimanjaro and other volcanoes beside them, show a continent being pulled apart.' },
  { id: 'ear-west', name: 'East African Rift (western branch)', kind: 'rift', plates: ['africa', 'somali'], pts: [[31.3, 2.8], [30.6, 1.4], [29.8, 0.2], [29.5, -1], [29.2, -2], [29.2, -3.6], [29.6, -5.5], [30.5, -7.5], [31.6, -8.3], [32.5, -8.6], J.rungwe], note: 'The long, deep lakes Albert, Edward, Kivu and Tanganyika fill this branch of the rift.' },
  { id: 'ear-malawi', name: 'East African Rift (Lake Malawi)', kind: 'rift', plates: ['africa', 'somali'], pts: [J.rungwe, [34.2, -10.5], [34.5, -12.5], [34.8, -14.2], [35, -16], [34.7, -18], [34.5, -20], [34.2, -21.5]], note: 'The rift fades out southward in Mozambique: the boundary is still growing.' },
  // --- Indian Ocean ---
  { id: 'carlsberg', name: 'Carlsberg and Central Indian ridges', kind: 'ridge', plates: ['indoaus', 'somali'], pts: [J.owen, [57.5, 10.3], [60, 7.5], [62.5, 5], [65, 3], [67, 1.5], [67.5, -1], [68, -4], [67, -8], [66.5, -12], [66, -15.5], [65.8, -19], [67.5, -22.5], J.rodrigues] },
  { id: 'swir', name: 'Southwest Indian Ridge', kind: 'ridge', plates: ['africa', 'antarctic'], pts: [J.bouvet, [5, -54], [10, -53.2], [15, -52.5], [20, -53], [25, -53.2], [28.5, -53.3], [30.5, -50], [32.5, -47.3], [35, -45.2], [38.5, -44.5], [42.5, -41], [46, -39.5], [49.6, -37.8], [52, -36.5], [55, -34.5], [57, -32.8], [60.7, -30], [64, -28], [67, -26.8], J.rodrigues], note: 'One of the slowest-spreading ridges on Earth. Its eastern half borders the Somali Plate.' },
  { id: 'seir', name: 'Southeast Indian Ridge', kind: 'ridge', plates: ['indoaus', 'antarctic'], pts: [J.rodrigues, [72.5, -27.5], [75, -31], [77.5, -36], [78, -38.5], [80.5, -41], [85, -41.8], [90, -43], [96, -45.5], [101, -47.8], [106, -49], [112, -50], [118, -49.8], [124, -49.5], [130, -50], [135, -50.5], [140, -51.5], [143, -54], [147, -56.5], [152, -59], [156, -60.5], J.macquarie], note: 'Australia has been moving north, away from Antarctica, since this ridge opened.' },
  // --- India and Southeast Asia ---
  { id: 'chaman', name: 'Chaman Fault', kind: 'fault', plates: ['indoaus', 'eurasia'], pts: [J.makran, [66.4, 27.5], [66.8, 29.8], [67.6, 31.5], [69, 33.2], J.pamir] },
  { id: 'himalaya', name: 'Himalayan collision zone', kind: 'collision', plates: ['indoaus', 'eurasia'], pts: [J.pamir, [72.2, 34.2], [73.5, 34.3], [74.4, 33.2], [75.6, 32.3], [76.8, 30.8], [78.2, 30.1], [80, 28.9], [81.6, 28.3], [83.5, 27.6], [85.3, 27.1], [87, 26.7], [88.5, 26.8], [90.5, 26.8], [92.5, 26.9], [94, 27.3], [95.5, 28.1], J.syntaxis], note: 'India has been pushing into Asia for about 50 million years. The collision built the Himalaya and the Tibetan Plateau, with large earthquakes but almost no volcanoes.' },
  { id: 'sunda', name: 'Sunda Trench (Myanmar to Timor)', kind: 'trench', plates: ['indoaus', 'eurasia'], under: 'indoaus', pts: [J.syntaxis, [95.8, 27.2], [94, 26], [93.2, 24.5], [92.5, 22.8], [92.6, 21], [93.2, 19.3], [93.6, 17.5], [93.2, 15.5], [92.3, 13], [92, 11], [92.1, 9], [92.6, 7], [93.4, 5], [94.6, 3.3], [96, 1.3], [97.5, -1], [99, -3.2], [100.5, -5], [102.3, -6.8], [104.5, -8.2], [107.5, -9.8], [110, -10.5], [113, -11], [116, -11.3], [119, -11.4], [121.5, -11.3], [124, -11.1], [127, -9.9], [130, -9], [132, -8.2], [133.5, -6.8], [134.2, -5], [134, -3.2], J.newGuinea], note: 'The Indo-Australian Plate sinks under Sumatra and Java. This boundary produced the 2004 Indian Ocean earthquake and tsunami and feeds volcanoes such as Krakatau, Merapi and Tambora.' },
  { id: 'new-guinea', name: 'New Guinea, Solomon and Vanuatu trenches', kind: 'arc', plates: ['indoaus', 'pacific'], pts: [J.newGuinea, [136.5, -1.3], [138.5, -1.6], [141, -2.4], [143.5, -3.2], [145.3, -4.6], [146.6, -6], [147.6, -6.9], [149.5, -6.9], [152, -6.6], [153.6, -6.7], [155, -7.6], [157, -9], [159.5, -10.4], [162, -11.6], [164.5, -12], [165.6, -12.6], [165.9, -14], [166.4, -16], [167.4, -18], [168.6, -20], [169.9, -21.6], [171.2, -22.8], J.hunter], note: 'A chain of trenches where the two plates meet. Which plate sinks changes along it, and several small plates are left out here.' },
  { id: 'fiji', name: 'Fiji and Hunter fracture zones', kind: 'fracture', plates: ['indoaus', 'pacific'], pts: [J.hunter, [175, -21], [177, -19.3], [176.6, -17], [178, -15.9], [180, -15.6], [183, -15.2], east(J.tonga)], note: 'A zone of faults and small plates around Fiji, drawn here as one line.' },
  { id: 'tonga', name: 'Tonga–Kermadec Trench', kind: 'arc', plates: ['pacific', 'indoaus'], under: 'pacific', pts: [east(J.tonga), [187.8, -16.5], [187.3, -18.5], [186.7, -20], [185.3, -23.2], [184.3, -26], [183.3, -30], [182.2, -33], [181, -36], [180, -38], [178.8, -40], [176.8, -41.4], J.cook], note: 'The Pacific Plate sinks here faster than at any other trench, about 24 cm a year at the northern end. The trench runs on along the east coast of New Zealand’s North Island.' },
  { id: 'alpine', name: 'Alpine Fault', kind: 'fault', plates: ['indoaus', 'pacific'], pts: [J.cook, [172.6, -42.3], [171.3, -42.9], [170.2, -43.4], [169, -43.95], [167.9, -44.6], J.puysegur], note: 'The fault runs the length of New Zealand’s South Island, along the foot of the Southern Alps.' },
  { id: 'macquarie', name: 'Macquarie Ridge', kind: 'fracture', plates: ['indoaus', 'pacific'], pts: [J.puysegur, [165, -47.5], [163, -49.5], [160.5, -52.5], [158.9, -54.6], [158.5, -57], [159.5, -59.5], J.macquarie] },
  // --- Western Pacific ---
  { id: 'philippine', name: 'Philippine Trench', kind: 'arc', plates: ['philippine', 'eurasia'], under: 'philippine', pts: [J.newGuinea, [131.5, 0.5], [129.6, 2.2], [128.6, 3.6], [127.6, 5.5], [127.2, 7.5], [126.9, 10], [126.3, 12], [125.3, 13.6], [124.2, 15], [123.4, 16.5], [123, 18.5], [122.6, 20.5], [121.9, 22], J.taiwan], note: 'The Philippine islands are squeezed between two trenches that dip toward each other: this one to the east and the Manila Trench to the west.' },
  { id: 'manila', name: 'Manila Trench', kind: 'trench', plates: ['eurasia', 'philippine'], under: 'eurasia', pts: [J.taiwan, [120.7, 22], [119.9, 20.5], [119.3, 18.5], [119.1, 16.5], [119.4, 14.6], [120, 13.3]], note: 'The floor of the South China Sea sinks eastward under Luzon here. Mount Pinatubo stands above it.' },
  { id: 'ryukyu', name: 'Nankai Trough and Ryukyu Trench', kind: 'trench', plates: ['philippine', 'eurasia'], under: 'philippine', pts: [J.boso, [140.3, 34.7], [139.4, 35.1], J.fuji, [138.5, 34.4], [137.3, 33.6], [136, 33], [134.6, 32.3], [133.2, 31.6], [132.3, 30.6], [131.5, 28.8], [130.5, 27], [129.3, 25.3], [127.5, 24.2], [126, 23.5], [124.3, 23.1], [122.6, 23.2], J.taiwan] },
  { id: 'mariana', name: 'Izu–Bonin–Mariana Trench', kind: 'arc', plates: ['pacific', 'philippine'], under: 'pacific', pts: [J.boso, [142.4, 32], [142.9, 30], [143.4, 27.5], [143.7, 25], [144.5, 23], [146, 21], [147.3, 19], [147.8, 17], [147.6, 15], [146.7, 12.9], [145, 11.8], [142.5, 11.3], [140.2, 10.6], [138.7, 9.3], [137.8, 8], [135.2, 7.6], [134.9, 6.5], [134.3, 4.5], [133.8, 2], J.newGuinea], note: 'The Mariana Trench holds the deepest point in the ocean, the Challenger Deep, nearly 11 km down.' },
  { id: 'japan', name: 'Japan and Kuril–Kamchatka trenches', kind: 'trench', plates: ['pacific', 'namerica'], under: 'pacific', pts: [J.boso, [142.9, 36.5], [143.9, 38.5], [144.4, 40], [144.9, 41.2], [146.8, 42.2], [149.3, 43.7], [152.5, 45.6], [155.5, 47.6], [158.3, 49.8], [160.8, 52], [162.8, 53.8], J.kamchatka], note: 'The Pacific Plate sinks under northern Japan and Kamchatka. Many maps give this corner its own small plate, the Okhotsk Plate; here it is part of the North American Plate.' },
  { id: 'ne-asia', name: 'Northeast Asia boundary zone', kind: 'zone', plates: ['namerica', 'eurasia'], pts: [J.laptev, [128.5, 74], [131, 70.5], [136, 67.5], [142, 65], [147, 62.5], [150.5, 60], [148, 57.5], [144.5, 55], [143, 53], [142.8, 50], [142.3, 47], [140.6, 44.5], [139.5, 42.5], [139, 40.5], [138.6, 38.7], [138, 37], [138, 36], J.fuji], note: 'From the Arctic to Japan the two plates meet across a broad belt of slow movement, and maps draw it in different places.' },
  // --- North Pacific and North America ---
  { id: 'aleutian', name: 'Aleutian Trench', kind: 'arc', plates: ['pacific', 'namerica'], under: 'pacific', pts: [J.kamchatka, [167, 54], [170, 53.1], [173, 52], [176, 51.2], [180, 50.5], [184, 50.6], [188, 50.9], [192, 51.8], [196, 52.9], [200, 53.9], [204, 55.2], [208, 56.8], [212, 58.4], [214.5, 59.3], east(J.yakutat)], note: 'The Pacific Plate sinks under Alaska. The 1964 Alaska earthquake, magnitude 9.2, broke the eastern end of this boundary.' },
  { id: 'queen-charlotte', name: 'Queen Charlotte–Fairweather Fault', kind: 'fracture', plates: ['pacific', 'namerica'], pts: [J.yakutat, [-141, 59.9], [-138.6, 59.5], [-137.4, 58.6], [-136.3, 57.4], [-135, 55.5], [-133.6, 54], [-132.4, 52.7], [-131.3, 51.6], J.explorer] },
  { id: 'juan-de-fuca', name: 'Juan de Fuca and Gorda ridges', kind: 'ridge', plates: ['pacific', 'juandefuca'], pts: [J.explorer, [-129.3, 49], [-129, 47.8], [-130, 45.5], [-130.4, 44.5], [-127.6, 43.2], [-127.2, 42], J.gorda] },
  { id: 'cascadia', name: 'Cascadia subduction zone', kind: 'trench', plates: ['juandefuca', 'namerica'], under: 'juandefuca', pts: [J.explorer, [-128.6, 49.8], [-126.8, 48.6], [-125.7, 47], [-125.4, 45], [-125.3, 43], [-125.2, 41.5], J.mendocino], note: 'The Juan de Fuca Plate sinks under the Pacific Northwest and feeds the Cascade volcanoes, such as Mount St. Helens. Its last giant earthquake was in 1700.' },
  { id: 'mendocino', name: 'Mendocino Fracture Zone', kind: 'fracture', plates: ['pacific', 'juandefuca'], pts: [J.gorda, J.mendocino] },
  { id: 'san-andreas', name: 'San Andreas Fault', kind: 'fault', plates: ['pacific', 'namerica'], pts: [J.mendocino, [-123.7, 38.95], [-123, 38.3], [-122.5, 37.7], [-121.5, 36.85], [-120.4, 35.9], [-119.8, 35.2], [-118.9, 34.8], [-118.1, 34.55], [-117.45, 34.3], [-116.2, 33.7], J.salton], note: 'Los Angeles, on the Pacific Plate, is moving northwest toward San Francisco, on the North American Plate, a few centimeters a year.' },
  { id: 'gulf-california', name: 'Gulf of California and northern East Pacific Rise', kind: 'ridge', plates: ['pacific', 'namerica'], pts: [J.salton, [-114.7, 31.4], [-113.2, 29.3], [-111.5, 27.5], [-110.2, 25.6], [-108.7, 23.9], [-108.5, 22.8], [-109, 21], [-108.3, 19.6], J.rivera], note: 'Baja California has split away from mainland Mexico. Short pieces of ridge are linked by long transform faults, and the small Rivera Plate at the mouth of the gulf is left out here.' },
  // --- Eastern Pacific and the Americas ---
  { id: 'epr-north', name: 'East Pacific Rise (Pacific–Cocos)', kind: 'ridge', plates: ['pacific', 'cocos'], pts: [J.rivera, [-105, 15.5], [-104, 13], [-104.3, 9.8], [-103.6, 8.2], [-102.7, 5], J.galapagos] },
  { id: 'epr-south', name: 'East Pacific Rise (Pacific–Nazca)', kind: 'ridge', plates: ['pacific', 'nazca'], pts: [J.galapagos, [-102.4, -1], [-104.5, -4.5], [-106.5, -6.5], [-108, -9.5], [-110.5, -13], [-113, -17], [-113.7, -21], [-113, -24.5], [-112.5, -28], [-112, -31.5], J.easter], note: 'The fastest-spreading ridge on Earth: the plates move apart about 15 cm a year here.' },
  { id: 'pacific-antarctic', name: 'Pacific–Antarctic Ridge', kind: 'ridge', plates: ['pacific', 'antarctic'], pts: [J.easter, [-111, -38], [-111, -41.5], [-112.5, -45], [-113, -49], [-117.5, -53], [-122, -55.5], [-130, -55.8], [-138, -56.8], [-145, -57.8], [-152, -59.5], [-158, -61.5], [-165, -63.3], [-172, -64.5], [-180, -65], [-186, -63.8], [-192, -62.8], west(J.macquarie)] },
  { id: 'chile-rise', name: 'Chile Rise', kind: 'ridge', plates: ['nazca', 'antarctic'], pts: [J.easter, [-105, -36.3], [-99, -37.8], [-93, -40.5], [-87, -42.5], [-81, -44.5], J.chile] },
  { id: 'galapagos-rift', name: 'Galápagos Rift', kind: 'ridge', plates: ['cocos', 'nazca'], pts: [J.panamaSouth, [-84.5, 2.6], [-86, 0.9], [-88.5, 0.9], [-90.8, 1.8], [-93, 2.3], [-97, 2.2], J.galapagos], note: 'Hot springs on the sea floor, with whole communities of animals living around them, were first discovered here in 1977.' },
  { id: 'panama-fz', name: 'Panama Fracture Zone', kind: 'fracture', plates: ['cocos', 'nazca'], pts: [J.panamaNorth, [-82.9, 5], J.panamaSouth] },
  { id: 'south-panama', name: 'Southern Panama fault zone', kind: 'fracture', plates: ['nazca', 'caribbean'], pts: [J.panamaNorth, [-81, 6.9], [-79.5, 6.9], J.panama] },
  { id: 'middle-america', name: 'Middle America Trench (Mexico)', kind: 'trench', plates: ['cocos', 'namerica'], under: 'cocos', pts: [J.rivera, [-104, 17.6], [-102.3, 16.9], [-100.3, 16], [-98, 15.3], [-96, 14.7], [-94.5, 14.2], J.motagua], note: 'The Cocos Plate sinks under Mexico. The 1985 earthquake that badly damaged Mexico City began here.' },
  { id: 'central-america', name: 'Middle America Trench (Central America)', kind: 'trench', plates: ['cocos', 'caribbean'], under: 'cocos', pts: [J.motagua, [-91.5, 12.9], [-89.8, 12.2], [-88.5, 11.7], [-87.3, 10.9], [-86.2, 9.6], [-85, 8.7], [-83.8, 7.9], J.panamaNorth] },
  { id: 'caribbean-north', name: 'Motagua Fault and Cayman Trough', kind: 'fracture', plates: ['namerica', 'caribbean'], pts: [J.motagua, [-91.5, 14.9], [-89.5, 15.2], [-88.2, 15.8], [-86, 16.6], [-83.5, 17.5], [-81.7, 18.3], [-79.5, 19], [-77, 19.7], [-75, 19.9], [-73.3, 19.9], [-71.5, 19.8], [-69.8, 19.6], [-68.3, 19.6], [-66.5, 19.8], [-64.8, 19.8], J.anegada], note: 'The Caribbean Plate slides east past North America. The fault system crosses Guatemala and runs under the sea south of Cuba and north of Hispaniola and Puerto Rico.' },
  { id: 'antilles-north', name: 'Lesser Antilles subduction zone (north)', kind: 'arc', plates: ['namerica', 'caribbean'], under: 'namerica', pts: [J.anegada, [-61.3, 18.6], [-60.2, 17.3], J.antilles] },
  { id: 'antilles-south', name: 'Lesser Antilles subduction zone (south)', kind: 'arc', plates: ['samerica', 'caribbean'], under: 'samerica', pts: [J.antilles, [-58.2, 14], [-58, 12.5], [-58.8, 11.2], [-60, 10.6], J.trinidad], note: 'Atlantic sea floor sinks under the Caribbean Plate and feeds the volcanoes of Montserrat, Martinique and St. Vincent.' },
  { id: 'caribbean-south', name: 'El Pilar and Oca fault zone', kind: 'fault', plates: ['samerica', 'caribbean'], pts: [J.trinidad, [-63, 10.6], [-65, 10.5], [-67, 10.6], [-69, 11.1], [-71.5, 11.3], [-73.8, 11.4], [-75.6, 10.8], [-76.8, 9.5], [-77.3, 8.4], J.panama], note: 'Along the coast of Venezuela the Caribbean Plate slides east past South America. Its western end, off Colombia, is really a zone where the plates push together.' },
  { id: 'peru-chile', name: 'Peru–Chile Trench', kind: 'trench', plates: ['nazca', 'samerica'], under: 'nazca', pts: [J.panama, [-78.3, 5.5], [-78.6, 3.8], [-79.8, 1.9], [-80.6, 0.8], [-81.3, -0.3], [-81.6, -1.5], [-81.8, -3], [-82, -4.6], [-81.6, -7], [-80.5, -9.3], [-79.5, -11], [-78.6, -12.3], [-77.5, -14.3], [-76.3, -16], [-74.5, -17], [-73, -17.9], [-71.9, -19], [-71.4, -20.5], [-71.4, -23.7], [-72, -27], [-72.4, -30], [-72.8, -33], [-73.5, -35], [-74.2, -36.8], [-74.8, -39.8], [-75.4, -42.5], [-75.8, -44.5], J.chile], note: 'The Nazca Plate sinks under South America along the whole west coast and has lifted the Andes. The largest earthquake ever recorded, magnitude 9.5, struck here in 1960.' },
  { id: 'chile-south', name: 'Southern Chile Trench', kind: 'trench', plates: ['antarctic', 'samerica'], under: 'antarctic', pts: [J.chile, [-76.8, -48.5], [-76.8, -50.5], J.magallanes] },
  // --- Scotia Sea ---
  { id: 'scotia-north', name: 'North Scotia Ridge and Magallanes–Fagnano Fault', kind: 'fracture', plates: ['samerica', 'scotia'], pts: [J.magallanes, [-73.5, -53.3], [-71, -53.9], [-68.5, -54.5], [-65.5, -54.7], [-62, -54.3], [-58, -53.6], [-53, -53.3], [-48, -53.2], [-43, -53.4], [-39, -53.4], [-35.5, -53.6], [-32, -54.2], J.sandwichNorth] },
  { id: 'sandwich', name: 'South Sandwich Trench', kind: 'arc', plates: ['samerica', 'scotia'], under: 'samerica', pts: [J.sandwichNorth, [-26.3, -55.4], [-24.8, -56.8], [-24.4, -58.5], [-25, -60], [-26.6, -60.8], J.sandwichSouth], note: 'On this map the small Sandwich Plate above the trench is part of the Scotia Plate.' },
  { id: 'scotia-south', name: 'South Scotia Ridge', kind: 'fracture', plates: ['scotia', 'antarctic'], pts: [J.sandwichSouth, [-33, -60.8], [-39, -60.4], [-44, -60.2], [-48, -60.4], [-52, -60.9], J.shackleton] },
  { id: 'shackleton', name: 'Shackleton Fracture Zone', kind: 'fracture', plates: ['scotia', 'antarctic'], pts: [J.shackleton, [-60.5, -59.2], [-64, -57.6], [-67.5, -56.8], [-71.5, -55.8], [-74.5, -54.2], J.magallanes] },
];
export const BOUNDARY_IDS = BOUNDARIES.map(b => b.id);
export const boundaryById = id => BOUNDARIES.find(b => b.id === id);
export const boundaryType = b => KINDS[b.kind].type;
export const boundariesOfType = type => BOUNDARIES.filter(b => boundaryType(b) === type);

// ---------- Earthquake and volcano examples ----------
// [name, year, magnitude, longitude, latitude]. Large or well-known earthquakes; positions to about 0.1°.
export const QUAKES = [
  ['Valdivia, Chile', 1960, 9.5, -73.4, -38.1], ['Maule, Chile', 2010, 8.8, -72.9, -36.1], ['Illapel, Chile', 2015, 8.3, -71.7, -31.6], ['Iquique, Chile', 2014, 8.2, -70.8, -19.6],
  ['Pisco, Peru', 2007, 8.0, -76.6, -13.4], ['Ecuador–Colombia', 1906, 8.8, -79.4, 1.0], ['Muisne, Ecuador', 2016, 7.8, -79.9, 0.4],
  ['Nicoya, Costa Rica', 2012, 7.6, -85.3, 10.1], ['Guatemala', 1976, 7.5, -89.1, 15.3], ['Chiapas, Mexico', 2017, 8.2, -93.9, 15.0], ['Michoacán (Mexico City), Mexico', 1985, 8.0, -102.5, 18.2],
  ['Haiti', 2010, 7.0, -72.6, 18.4], ['El Mayor–Cucapah, Baja California', 2010, 7.2, -115.3, 32.3], ['Loma Prieta, California', 1989, 6.9, -121.9, 37.0], ['San Francisco, California', 1906, 7.9, -122.5, 37.75],
  ['Haida Gwaii, Canada', 2012, 7.8, -132.1, 52.8], ['Prince William Sound, Alaska', 1964, 9.2, -147.3, 60.9], ['Unimak Island, Alaska', 1946, 8.6, -162.8, 53.5], ['Andreanof Islands, Alaska', 1957, 8.6, -175.4, 51.6], ['Rat Islands, Alaska', 1965, 8.7, 178.5, 51.2],
  ['Kamchatka, Russia', 1952, 9.0, 160.1, 52.8], ['Kuril Islands', 2006, 8.3, 153.3, 46.6], ['Tōhoku, Japan', 2011, 9.1, 142.4, 38.3], ['Great Kantō, Japan', 1923, 7.9, 139.1, 35.3], ['Nankai, Japan', 1946, 8.1, 135.6, 33.0],
  ['Neftegorsk, Sakhalin', 1995, 7.1, 142.8, 52.6], ['Sea of Japan (Akita)', 1983, 7.7, 139.1, 40.4], ['Chi-Chi, Taiwan', 1999, 7.7, 120.8, 23.8], ['Samar, Philippines', 2012, 7.6, 126.6, 10.8], ['Guam', 1993, 7.8, 144.8, 13.0],
  ['Sumatra–Andaman', 2004, 9.1, 95.9, 3.3], ['Nias, Sumatra', 2005, 8.6, 97.1, 2.1], ['Pangandaran, Java', 2006, 7.7, 107.4, -9.3], ['Sumba, Indonesia', 1977, 8.3, 118.4, -11.1],
  ['Aitape, Papua New Guinea', 1998, 7.0, 141.9, -3.0], ['Solomon Islands', 2007, 8.1, 157.0, -8.5], ['Santa Cruz Islands', 2013, 8.0, 165.1, -10.8], ['Samoa–Tonga', 2009, 8.1, -172.1, -15.5], ['Tonga', 2006, 8.0, -174.1, -20.2], ['Kermadec Islands', 2021, 8.1, -177.3, -29.7],
  ['Kaikōura, New Zealand', 2016, 7.8, 173.0, -42.7], ['Macquarie Ridge', 1989, 8.2, 160.6, -52.3],
  ['Gorkha, Nepal', 2015, 7.8, 84.7, 28.2], ['Kashmir', 2005, 7.6, 73.6, 34.5], ['Assam–Tibet', 1950, 8.6, 96.4, 28.4], ['Quetta, Pakistan', 1935, 7.7, 66.8, 29.6], ['Makran, Pakistan', 1945, 8.1, 63.5, 25.1],
  ['Kermanshah, Iran–Iraq', 2017, 7.3, 45.9, 34.9], ['Kahramanmaraş, Turkey–Syria', 2023, 7.8, 37.0, 37.2], ['Gulf of Aqaba', 1995, 7.3, 34.8, 28.8],
  ['Messina, Italy', 1908, 7.1, 15.6, 38.1], ['El Asnam, Algeria', 1980, 7.1, 1.4, 36.2], ['Lisbon, Portugal', 1755, 8.5, -10.5, 36.5],
  ['Azores (Terceira)', 1980, 6.9, -27.8, 38.8], ['South Iceland', 2000, 6.5, -20.4, 64.0], ['Mid-Atlantic Ridge near the equator', 2016, 7.1, -17.8, 0.0],
  ['Machaze, Mozambique', 2006, 7.0, 33.6, -21.3], ['Lake Tanganyika', 2005, 6.8, 29.8, -6.2], ['Central Indian Ridge', 2003, 7.6, 68.4, -2.6],
  ['South Sandwich Islands', 2021, 8.1, -25.0, -57.6], ['Scotia Sea', 2013, 7.7, -46.4, -60.3],
].map(([name, year, magnitude, lon, lat], i) => ({ id: `q${i + 1}`, name, year, magnitude, lon, lat }));

// [name, place, longitude, latitude, hotspot?]. Well-known volcanoes; positions to about 0.1°.
export const VOLCANOES = [
  ['Mount St. Helens', 'Washington, USA', -122.2, 46.2], ['Mount Rainier', 'Washington, USA', -121.8, 46.9], ['Popocatépetl', 'Mexico', -98.6, 19.0], ['Colima', 'Mexico', -103.6, 19.5],
  ['Fuego', 'Guatemala', -90.9, 14.5], ['Arenal', 'Costa Rica', -84.7, 10.5], ['Nevado del Ruiz', 'Colombia', -75.3, 4.9], ['Cotopaxi', 'Ecuador', -78.4, -0.7], ['Ubinas', 'Peru', -70.9, -16.4],
  ['Láscar', 'Chile', -67.7, -23.4], ['Villarrica', 'Chile', -71.9, -39.4], ['Chaitén', 'Chile', -72.6, -42.8], ['Mount Hudson', 'Chile', -73.0, -45.9],
  ['Redoubt', 'Alaska, USA', -152.7, 60.5], ['Novarupta (Katmai)', 'Alaska, USA', -155.2, 58.3], ['Pavlof', 'Alaska, USA', -161.9, 55.4], ['Shishaldin', 'Aleutian Islands, USA', -164.0, 54.8], ['Cleveland', 'Aleutian Islands, USA', -169.9, 52.8],
  ['Klyuchevskoy', 'Kamchatka, Russia', 160.6, 56.1], ['Karymsky', 'Kamchatka, Russia', 159.4, 54.0], ['Sarychev Peak', 'Kuril Islands, Russia', 153.2, 48.1],
  ['Mount Fuji', 'Japan', 138.7, 35.4], ['Sakurajima', 'Japan', 130.7, 31.6], ['Mount Aso', 'Japan', 131.1, 32.9], ['Mount Usu', 'Japan', 140.8, 42.5], ['Anatahan', 'Mariana Islands', 145.7, 16.4],
  ['Mount Pinatubo', 'Philippines', 120.4, 15.1], ['Mayon', 'Philippines', 123.7, 13.3], ['Taal', 'Philippines', 121.0, 14.0],
  ['Toba', 'Sumatra, Indonesia', 98.8, 2.7], ['Krakatau', 'Indonesia', 105.4, -6.1], ['Merapi', 'Java, Indonesia', 110.4, -7.5], ['Agung', 'Bali, Indonesia', 115.5, -8.3], ['Tambora', 'Sumbawa, Indonesia', 118.0, -8.2],
  ['Rabaul', 'Papua New Guinea', 152.2, -4.3], ['Manam', 'Papua New Guinea', 145.0, -4.1], ['Yasur', 'Vanuatu', 169.4, -19.5], ['Hunga Tonga–Hunga Haʻapai', 'Tonga', -175.4, -20.5],
  ['Whakaari / White Island', 'New Zealand', 177.2, -37.5], ['Ruapehu', 'New Zealand', 175.6, -39.3],
  ['Mount Etna', 'Italy', 15.0, 37.75], ['Vesuvius', 'Italy', 14.4, 40.8], ['Stromboli', 'Italy', 15.2, 38.8], ['Santorini', 'Greece', 25.4, 36.4],
  ['Eyjafjallajökull', 'Iceland', -19.6, 63.6], ['Krafla', 'Iceland', -16.8, 65.7], ['Fagradalsfjall', 'Iceland', -22.3, 63.9], ['Beerenberg', 'Jan Mayen, Norway', -8.2, 71.1], ['Pico', 'Azores, Portugal', -28.4, 38.5],
  ['Erta Ale', 'Ethiopia', 40.7, 13.6], ['Ol Doinyo Lengai', 'Tanzania', 35.9, -2.8], ['Kilimanjaro', 'Tanzania', 37.35, -3.1], ['Nyiragongo', 'DR Congo', 29.25, -1.5], ['Jabal al-Tair', 'Red Sea, Yemen', 41.8, 15.55],
  ['Soufrière Hills', 'Montserrat', -62.2, 16.7], ['Mount Pelée', 'Martinique', -61.2, 14.8], ['La Soufrière', 'St. Vincent', -61.2, 13.3], ['Mount Michael', 'South Sandwich Islands', -26.5, -57.8],
  ['Kīlauea', 'Hawaii, USA', -155.3, 19.4, true], ['Yellowstone', 'Wyoming, USA', -110.7, 44.4, true], ['Piton de la Fournaise', 'Réunion', 55.7, -21.2, true], ['Cumbre Vieja', 'La Palma, Canary Islands', -17.8, 28.6, true], ['Fernandina', 'Galápagos Islands, Ecuador', -91.55, -0.4, true],
].map(([name, place, lon, lat, hotspot = false], i) => ({ id: `v${i + 1}`, name, place, lon, lat, hotspot }));
// The nearest boundary line is not always the one that matters: a volcano stands well behind its trench,
// and near a junction another line can be closer. These examples are assigned by hand instead.
const ASSIGNED = { 'Mount Fuji': 'mariana', 'Mount Usu': 'japan', Fuego: 'central-america', 'Kahramanmaraş, Turkey–Syria': 'dead-sea' };
export const featureById = id => QUAKES.find(q => q.id === id) ?? VOLCANOES.find(v => v.id === id) ?? null;

// ---------- Geometry on the sphere ----------
export const EARTH_RADIUS_KM = 6371;
const rad = deg => (deg * Math.PI) / 180;
/** A longitude brought into the range −180 to 180 (180 itself stays 180). */
export const wrapLon = lon => { const w = ((((lon + 180) % 360) + 360) % 360) - 180; return w === -180 && lon > 0 ? 180 : w; };
/** Great-circle distance in km between two [lon, lat] points (haversine formula). */
export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Points along a boundary line, close enough together (about a quarter of a degree) to measure distances to it. */
export function sample(pts, step = 0.25) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const SAMPLED = BOUNDARIES.map(b => ({ b, pts: sample(b.pts) }));
/** Shortest distance in km from a [lon, lat] point to one boundary line. */
export function distanceToBoundaryKm(point, boundary) {
  let best = Infinity;
  for (const p of SAMPLED.find(s => s.b === boundary).pts) best = Math.min(best, distanceKm(point, p));
  return best;
}
/** The boundary nearest to a [lon, lat] point, and how far away it is. */
export function nearestBoundary(point) {
  let best = null;
  for (const { b } of SAMPLED) {
    const km = distanceToBoundaryKm(point, b);
    if (!best || km < best.km) best = { boundary: b, km };
  }
  return best;
}
/** Splits a line where it crosses the 180° line, and returns pieces with longitudes from −180 to 180. */
export function splitAtDateLine(pts) {
  const sheet = lon => Math.floor((lon + 180) / 360); // which copy of the world a longitude falls in
  const pieces = [];
  let piece = [], s = null;
  pts.forEach(([lon, lat], i) => {
    let t = sheet(lon);
    // A point exactly on the line stays with the piece it continues.
    if ((lon + 180) % 360 === 0 && s !== null && t === s + 1) t = s;
    if (s !== null && t !== s) {
      const [plon, plat] = pts[i - 1];
      const edge = Math.max(s, t) * 360 - 180;
      const f = (edge - plon) / (lon - plon), at = plat + (lat - plat) * f;
      if (f > 0) piece.push([t > s ? 180 : -180, at]);
      pieces.push(piece);
      piece = f < 1 ? [[t > s ? -180 : 180, at]] : [];
    }
    piece.push([lon - t * 360, lat]);
    s = t;
  });
  pieces.push(piece);
  return pieces.filter(p => p.length >= 2);
}

// ---------- What the examples show ----------
/** An earthquake counts as "on a boundary" within this many km of a boundary line. */
export const QUAKE_NEAR_KM = 300;
/** Volcanoes stand 100–300 km behind a trench, so they get a wider margin. */
export const VOLCANO_NEAR_KM = 450;
const withNearest = f => {
  const assigned = ASSIGNED[f.name] ? boundaryById(ASSIGNED[f.name]) : null;
  const n = assigned ? { boundary: assigned, km: distanceToBoundaryKm([f.lon, f.lat], assigned) } : nearestBoundary([f.lon, f.lat]);
  return { ...f, boundary: n.boundary.id, km: n.km };
};
export const QUAKES_NEAR = QUAKES.map(withNearest);
export const VOLCANOES_NEAR = VOLCANOES.map(withNearest);
const round10 = km => Math.max(10, Math.round(km / 10) * 10);
/** How many examples lie near a boundary, by boundary type, and which do not. */
export function evidence() {
  const count = (list, limit) => {
    const near = list.filter(f => f.km <= limit && !f.hotspot);
    const byType = Object.fromEntries(TYPES.map(type => [type, near.filter(f => boundaryType(boundaryById(f.boundary)) === type).length]));
    return { total: list.length, near: near.length, away: list.filter(f => !near.includes(f)), byType };
  };
  return { quakes: count(QUAKES_NEAR, QUAKE_NEAR_KM), volcanoes: count(VOLCANOES_NEAR, VOLCANO_NEAR_KM) };
}

// ---------- Descriptions ----------
export const explorerHref = b => { const key = KINDS[b.kind].explorer; return key ? `/tools/plate-tectonics/?type=${CASES[key].type}&plates=${CASES[key].plates}` : null; };
export const explorerTitle = b => { const key = KINDS[b.kind].explorer; return key ? `${CASES[key].name} (${caseTitle(key).toLowerCase()})` : null; };
/** Everything the info panel says about a boundary. */
export function describeBoundary(b) {
  const [p1, p2] = b.plates.map(plateName);
  const type = boundaryType(b);
  const sinks = b.under ? ` Here the ${plateName(b.under)} sinks under the ${plateName(b.plates.find(id => id !== b.under))}.` : '';
  return {
    title: b.name,
    type,
    typeLabel: type === 'zone' ? TYPE_LABELS.zone : `${TYPE_LABELS[type]} boundary: ${TYPE_MOTION[type]}`,
    plates: `Between the ${p1} and the ${p2}.`,
    text: `${KINDS[b.kind].what}${sinks}${b.note ? ` ${b.note}` : ''}`,
    href: explorerHref(b),
    link: explorerTitle(b),
  };
}
/** Everything the info panel says about a plate, including its neighbors, read from the boundary list. */
export function describePlate(plate) {
  const mine = BOUNDARIES.filter(b => b.plates.includes(plate.id));
  const neighbors = [...new Set(mine.flatMap(b => b.plates).filter(id => id !== plate.id))].map(plateName);
  const counts = TYPES.filter(type => type !== 'zone').map(type => [type, mine.filter(b => boundaryType(b) === type).length]).filter(([, n]) => n > 0);
  return {
    title: plate.name,
    text: plate.about,
    neighbors: `Neighbors on this map: ${neighbors.join(', ')}.`,
    boundaries: `Its edges here: ${counts.map(([type, n]) => `${n} ${type}`).join(', ')}.`,
  };
}
const WHY = {
  ridge: 'As the plates pull apart, the rock cracks and slips. Earthquakes on ridges are shallow and usually not very large.',
  rift: 'As the continent is pulled apart, blocks of crust drop down along faults.',
  trench: 'The sinking plate sticks against the plate above it, then slips suddenly. Subduction zones make the largest earthquakes of all.',
  arc: 'The sinking plate sticks against the plate above it, then slips suddenly. Subduction zones make the largest earthquakes of all.',
  collision: 'Two continents are being pushed together, and the crust breaks along great thrust faults.',
  fault: 'The plates are locked together by friction as they try to slide past each other, then slip suddenly.',
  fracture: 'The plates are locked together by friction as they try to slide past each other, then slip suddenly.',
  zone: 'Even where a boundary is a wide zone and not one sharp line, the plates still push against each other and the crust breaks.',
};
const MELT = {
  ridge: 'Where plates pull apart, hot mantle rock rises and partly melts.',
  rift: 'Where a continent is pulled apart, the crust thins and magma rises.',
  trench: 'Water from the sinking plate makes the hot mantle above it melt, and the magma rises to feed a line of volcanoes.',
  arc: 'Water from the sinking plate makes the hot mantle above it melt, and the magma rises to feed a chain of volcanic islands.',
};
/** Everything the info panel says about an earthquake or volcano example. */
export function describeFeature(f) {
  const quake = 'magnitude' in f;
  const near = (quake ? QUAKES_NEAR : VOLCANOES_NEAR).find(x => x.id === f.id);
  const b = boundaryById(near.boundary), type = boundaryType(b);
  const where = `About ${round10(near.km).toLocaleString('en-US')} km from the ${b.name} (${TYPE_LABELS[type].toLowerCase()}).`;
  if (quake) {
    return {
      title: `${f.name} earthquake, ${f.year}`,
      fact: `Magnitude ${f.magnitude.toFixed(1)}${f.year < 1900 ? ' (estimated)' : ''}`,
      where,
      text: WHY[b.kind],
      boundary: b.id,
    };
  }
  return {
    title: f.name,
    fact: f.place,
    where: f.hotspot ? `A hotspot volcano: about ${round10(near.km).toLocaleString('en-US')} km from the nearest plate boundary on this map.` : where,
    text: f.hotspot
      ? 'Not every volcano is at a plate boundary. Here a plume of hot rock rises from deep in the mantle and melts its way through the plate above.'
      : MELT[b.kind] ?? 'Volcanoes need magma. Here it rises along the plate boundary.',
    boundary: f.hotspot ? null : b.id,
  };
}

// ---------- Views ----------
// The whole map, and close-ups. Bounds are [west, east, south, north]; east may run past 180°.
export const WORLD = { west: -180, east: 180, south: -75, north: 82 };
export const REGIONS = [
  { id: 'world', name: 'Whole world', bounds: [WORLD.west, WORLD.east, WORLD.south, WORLD.north], text: 'Earth’s outer shell is broken into plates. Red lines are boundaries where plates move apart, blue lines where they move together, and green lines where they slide past each other. Switch on the earthquakes and volcanoes: nearly all of them follow the lines.', boundaries: [] },
  { id: 'pacific', name: 'Ring of Fire', bounds: [95, 300, -62, 66], text: 'Trenches ring the Pacific Ocean, from New Zealand through Japan and Alaska to Chile. At each one an ocean plate sinks into the mantle. That makes the world’s largest earthquakes and feeds about three quarters of its active volcanoes, which is why this belt is called the Ring of Fire.', boundaries: ['tonga', 'new-guinea', 'philippine', 'mariana', 'japan', 'aleutian', 'cascadia', 'middle-america', 'central-america', 'peru-chile'] },
  { id: 'atlantic', name: 'Mid-Atlantic Ridge', bounds: [-80, 20, -58, 74], text: 'A mountain chain runs down the middle of the Atlantic Ocean floor. Here the American plates move away from the Eurasian and African plates, a few centimeters a year, and new sea floor forms in the gap. The ridge has small, shallow earthquakes and many volcanoes, almost all of them hidden under the sea. Iceland is the one large piece above water.', boundaries: ['mar-north', 'mar-central', 'mar-south'] },
  { id: 'africa', name: 'East African Rift', bounds: [18, 64, -26, 32], text: 'East Africa is being pulled apart. The rift valleys, their long lakes and volcanoes such as Kilimanjaro mark a new plate boundary forming between the African and Somali plates. Farther north the Red Sea and the Gulf of Aden show the next stage: rifts that have widened into young oceans.', boundaries: ['ear-east', 'ear-west', 'ear-malawi', 'red-sea', 'aden'] },
  { id: 'himalaya', name: 'Himalaya', bounds: [42, 106, 4, 44], text: 'India is pushing north into Asia. Continental crust is too light to sink far, so the collision has crumpled it into the highest mountains on Earth. Look at the two layers here: there are large earthquakes all along the mountains, but almost no volcanoes, because no ocean plate is sinking and melting.', boundaries: ['himalaya', 'zagros', 'chaman'] },
  { id: 'andes', name: 'Andes', bounds: [-112, -30, -58, 14], text: 'The Nazca Plate sinks under South America along the Peru–Chile Trench. Earthquakes line the coast, and a chain of volcanoes stands in the Andes, a few hundred kilometers inland, above the place where the sinking plate reaches about 100 km down.', boundaries: ['peru-chile', 'epr-south', 'chile-rise'] },
  { id: 'california', name: 'San Andreas Fault', bounds: [-140, -100, 20, 62], text: 'Along the San Andreas Fault the Pacific Plate slides northwest past North America. There are earthquakes but no volcanoes, because nothing sinks or rises. Just to the north the small Juan de Fuca Plate sinks under the coast, and there the volcanoes of the Cascade Range appear.', boundaries: ['san-andreas', 'cascadia', 'juan-de-fuca', 'gulf-california', 'queen-charlotte'] },
  { id: 'japan', name: 'Japan and the Philippines', bounds: [112, 172, -2, 58], text: 'Four plates meet near Japan. The Pacific Plate sinks westward at the Japan, Kuril and Mariana trenches, and the Philippine Sea Plate sinks under southern Japan and the Philippines. Japan’s earthquakes, including the magnitude 9.1 Tōhoku earthquake of 2011, and its volcanoes all come from these trenches.', boundaries: ['japan', 'mariana', 'ryukyu', 'philippine', 'manila'] },
  { id: 'indonesia', name: 'Indonesia', bounds: [88, 142, -16, 26], text: 'The Indo-Australian Plate sinks under Sumatra and Java along the Sunda Trench. Indonesia has well over a hundred volcanoes, most of them in a line parallel to the trench.', boundaries: ['sunda'] },
  { id: 'mediterranean', name: 'Mediterranean', bounds: [-14, 62, 22, 48], text: 'Africa and Arabia are both moving north into Eurasia. The boundary runs through the Mediterranean Sea, where the last of an old ocean floor sinks under Italy and Greece, and on through the mountains of Turkey and Iran.', boundaries: ['mediterranean', 'dead-sea', 'zagros'] },
];
export const REGION_IDS = REGIONS.map(r => r.id);
export const regionById = id => REGIONS.find(r => r.id === id);
/** True when a [lon, lat] point lies inside a region's bounds (which may cross the 180° line). */
export function inRegion(region, [lon, lat]) {
  const [w, e, s, n] = region.bounds;
  if (lat < s || lat > n) return false;
  return (lon >= w && lon <= e) || (lon + 360 >= w && lon + 360 <= e);
}
/** The boundaries, earthquakes and volcanoes that show up in a region. */
export function inView(region) {
  return {
    boundaries: BOUNDARIES.filter(b => sample(b.pts, 1).filter(p => inRegion(region, [wrapLon(p[0]), p[1]])).length >= 3),
    quakes: QUAKES.filter(q => inRegion(region, [q.lon, q.lat])),
    volcanoes: VOLCANOES.filter(v => inRegion(region, [v.lon, v.lat])),
  };
}

// ---------- Layers and share links ----------
export const LAYERS = ['divergent', 'convergent', 'transform', 'quakes', 'volcanoes', 'names'];
export const LAYER_NAMES = { divergent: 'Divergent boundaries', convergent: 'Convergent boundaries', transform: 'Transform boundaries', quakes: 'Earthquakes', volcanoes: 'Volcanoes', names: 'Plate names' };
export const DEFAULT_LAYERS = ['divergent', 'convergent', 'transform', 'names'];
export const MODES = ['explore', 'challenge'];
export const DEFAULT_STATE = { mode: 'explore', region: 'world', layers: DEFAULT_LAYERS };
const quoted = value => `“${value.length > 24 ? value.slice(0, 24) + '…' : value}”`;

/** Reads ?region=himalaya&show=convergent,quakes,volcanoes or ?mode=challenge. Bad values fall back with a friendly note. */
export function parseMapState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { ...DEFAULT_STATE, layers: [...DEFAULT_LAYERS] };
  if (params.has('mode')) {
    const mode = params.get('mode');
    if (MODES.includes(mode)) state.mode = mode;
    else notes.push(`${quoted(mode)} isn’t a mode here, so the map opened in Explore mode.`);
  }
  if (params.has('region')) {
    const region = params.get('region');
    if (REGION_IDS.includes(region)) state.region = region;
    else notes.push(`${quoted(region)} isn’t a view on this map, so the whole world is shown.`);
  }
  if (params.has('show')) {
    const asked = params.get('show').split(',').map(s => s.trim()).filter(Boolean);
    const bad = asked.filter(layer => !LAYERS.includes(layer));
    state.layers = LAYERS.filter(layer => asked.includes(layer));
    if (bad.length) notes.push(`${quoted(bad[0])} isn’t a layer on this map, so it was left out.`);
  }
  return { state, notes };
}
export function serializeMapState({ mode, region, layers }) {
  const params = new URLSearchParams();
  if (mode === 'challenge') { params.set('mode', 'challenge'); return params.toString(); }
  params.set('region', REGION_IDS.includes(region) ? region : DEFAULT_STATE.region);
  params.set('show', LAYERS.filter(layer => (layers ?? []).includes(layer)).join(','));
  return params.toString().replace(/%2C/g, ','); // commas are safe in a query string and easier to read
}

// ---------- Challenge ----------
// Every answer is read from the data above (or from the Plate Tectonics Explorer's facts), never typed in.
const typeOf = id => boundaryType(boundaryById(id));
const TYPE_CHOICES = ['divergent', 'convergent', 'transform'];
const pair = id => boundaryById(id).plates.map(plateName).join(' and the ');
const noVolcanoTypes = TYPE_CHOICES.filter(type => evidence().volcanoes.byType[type] === 0);
export const CHALLENGE = [
  { kind: 'type', region: 'atlantic', show: 'mar-south', prompt: 'The highlighted line runs down the middle of the Atlantic Ocean. What type of plate boundary is it?', choices: TYPE_CHOICES, answer: typeOf('mar-south'), explain: 'It is the Mid-Atlantic Ridge, a divergent boundary. South America and Africa are moving apart, and new sea floor forms between them.' },
  { kind: 'type', region: 'andes', show: 'peru-chile', prompt: 'The highlighted line follows the west coast of South America. What type of plate boundary is it?', choices: TYPE_CHOICES, answer: typeOf('peru-chile'), explain: 'It is the Peru–Chile Trench, a convergent boundary. The Nazca Plate sinks under South America, which lifts the Andes and feeds their volcanoes.' },
  { kind: 'type', region: 'california', show: 'san-andreas', prompt: 'The highlighted line crosses California. What type of plate boundary is it?', choices: TYPE_CHOICES, answer: typeOf('san-andreas'), explain: 'It is the San Andreas Fault, a transform boundary. The Pacific Plate slides northwest past the North American Plate.' },
  { kind: 'plates', region: 'himalaya', show: 'himalaya', prompt: 'Which two plates meet along the highlighted line, at the Himalaya?', choices: ['himalaya', 'zagros', 'mar-north', 'japan'], answer: 'himalaya', explain: 'India, on the Indo-Australian Plate, is pushing into the Eurasian Plate. The collision built the Himalaya.' },
  { kind: 'layer', region: 'himalaya', show: 'himalaya', layers: ['convergent', 'quakes', 'volcanoes'], prompt: 'Earthquakes and volcanoes are both switched on. The Himalaya has large earthquakes but no volcanoes on this map. Why?', choices: ['collision', 'cold', 'old', 'transform'], answer: CASES['convergent-cc'].volcanoes ? 'cold' : 'collision', choiceText: { collision: 'Two continents are colliding, so no ocean plate sinks and melts', cold: 'The mountains are too high and cold for rock to melt', old: 'The volcanoes there have all worn away', transform: 'The plates only slide past each other there' }, explain: 'Volcanoes at convergent boundaries need a sinking ocean plate: water from it makes the mantle above melt. Where two continents collide, neither sinks far, so little magma forms.' },
  { kind: 'layer', region: 'world', show: null, layers: ['divergent', 'convergent', 'transform', 'volcanoes'], prompt: 'Look at the volcano examples on the whole map. Which type of plate boundary has none of them?', choices: TYPE_CHOICES, answer: noVolcanoTypes[0], explain: 'Transform boundaries. The plates only slide past each other, so nothing rises or sinks and no magma forms. Volcanoes line the boundaries where plates move apart or together.' },
  { kind: 'layer', region: 'pacific', show: null, layers: ['divergent', 'convergent', 'transform', 'volcanoes'], prompt: 'Kīlauea, in Hawaii, is in the middle of the Pacific Plate, far from any boundary. What explains it?', choices: ['hotspot', 'ridge', 'trench', 'fault'], answer: VOLCANOES.find(v => v.name === 'Kīlauea').hotspot ? 'hotspot' : 'ridge', choiceText: { hotspot: 'A hotspot: a plume of hot rock rising from deep in the mantle', ridge: 'A hidden mid-ocean ridge under Hawaii', trench: 'A trench where the Pacific Plate sinks under Hawaii', fault: 'A transform fault that crosses Hawaii' }, explain: 'Hawaii sits over a hotspot. The plume stays put while the Pacific Plate moves over it, which has built a whole chain of islands.' },
  { kind: 'type', region: 'africa', show: 'ear-east', prompt: 'The highlighted line runs through Ethiopia, Kenya and Tanzania. What type of plate boundary is forming here?', choices: TYPE_CHOICES, answer: typeOf('ear-east'), explain: 'It is the East African Rift, a divergent boundary on land. East Africa is slowly pulling away from the rest of the continent.' },
];
/** The text on a challenge answer button. */
export function choiceLabel(q, choice) {
  if (q.choiceText) return q.choiceText[choice];
  if (q.kind === 'plates') return `The ${pair(choice)}`;
  return `${TYPE_NAMES[choice]}: ${TYPE_MOTION[choice]}`;
}
