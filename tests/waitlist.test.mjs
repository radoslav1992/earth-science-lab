// Teacher plan waitlist: the helpers in src/lib/waitlist.mjs, and two real builds into temporary folders, one with
// PUBLIC_WAITLIST_ENDPOINT and PUBLIC_TURNSTILE_SITE_KEY empty and one with test values. Checks that nothing renders
// while they are empty, that the form matches the service's contract when they are set, that student pages never get
// the form or the Turnstile script, and that the privacy page follows the switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INTERESTS, PROMPT_KEY, ROLES, SCHOOL_BUYS, TURNSTILE_SCRIPT, dismissPrompt, messageFor, payloadFrom, promptDismissed,
  promptHref, resultFrom, returnUrl, signupEvent, sourceFrom, waitlistConfig,
} from '../src/lib/waitlist.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ENDPOINT = 'https://classroomlabs.org/api/waitlist';
const SITE_KEY = '1x00000000000000000000AA'; // Cloudflare's public "always passes" test key
const TEACHERS_URL = 'https://earthsciencelab.org/teachers/';

test('the waitlist is on only when both settings are set', () => {
  assert.equal(waitlistConfig({}).enabled, false);
  assert.equal(waitlistConfig({ PUBLIC_WAITLIST_ENDPOINT: '', PUBLIC_TURNSTILE_SITE_KEY: '' }).enabled, false);
  assert.equal(waitlistConfig({ PUBLIC_WAITLIST_ENDPOINT: ENDPOINT }).enabled, false);
  assert.equal(waitlistConfig({ PUBLIC_TURNSTILE_SITE_KEY: SITE_KEY }).enabled, false);
  assert.equal(waitlistConfig({ PUBLIC_WAITLIST_ENDPOINT: 'classroomlabs.org/api', PUBLIC_TURNSTILE_SITE_KEY: SITE_KEY }).enabled, false);
  assert.deepEqual(waitlistConfig({ PUBLIC_WAITLIST_ENDPOINT: ` ${ENDPOINT} `, PUBLIC_TURNSTILE_SITE_KEY: ` ${SITE_KEY}\n` }), { endpoint: ENDPOINT, siteKey: SITE_KEY, enabled: true });
});

test('choices match the service contract', () => {
  assert.deepEqual(ROLES.map(([value]) => value), ['teacher', 'school_leader', 'district', 'other']);
  assert.deepEqual(INTERESTS.map(([value]) => value), ['class_results', 'editable_worksheets', 'answer_keys', 'quiz_banks', 'all_labs_licence']);
  assert.deepEqual(SCHOOL_BUYS.map(([value]) => value), ['yes', 'no', 'not_sure']);
  // Visible text uses American spelling even though the contract's value says "licence".
  assert.ok(!INTERESTS.some(([, label]) => /licence/i.test(label)));
});

test('return URL, prompt link, source and result from the address', () => {
  assert.equal(returnUrl(TEACHERS_URL), 'https://earthsciencelab.org/teachers/#teacher-plan');
  assert.equal(returnUrl(`${TEACHERS_URL}?waitlist=ok#faq`), 'https://earthsciencelab.org/teachers/#teacher-plan');
  assert.equal(promptHref('/teachers/'), '/teachers/?source=after_share#teacher-plan');
  assert.equal(sourceFrom('?source=after_share'), 'after_share');
  assert.equal(sourceFrom(''), 'teachers_page');
  assert.equal(sourceFrom('?source=hub'), 'teachers_page');
  assert.equal(sourceFrom('?source=<script>'), 'teachers_page');
  assert.equal(resultFrom('?waitlist=ok'), 'ok');
  assert.equal(resultFrom('?source=after_share&waitlist=rate_limited'), 'rate_limited');
  assert.equal(resultFrom('?waitlist=%3Cb%3E'), null);
  assert.equal(resultFrom(''), null);
});

