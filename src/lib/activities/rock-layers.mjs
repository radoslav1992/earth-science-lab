// The Rock Layers Lab's classroom activity, in the same shape as the entries in ../activities.mjs.
// The table is the decay model's own output for 0 to 4 half-lives of uranium-235, the orders come from the
// cross-sections' own histories, and each `checks` entry pairs a number printed in an answer with the value
// the model computes (tests/rock-layers.test.mjs fails if a printed number drifts or goes unchecked).
import * as m from '../rock-layers.mjs';

// NGSS performance expectations referenced below, paraphrased.
export const standards = {
  'MS-ESS1-4': 'Construct a scientific explanation based on evidence from rock strata for how the geologic time scale is used to organize Earth’s 4.6-billion-year-old history.',
  'HS-ESS1-6': 'Apply scientific reasoning and evidence from ancient Earth materials, meteorites, and other planetary surfaces to construct an account of Earth’s formation and early history.',
};

// The half-life table: uranium-235 after 0, 1, 2, 3 and 4 half-lives.
export const TABLE_ISOTOPE = 'u235';
export const TABLE_HALF_LIVES = [0, 1, 2, 3, 4];
const iso = m.isotope(TABLE_ISOTOPE);
/** One table row, exactly as part 2 of the lab reports it. */
export function decayRow(halfLives) {
  const years = halfLives * iso.halfLife;
  const fraction = m.fractionLeft(years, iso.halfLife);
  return {
    'Parent left (%)': m.fmtPercent(100 * fraction),
    'Daughter (%)': m.fmtPercent(100 - 100 * fraction),
    'Daughter ÷ parent': String(m.daughterPerParent(fraction)),
    'Age (million years)': m.fmtMyr(years),
  };
}

// The cross-sections used on the worksheet.
const canyon = m.sectionById('canyon'), fault = m.sectionById('fault');
const letters = section => m.trueOrder(section).join(', ');
const phrase = (section, id) => m.eventPhrase(m.eventById(section, id));
const canyonOrder = m.trueOrder(canyon);
const evidence = (section, older, younger) => m.constraints(section).find(c => c.older === older && c.younger === younger);
const faultDike = evidence(fault, 'F', 'D');
const faultCuts = evidence(fault, 'J', 'F');
const bq = m.bracketQuestion(canyon);
const oldAge = m.sampleAge(canyon, bq.older), youngAge = m.sampleAge(canyon, bq.younger);
const oldLeft = m.eventById(canyon, bq.older).sample.left;
const oldHalfLives = m.halfLivesElapsed(oldAge, iso.halfLife);
const youngLeft = m.eventById(canyon, bq.younger).sample.left;
const youngHalfLives = m.halfLivesElapsed(youngAge, iso.halfLife);
const cap = text => text[0].toUpperCase() + text.slice(1);
// Carbon-14 after ten half-lives, and how many half-lives fit in 100 million years.
const c14 = m.isotope('c14');
const tenHalfLives = 10 * c14.halfLife;
const leftAfterTen = 100 * m.fractionLeft(tenHalfLives, c14.halfLife);
const boneAgeMillion = 100;
const boneHalfLives = Math.round(m.halfLivesElapsed(boneAgeMillion * 1e6, c14.halfLife) / 100) * 100;
const n = value => value.toLocaleString('en-US');

