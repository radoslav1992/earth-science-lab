import test from 'node:test';
import assert from 'node:assert/strict';
import { ads, adsEnabled, anyAds } from '../src/lib/ads.mjs';
import { site } from '../src/lib/site.mjs';
import { learningApps, currentApp } from '../src/lib/learning-apps.mjs';

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
