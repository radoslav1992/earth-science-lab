// The Water Cycle Explorer's classroom activity, in the same shape as the entries in ../activities.mjs.
// The journey in the table is the one chance code 10 makes from the ocean in today's climate; every table cell
// and every number printed in an answer is computed from water-cycle.mjs, and tests/water-cycle.test.mjs
// checks each `checks` pair (printed text, model value[, tolerance]) and that no answer prints an unchecked number.
import * as w from '../water-cycle.mjs';

// NGSS performance expectations referenced below, paraphrased.
export const standards = {
  'MS-ESS2-4': 'Develop a model to describe how water cycles through Earth’s systems, driven by energy from the sun and the force of gravity.',
  '5-ESS2-2': 'Describe and graph the amounts and percentages of salt water and fresh water in Earth’s reservoirs as evidence of how water is distributed on Earth.',
};

/** The worksheet's journey: chance code 10, starting in the ocean, six moves, today's climate, sun and gravity on. */
export const WORKSHEET_JOURNEY = { start: 'ocean', seed: 10, moves: 6, conditions: w.DEFAULT_CONDITIONS };
export const worksheetPath = w.chanceJourney(WORKSHEET_JOURNEY.start, WORKSHEET_JOURNEY.seed, WORKSHEET_JOURNEY.moves, WORKSHEET_JOURNEY.conditions);
export const worksheetLog = w.journeyLog(worksheetPath);

const end = worksheetPath.at(-1);
const totalYears = w.journeyYears(worksheetPath);
const longest = w.longestStop(worksheetPath);
const otherYears = worksheetPath.slice(0, -1).filter(id => w.stayYears(id) >= 1 && id !== longest);
const shortYears = worksheetPath.slice(0, -1).filter(id => w.stayYears(id) < 1).reduce((sum, id) => sum + w.stayYears(id), 0);
const years = id => w.stayYears(id);
const cap = text => text[0].toUpperCase() + text.slice(1);
const list = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0]);
// Processes on the journey, sorted by what drives them.
const moves = worksheetLog.map(r => r.edge);
const byDriver = driver => [...new Set(moves.filter(e => w.driverOf(e) === driver).map(e => w.PROCESSES[e.process].name.toLowerCase()))];
const hasCondensation = moves.some(e => e.via === 'condensation');
// Where is Earth's water?
const oceanPct = w.pctOfAll('oceans'), freshPct = w.FRESH_PCT;
const icePct = w.pctOfFresh('ice'), gwPct = w.pctOfFresh('groundwater');
const freshRest = w.whereLevels('fresh')[0].rest.share * 100;
// Climate: the chance of snow on a glacier when the droplet leaves the air.
const snowChance = climate => w.exits('atmosphere', { ...w.DEFAULT_CONDITIONS, climate }).find(e => e.to === 'glacier').chance * 100;
const [snowToday, snowColder, snowWarmer] = ['today', 'colder', 'warmer'].map(snowChance);
const pct = v => w.formatChance(v / 100).replace('%', '');
// Sun off: where a droplet from the soil can end up.
const sunOff = w.reachable('soil', { ...w.DEFAULT_CONDITIONS, sun: false });
// Longest and shortest typical stays in the model.
const byStay = [...w.STOP_IDS].sort((a, b) => years(a) - years(b));
const [shortest, nextShortest] = byStay, longestAll = byStay.at(-1);
const weeks = id => (years(id) * w.DAYS_PER_YEAR) / 7, days = id => years(id) * w.DAYS_PER_YEAR;