test('the JSON payload follows the contract and analytics never get the email or free text', () => {
  const entries = [
    ['email', '  Teacher@Example.org '], ['role', 'teacher'], ['subjects', 'Earth science'], ['grades', '6-8'],
    ['interests', 'quiz_banks'], ['interests', 'answer_keys'], ['school_buys', 'not_sure'], ['website', ''],
    ['consent', 'yes'], ['site', 'earthsciencelab.org'], ['source', 'after_share'], ['return', `${TEACHERS_URL}#teacher-plan`],
    ['cf-turnstile-response', 'token'], ['unexpected', 'x'],
  ];
  const payload = payloadFrom(entries);
  assert.deepEqual(payload, {
    email: 'Teacher@Example.org', role: 'teacher', subjects: 'Earth science', grades: '6-8', interests: ['quiz_banks', 'answer_keys'],
    school_buys: 'not_sure', website: '', consent: 'yes', site: 'earthsciencelab.org', source: 'after_share', 'cf-turnstile-response': 'token',
  });
  assert.deepEqual(payloadFrom([['email', 'a@b.org']]).interests, [], 'interests is always an array');
  const event = signupEvent(payload);
  assert.deepEqual(event, { site: 'earthsciencelab.org', role: 'teacher', source: 'after_share' });
  const sent = JSON.stringify(event);
  for (const secret of ['Teacher@Example.org', 'Earth science', '6-8', 'token']) assert.ok(!sent.includes(secret), secret);
});

test('the page sends only signupEvent() to analytics', () => {
  const component = readFileSync(join(root, 'src/components/TeacherPlan.astro'), 'utf8');
  const calls = [...component.matchAll(/track\(([^;]*)\);/g)].map(m => m[1]);
  assert.deepEqual(calls, ["'waitlist_signup', signupEvent(payload)"]);
  const prompt = readFileSync(join(root, 'src/components/SharePrompt.astro'), 'utf8');
  assert.deepEqual([...prompt.matchAll(/track\(([^;]*)\);/g)].map(m => m[1]), ["'waitlist_prompt_click', { page: location.pathname }"]);
});

test('every result code has a message; only ok is a success', () => {
  for (const code of ['invalid_email', 'invalid_field', 'consent_required', 'turnstile_failed', 'bad_origin', 'rate_limited', 'network', 'pending', 'something_new']) {
    const { kind, text } = messageFor(code, 'info@earthsciencelab.org');
    assert.equal(kind, 'error', code);
    assert.ok(text.length > 20, code);
  }
  assert.equal(messageFor('ok', 'x').kind, 'success');
  assert.match(messageFor('network', 'info@earthsciencelab.org').text, /info@earthsciencelab\.org/);
});

test('a dismissed prompt stays away for 30 days, and broken storage never throws', () => {
  const store = new Map();
  const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  const now = Date.UTC(2026, 10, 19);
  assert.equal(promptDismissed(storage, now), false);
  dismissPrompt(storage, now);
  assert.equal(store.get(PROMPT_KEY), String(now));
  assert.equal(promptDismissed(storage, now + 29 * 864e5), true);
  assert.equal(promptDismissed(storage, now + 30 * 864e5), false);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(promptDismissed(broken, now), false);
  assert.doesNotThrow(() => dismissPrompt(broken, now));
  assert.equal(promptDismissed(null, now), false);
});

// ---- Built site, both ways ----

