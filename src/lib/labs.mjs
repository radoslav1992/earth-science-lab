// Every lab on the site, in menu order. `section` is the Layout section its pages pass, which puts them under
// Labs in the menu and in the breadcrumb trail. Used by the Labs hub, the home page and the footer.
export const labs = [
  {
    slug: 'earthquake-epicenter',
    name: 'Earthquake Epicenter Finder',
    section: 'Epicenter Finder',
    topic: 'Earthquakes',
    blurb: 'Read three seismograms, turn each S–P lag into a distance and triangulate where an earthquake began.',
  },
  {
    slug: 'plate-tectonics',
    name: 'Plate Tectonics Explorer',
    section: 'Plate Tectonics',
    topic: 'Plate tectonics',
    blurb: 'Pull plates apart, push them together or slide them past each other, and see which landforms, volcanoes and earthquakes form.',
  },
  {
    slug: 'contour-map',
    name: 'Contour Map Playground',
    section: 'Contour Maps',
    topic: 'Maps and landforms',
    blurb: 'Sculpt hills, valleys and volcanoes and watch the topographic map redraw, then read slopes, rivers and cross-sections.',
  },
  {
    slug: 'water-cycle',
    name: 'Water Cycle Explorer',
    section: 'Water Cycle',
    topic: 'Water cycle',
    blurb: 'Follow a water droplet through oceans, clouds, ice, soil and groundwater, see where Earth’s water is stored, and switch off the sun or gravity to see what drives the cycle.',
  },
];

export const labBySection = section => labs.find(lab => lab.section === section);