export const waterCycleActivity = {
  tool: 'water-cycle',
  toolName: 'Water Cycle Explorer',
  title: 'Water Cycle Journey Activity',
  grade: 'Grades 5–8',
  minutes: 15,
  standards: ['MS-ESS2-4', '5-ESS2-2'],
  goal: 'Follow one water droplet through Earth’s reservoirs, identify the processes that move it and what drives them, and compare how long water stays in each place.',
  steps: [
    'Open the Water Cycle Explorer. Keep the climate on Today, with the sun’s energy and gravity switched on.',
    `Start the droplet in the ocean and type ${WORKSHEET_JOURNEY.seed} as the chance code.`,
    `Press Let chance decide ${WORKSHEET_JOURNEY.moves} times. For each move, record the place the droplet left, how it moved, and the typical time it spent there.`,
    'Answer the questions. Use the Where is Earth’s water? view for question 3.',
  ],
  rowHeader: 'Move',
  record: ['Place it left', 'How it moved', 'Typical time there'],
  rows: worksheetLog.map(r => [String(r.step), { 'Place it left': w.STOP[r.from].name, 'How it moved': w.moveName(r.edge), 'Typical time there': w.stayText(r.from) }]),
  extra: `After ${WORKSHEET_JOURNEY.moves} moves the droplet is in: ______________ Total time: about ________ years`,
  extraAnswer: {
    a: `${cap(w.placeName(end))}. Total time: about ${w.grouped(totalYears)} years (${[...new Set([longest, ...otherYears])].map(id => `${w.grouped(years(id))} years in ${w.placeName(id)}`).join(', ')} and only about ${w.formatDuration(shortYears)} at all the other stops).`,
    checks: [[w.grouped(totalYears), totalYears], ...[...new Set([longest, ...otherYears])].map(id => [w.grouped(years(id)), years(id)]), [w.formatDuration(shortYears).split(' ')[0], shortYears * 12]],
  },
  keyNote: `Chance code ${WORKSHEET_JOURNEY.seed} always makes this journey from the ocean in today’s climate. If a table differs, check that the code is ${WORKSHEET_JOURNEY.seed}, the climate is Today and the droplet started in the ocean.`,
  questions: [
    {
      q: 'In which place did your droplet spend the most time? Why does water stay there so long?',
      lines: 2,
      a: `${cap(w.placeName(longest))}: about ${w.grouped(years(longest))} years. The ocean is so big (about ${w.formatPct(oceanPct)}% of Earth’s water) that, even though a lot evaporates every year, an average droplet waits thousands of years for its turn.`,
      checks: [[w.grouped(years(longest)), years(longest)], [w.formatPct(oceanPct), oceanPct]],
    },
    {
      q: 'Sort the processes on your journey: which were powered by the sun’s energy, and which by gravity?',
      lines: 2,
      a: `Sun’s energy: ${list(byDriver('sun'))}. Gravity: ${list(byDriver('gravity'))} (rain and snow fall because of gravity).${hasCondensation ? ' Condensation happens when vapor cools, before the rain or snow falls.' : ''}`,
    },
    {
      q: 'About what percent of Earth’s water is in the ocean? What percent is fresh? Where is most of the fresh water?',
      lines: 2,
      a: `About ${w.formatPct(oceanPct)}% is in the ocean, and only about ${w.fmt(freshPct)}% is fresh. About ${w.formatPct(icePct)}% of the fresh water is ice and snow and ${w.formatPct(gwPct)}% is groundwater, so lakes, rivers, the air and living things share only about ${w.formatPct(freshRest)}% of it.`,
      checks: [[w.formatPct(oceanPct), oceanPct], [w.fmt(freshPct), freshPct], [w.formatPct(icePct), icePct], [w.formatPct(gwPct), gwPct], [w.formatPct(freshRest), freshRest]],
    },
    {
      q: 'Try Colder and Warmer. When a droplet leaves the air, how does the chance of snow on a glacier change? What would happen to sea level in a much colder climate?',
      lines: 2,
      a: `Today ${pct(snowToday)}%, colder ${pct(snowColder)}%, warmer ${pct(snowWarmer)}%. In a colder climate more water falls as snow and stays frozen for a long time, so less flows back to the ocean and sea level falls, as it did in the last ice age.`,
      checks: [[pct(snowToday), snowToday], [pct(snowColder), snowColder], [pct(snowWarmer), snowWarmer]],
    },
    {
      q: 'Thought experiment: switch off the sun’s energy, start the droplet in the soil and let chance decide until it stops. Where does it end up, and why?',
      lines: 2,
      a: `It always ends in ${list(sunOff.stuck.map(w.placeName))} and stays there. With no energy from the sun nothing evaporates, transpires or melts, so gravity can only move water downhill until it reaches the sea.`,
      stuck: sunOff.stuck,
    },
    {
      q: 'In this model, which place holds a droplet the longest on average, and which the shortest?',
      lines: 2,
      a: `Longest: ${w.placeName(longestAll)}, about ${w.grouped(years(longestAll))} years (Antarctica). Shortest: ${w.placeName(shortest)}, about ${w.fmt(weeks(shortest))} week, then ${w.placeName(nextShortest)}, about ${w.fmt(days(nextShortest), 0)} days.`,
      checks: [[w.grouped(years(longestAll)), years(longestAll)], [w.fmt(weeks(shortest)), weeks(shortest)], [w.fmt(days(nextShortest), 0), days(nextShortest)]],
    },
  ],
};