const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
function build(env) {
  const outDir = mkdtempSync(join(tmpdir(), 'esl-waitlist-'));
  const result = spawnSync(process.execPath, [join(root, 'node_modules/astro/astro.js'), 'build', '--outDir', outDir], {
    cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `astro build failed:\n${result.stdout}\n${result.stderr}`);
  const pages = {};
  for (const file of walk(outDir).filter(f => f.endsWith('.html'))) {
    const path = '/' + relative(outDir, file).split('\\').join('/').replace(/index\.html$/, '');
    pages[path] = readFileSync(file, 'utf8');
  }
  rmSync(outDir, { recursive: true, force: true });
  return pages;
}
const attrs = tag => Object.fromEntries([...tag.matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)].map(m => [m[1], (m[2] ?? '').replace(/&amp;/g, '&')]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(m => attrs(m[0]));
const turnstileScripts = html => (html.match(/<script[^>]*challenges\.cloudflare\.com[^>]*>/g) ?? []).length;

test('built with the settings empty: no form, no Turnstile, no prompt, privacy unchanged', () => {
  const pages = build({ PUBLIC_WAITLIST_ENDPOINT: '', PUBLIC_TURNSTILE_SITE_KEY: '' });
  const teachers = pages['/teachers/'];
  assert.ok(teachers, 'teachers page built');
  assert.ok(!teachers.includes('data-waitlist-form') && !teachers.includes('id="teacher-plan"'));
  for (const [path, html] of Object.entries(pages)) {
    assert.equal(turnstileScripts(html), 0, path);
    assert.ok(!html.includes('challenges.cloudflare.com'), path);
    assert.ok(!html.includes('data-share-prompt'), path);
    assert.ok(!html.includes('source=after_share'), path);
  }
  const privacy = pages['/privacy/'];
  assert.ok(!privacy.includes('teacher-plan-waitlist') && !privacy.includes('waitlistPromptDismissed'));
  assert.match(privacy, /we never ask for names or email addresses/);
  assert.match(privacy, /up to three small values/);
});

test('built with test settings: the teachers page form matches the contract; student pages stay clean', () => {
  const pages = build({ PUBLIC_WAITLIST_ENDPOINT: ENDPOINT, PUBLIC_TURNSTILE_SITE_KEY: SITE_KEY });
  const html = pages['/teachers/'];
  assert.match(html, /<section[^>]*id="teacher-plan"/);
  assert.equal(turnstileScripts(html), 1);
  assert.ok(html.includes(`src="${TURNSTILE_SCRIPT}"`));

  const form = html.slice(html.indexOf('<form'), html.indexOf('</form>'));
  assert.equal(tags(html, 'form').length, 1);
  const formTag = tags(form, 'form')[0];
  assert.equal(formTag.method, 'post');
  assert.equal(formTag.action, ENDPOINT);
  const inputs = tags(form, 'input');
  const byName = name => inputs.filter(i => i.name === name);

  const [email] = byName('email');
  assert.equal(email.type, 'email');
  assert.ok('required' in email);
  assert.equal(email.autocomplete, 'email');
  const role = form.match(/<select[^>]*name="role"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(role && /\brequired\b/.test(role[0]));
  assert.deepEqual(tags(role[1], 'option').map(o => o.value), ROLES.map(([v]) => v));
  assert.equal(byName('subjects')[0].maxlength, '200');
  assert.equal(byName('grades')[0].maxlength, '100');
  assert.deepEqual(byName('interests').map(i => [i.type, i.value]), INTERESTS.map(([v]) => ['checkbox', v]));
  assert.deepEqual(byName('school_buys').map(i => [i.type, i.value]), SCHOOL_BUYS.map(([v]) => ['radio', v]));
  assert.ok(!byName('school_buys').some(i => 'checked' in i));

  const [consent] = byName('consent');
  assert.equal(consent.type, 'checkbox');
  assert.equal(consent.value, 'yes');
  assert.ok('required' in consent && !('checked' in consent), 'consent is required and unticked');
  assert.match(form, /name="consent"[^>]*>\s*<span[^>]*>[^<]*<a href="\/privacy\/#teacher-plan-waitlist"/);

  const [honeypot] = byName('website');
  assert.equal(honeypot.tabindex, '-1');
  assert.equal(honeypot.autocomplete, 'off');
  assert.match(form, /<div class="waitlist-hp"[^>]*aria-hidden="true"[^>]*>\s*<label[^>]*>Website<\/label>\s*<input[^>]*name="website"/);

  const hidden = Object.fromEntries(inputs.filter(i => i.type === 'hidden').map(i => [i.name, i.value]));
  assert.deepEqual(hidden, { site: 'earthsciencelab.org', source: 'teachers_page', return: 'https://earthsciencelab.org/teachers/#teacher-plan' });
  const widget = tags(form, 'div').find(d => (d.class ?? '').split(' ').includes('cf-turnstile'));
  assert.equal(widget['data-sitekey'], SITE_KEY);
  assert.match(form, /role="status"[^>]*aria-live="polite"/);

  for (const [path, page] of Object.entries(pages)) {
    if (path === '/teachers/') continue;
    assert.ok(!page.includes('data-waitlist-form') && !/name="email"/.test(page), `${path} has no waitlist form`);
    assert.equal(turnstileScripts(page), 0, `${path} loads no Turnstile`);
    assert.ok(!page.includes('cf-turnstile'), path);
  }
  // The after-share prompt is on every page, as a link only.
  const lab = pages['/tools/earthquake-epicenter/'];
  assert.ok(lab.includes('data-share-prompt') && lab.includes('href="/teachers/?source=after_share#teacher-plan"'));
  assert.ok(!/<template[^>]*data-share-prompt-template[^>]*>[\s\S]*?<form/.test(lab));

  const privacy = pages['/privacy/'];
  assert.match(privacy, /<h2 id="teacher-plan-waitlist">Teacher plan waitlist<\/h2>/);
  for (const phrase of ['to contact you about the teacher plan', 'Cloudflare stores and processes them', 'deleted 12 months after they were made', 'No student data is collected', 'Cloudflare Turnstile, which runs only on the teachers page', 'waitlistPromptDismissed', 'up to four small values']) {
    assert.ok(privacy.includes(phrase), phrase);
  }
  assert.ok(!privacy.includes('we never ask for names or email addresses'), 'no longer claims no email addresses are collected');
  const description = privacy.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(description.length >= 120 && description.length <= 160, `privacy description is ${description.length} characters`);
});
