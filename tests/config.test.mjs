import test from 'node:test';
import assert from 'node:assert/strict';
import { ads, adsEnabled, anyAds } from '../src/lib/ads.mjs';
import { site } from '../src/lib/site.mjs';
import { learningApps, currentApp } from '../src/lib/learning-apps.mjs';
import { labs, labBySection } from '../src/lib/labs.mjs';
import { activities } from '../src/lib/activities.mjs';

test('ad keys are empty or 32-character hex, and ads only run on this site', () => {
  for (const key of ['native', 'leaderboard', 'mobile', 'rectangle']) assert.match(ads[key], /^(|[0-9a-f]{32})$/, key);
  assert.match(ads.host, /^https:\/\/[a-z0-9.-]+$/);
  assert.equal(ads.domain, new URL(site.url).hostname);
  assert.equal(anyAds, Object.values(adsEnabled).some(Boolean));
  if (!ads.leaderboard || !ads.mobile) assert.equal(adsEnabled.leaderboard, false, 'the leaderboard needs both sizes');
});

test('site settings', () => {
  assert.equal(site.url, 'https://earthsciencelab.org');
  assert.match(site.analyticsId, /^(|G-[A-Z0-9]{6,})$/);
  assert.match(site.contactEmail, /@earthsciencelab\.org$/);
});

test('learning apps: Interactive Periodic Table first, canonical https URLs, this app current', () => {
  assert.equal(currentApp, 'earth');
  assert.equal(learningApps[0].name, 'Interactive Periodic Table');
  assert.deepEqual(learningApps.map(app => app.id), ['chemistry', 'physics', 'biology', 'astronomy', 'geometry', 'kids', 'earth']);
  for (const app of learningApps) assert.match(app.url, /^https:\/\/[a-z.]+$/, app.name);
  assert.ok(!learningApps.some(app => /football/i.test(app.name)));
});

test('labs: six complete entries, each with an activity and a search-friendly kind', () => {
  assert.equal(labs.length, 6);
  assert.deepEqual(labs.map(lab => lab.slug), activities.map(act => act.tool));
  for (const lab of labs) {
    for (const field of ['slug', 'name', 'section', 'topic', 'kind', 'blurb']) assert.ok(lab[field]?.length > 3, `${lab.slug}.${field}`);
    assert.equal(labBySection(lab.section), lab);
    assert.equal(activities.find(act => act.tool === lab.slug).toolName, lab.name);
    assert.match(lab.kind, /lab|simulation|practice|stream table/i, lab.slug);
  }
  assert.equal(new Set(labs.map(lab => lab.kind)).size, labs.length, 'kinds are unique');
});

test('home page title and description say what the site is', () => {
  assert.ok(site.defaultTitle.startsWith(site.name));
  assert.ok(site.defaultTitle.length <= 60, 'title fits a search result');
  assert.match(site.defaultTitle, /virtual labs/i);
  assert.match(site.defaultDescription, /earth science virtual labs and simulations/i);
  assert.ok(site.defaultDescription.length >= 120 && site.defaultDescription.length <= 155, `description is ${site.defaultDescription.length} characters`);
});
