// Every lab on the site, in menu order. `section` is the Layout section its pages pass, which puts them under
// Labs in the menu and in the breadcrumb trail. `kind` says what sort of tool it is, in the words people search
// with; the Labs hub shows it above each name. Used by the Labs hub, the home page and the footer.
export const labs = [
  {
    slug: 'earthquake-epicenter',
    name: 'Earthquake Epicenter Finder',
    section: 'Epicenter Finder',
    topic: 'Earthquakes',
    kind: 'Virtual earthquake lab',
    blurb: 'Read three seismograms, turn each S–P lag into a distance and triangulate where an earthquake began.',
  },
  {
    slug: 'plate-tectonics',
    name: 'Plate Tectonics Explorer',
    section: 'Plate Tectonics',
    topic: 'Plate tectonics',
    kind: 'Plate tectonics simulation',
    blurb: 'Pull plates apart, push them together or slide them past each other, and see which landforms, volcanoes and earthquakes form.',
  },
  {
    slug: 'contour-map',
    name: 'Contour Map Playground',
    section: 'Contour Maps',
    topic: 'Maps and landforms',
    kind: 'Contour map practice',
    blurb: 'Sculpt hills, valleys and volcanoes and watch the topographic map redraw, then read slopes, rivers and cross-sections.',
  },
  {
    slug: 'river-erosion',
    name: 'River Erosion Sandbox',
    section: 'River Erosion',
    topic: 'Rivers and erosion',
    kind: 'Virtual stream table',
    blurb: 'Tilt a stream table, choose the sediment and turn up the water, then watch a river cut its channel, build point bars and a delta, and read why on the Hjulström diagram.',
  },
  {
    slug: 'water-cycle',
    name: 'Water Cycle Explorer',
    section: 'Water Cycle',
    topic: 'Water cycle',
    kind: 'Water cycle simulation',
    blurb: 'Follow a water droplet through oceans, clouds, ice, soil and groundwater, see where Earth’s water is stored, and switch off the sun or gravity to see what drives the cycle.',
  },
  {
    slug: 'rock-cycle',
    name: 'Rock Cycle Builder',
    section: 'Rock Cycle',
    topic: 'Rocks and minerals',
    kind: 'Rock cycle simulation',
    blurb: 'Melt, cool, weather, bury and squeeze rocks to see how granite becomes slate or magma becomes marble, and where inside Earth each change happens.',
  },
  {
    slug: 'rock-layers',
    name: 'Rock Layers Lab',
    section: 'Rock Layers',
    topic: 'Geologic time',
    kind: 'Relative and radiometric dating lab',
    blurb: 'Read a cross-section of rock layers and put its layers, faults and intrusions in order, then use half-lives to date the igneous rocks and bracket the ages of the layers around them.',
  },
  {
    slug: 'plate-map',
    name: 'Plate Boundaries Map',
    section: 'Plate Map',
    topic: 'Plate tectonics',
    kind: 'Interactive tectonic plates map',
    blurb: 'Explore a world map of the tectonic plates and their divergent, convergent and transform boundaries, then switch on earthquakes and volcanoes and see how they line up along the plate edges.',
  },
];

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** How many labs there are, as a word ("seven"), so every page that counts them stays in step with this list. */
export const labCount = COUNT_WORDS[labs.length] ?? String(labs.length);
/** The same word with a capital, for the start of a sentence or a title ("Seven"). */
export const LabCount = labCount[0].toUpperCase() + labCount.slice(1);

export const labBySection = section => labs.find(lab => lab.section === section);