export const activity = {
  tool: 'rock-layers',
  toolName: 'Rock Layers Lab',
  title: 'Relative and Radiometric Dating Activity',
  grade: 'Grades 6–10',
  minutes: 15,
  standards: ['MS-ESS1-4', 'HS-ESS1-6'],
  goal: 'Put the events in a rock cross-section in order using the rules of relative dating, find the age of igneous rocks from half-lives, and use both to bracket the age of a layer.',
  steps: [
    `Open the Rock Layers Lab and choose part 2, Radiometric dating. Pick ${iso.parent.toLowerCase()} → ${iso.daughter.toLowerCase()}.`,
    'Press the half-life buttons 0 to 4 in turn. Record the numbers in the table.',
    'Go to part 1, Rock layers. Put the events of cross-section 1 in order, oldest first, and check your order. Do the same for cross-section 2.',
    'Under cross-section 1, work out the ages of the two ash beds. Then answer the questions.',
  ],
  rowHeader: 'Half-lives passed',
  record: ['Parent left (%)', 'Daughter (%)', 'Daughter ÷ parent', 'Age (million years)'],
  rows: TABLE_HALF_LIVES.map(h => [String(h), decayRow(h)]),
  extra: 'Cross-section 1, oldest to youngest: ____ , ____ , ____ , ____ , ____        Cross-section 2: ____ , ____ , ____ , ____ , ____ , ____ , ____',
  extraAnswer: {
    a: `Cross-section ${canyon.level}: ${letters(canyon)}. Cross-section ${fault.level}: ${letters(fault)}.`,
    checks: [[String(canyon.level), canyon.level], [String(fault.level), fault.level]],
  },
  keyNote: `Values come from part 2 of the lab with ${iso.parent.toLowerCase()} (half-life ${m.fmtYears(iso.halfLife)}). The daughter is ${iso.daughter.toLowerCase()}. Letters on the cross-sections are labels only.`,
  questions: [
    {
      q: 'In cross-section 1, which layer is the oldest and which is the youngest? Which rule tells you?',
      lines: 2,
      a: `${m.eventName(m.eventById(canyon, canyonOrder[0]))} ${canyonOrder[0]}, at the bottom, is the oldest, and ${phrase(canyon, canyonOrder.at(-1))}, at the top, is the youngest. The rule is superposition: in layers that have not been turned over, each layer is younger than the one below it.`,
    },
    {
      q: 'In cross-section 2, which is younger: the fault or the dike? What is your evidence?',
      lines: 2,
      a: `The dike. ${m.evidenceSentence(faultDike)} Both are younger than the layers: ${faultCuts.see.charAt(0).toLowerCase()}${faultCuts.see.slice(1)}. This is the rule of cross-cutting relationships.`,
    },
    {
      q: `In cross-section 1, the zircon crystals in ${phrase(canyon, bq.older)} have ${m.fmtPercent(oldLeft)}% of their ${iso.parent.toLowerCase()} left. How many half-lives have passed, and how old is the ash bed?`,
      lines: 2,
      a: `100% → 50% → 25% is ${m.fmtHalfLives(oldHalfLives)} half-lives. Age = ${m.fmtHalfLives(oldHalfLives)} × ${m.fmtMyr(iso.halfLife)} = ${m.fmtMyr(oldAge)} million years.`,
      checks: [['100', 100], ['50', 100 * m.fractionLeft(iso.halfLife, iso.halfLife)], ['25', oldLeft], [m.fmtHalfLives(oldHalfLives), oldHalfLives], [m.fmtMyr(iso.halfLife), iso.halfLife / 1e6], [m.fmtMyr(oldAge), oldAge / 1e6]],
    },
    {
      q: `${cap(phrase(canyon, bq.younger))} has ${m.fmtPercent(youngLeft)}% of its ${iso.parent.toLowerCase()} left. How old is it? What can you say about the age of ${phrase(canyon, bq.target)}, which lies between the two ash beds?`,
      lines: 2,
      a: `${m.fmtPercent(youngLeft)}% left is ${m.fmtHalfLives(youngHalfLives)} half-life, so ${phrase(canyon, bq.younger)} is ${m.fmtMyr(youngAge)} million years old. ${cap(phrase(canyon, bq.target))} lies above ${phrase(canyon, bq.older)}, so it is younger than ${m.fmtMyr(oldAge)} million years, and below ${phrase(canyon, bq.younger)}, so it is older than ${m.fmtMyr(youngAge)} million years. Its age is between ${m.fmtMyr(youngAge)} and ${m.fmtMyr(oldAge)} million years.`,
      checks: [[m.fmtPercent(youngLeft), youngLeft], [m.fmtHalfLives(youngHalfLives), youngHalfLives], [m.fmtMyr(youngAge), youngAge / 1e6], [m.fmtMyr(oldAge), oldAge / 1e6]],
    },
    {
      q: 'Why do geologists date the ash beds and not the shale itself?',
      lines: 2,
      a: 'The crystals in volcanic ash formed when the ash erupted, so their age is the age of the bed. Shale is made of mud worn from older rocks, so its grains are older than the layer. Dated igneous rocks above and below bracket its age instead.',
    },
    {
      q: `Carbon-14 has a half-life of ${n(c14.halfLife)} years. Explain why it cannot be used to date a dinosaur bone that is ${boneAgeMillion} million years old.`,
      lines: 2,
      a: `After 10 half-lives (${n(tenHalfLives)} years) less than ${m.fmtPercent(Math.ceil(leftAfterTen * 10) / 10)}% of the carbon-14 is left, which is too little to measure well. ${boneAgeMillion} million years is about ${n(boneHalfLives)} half-lives, so no carbon-14 is left at all. Geologists date volcanic rock near the bone with a slowly decaying parent such as uranium or potassium-40.`,
      checks: [['10', tenHalfLives / c14.halfLife], [n(tenHalfLives), tenHalfLives], [m.fmtPercent(Math.ceil(leftAfterTen * 10) / 10), leftAfterTen], [String(boneAgeMillion), boneAgeMillion], [n(boneHalfLives), m.halfLivesElapsed(boneAgeMillion * 1e6, c14.halfLife)]],
    },
  ],
};
