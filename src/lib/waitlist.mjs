// Teacher-plan waitlist: build-time settings, the form's choices and small pure helpers shared by the teachers page,
// the after-share prompt, the privacy page and the tests. The service is the /api/waitlist route of the
// classroomlabs.org Worker. Its contract (field names, values and responses) is shared with the other lab sites, so
// change these values only together with it.

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
/** The teachers page section and the anchor the prompt and the service's redirect point at. */
export const SECTION_ID = 'teacher-plan';
/** Local storage key: when the after-share prompt was dismissed (milliseconds since 1970). */
export const PROMPT_KEY = 'waitlistPromptDismissed';
export const PROMPT_DAYS = 30;

export const ROLES = [
  ['teacher', 'Teacher'],
  ['school_leader', 'School leader'],
  ['district', 'District staff'],
  ['other', 'Other'],
];
export const INTERESTS = [
  ['class_results', 'Class results without student accounts'],
  ['editable_worksheets', 'Editable worksheets'],
  ['answer_keys', 'Editable answer keys'],
  ['quiz_banks', 'Quiz banks'],
  ['all_labs_licence', 'One license for all the labs'],
];
export const SCHOOL_BUYS = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['not_sure', 'Not sure'],
];
/** Where a signup came from on this site ('hub' belongs to classroomlabs.org). */
export const SOURCES = ['teachers_page', 'after_share'];

/** The fields the service accepts, in the contract's order. */
export const FIELDS = ['email', 'role', 'subjects', 'grades', 'interests', 'school_buys', 'site', 'source', 'consent', 'cf-turnstile-response', 'website', 'return'];

const usableEndpoint = value => /^https:\/\/[^\s/]+\/\S*$/.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/.test(value);

/**
 * Reads PUBLIC_WAITLIST_ENDPOINT and PUBLIC_TURNSTILE_SITE_KEY (pass `import.meta.env`). Unless both are set, the
 * form, the prompt, the Turnstile script and the privacy paragraph are all left out.
 */
export function waitlistConfig(env = {}) {
  const endpoint = String(env.PUBLIC_WAITLIST_ENDPOINT ?? '').trim();
  const siteKey = String(env.PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
  return { endpoint, siteKey, enabled: usableEndpoint(endpoint) && siteKey.length > 0 };
}

/** The `return` field: the page's absolute URL plus #teacher-plan, without any query string. */
export function returnUrl(pageUrl) {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = SECTION_ID;
  return url.href;
}

/** The after-share prompt's link to the teachers page section. */
export const promptHref = teachersPath => `${teachersPath}?source=after_share#${SECTION_ID}`;

/** The hidden `source` field for this visit: `after_share` when the prompt sent the teacher here. */
export function sourceFrom(search) {
  const value = new URLSearchParams(search).get('source');
  return SOURCES.includes(value) ? value : 'teachers_page';
}

/** The service's `?waitlist=ok|<error>` after a form post, or null. */
export function resultFrom(search) {
  const value = new URLSearchParams(search).get('waitlist');
  return value && /^[a-z_]{1,40}$/.test(value) ? value : null;
}

/** The JSON body for the service, from the form's entries (a FormData or [name, value] pairs). */
export function payloadFrom(entries) {
  const payload = { interests: [] };
  for (const [name, raw] of entries) {
    if (typeof raw !== 'string' || name === 'return' || !FIELDS.includes(name)) continue;
    if (name === 'interests') payload.interests.push(raw);
    else payload[name] = name === 'email' ? raw.trim() : raw;
  }
  return payload;
}

/** Analytics parameters for `waitlist_signup`: the site, role and source, never the email or anything typed. */
export const signupEvent = payload => ({ site: String(payload.site ?? ''), role: String(payload.role ?? ''), source: String(payload.source ?? '') });

/** What to show for a result code: the service's codes, plus `pending` (no Turnstile token yet) and `network`. */
export function messageFor(code, contactEmail) {
  const texts = {
    ok: 'Thank you, you’re on the list. We’ll email you about the teacher plan before anyone else hears about it.',
    invalid_email: 'That email address doesn’t look right. Please check it and send the form again.',
    invalid_field: 'One of the answers wasn’t accepted. Please check the form and send it again.',
    consent_required: 'Please tick the box agreeing that we can contact you, then send the form again.',
    turnstile_failed: 'The spam check didn’t go through. Please let it run again, then send the form.',
    pending: 'The spam check above the button hasn’t finished yet. Give it a moment, then send the form again.',
    rate_limited: 'Too many signups have come from your connection in a short time. Please try again in a few minutes.',
    bad_origin: `The form couldn’t be sent from this page. Please email ${contactEmail} and we’ll add you to the list.`,
    network: `We couldn’t reach the signup service. Check your connection and try again, or email ${contactEmail}.`,
  };
  const text = texts[code] ?? `Something went wrong and you’re not on the list yet. Please try again, or email ${contactEmail}.`;
  return { kind: code === 'ok' ? 'success' : 'error', text };
}

/** Whether the after-share prompt was dismissed less than 30 days ago. Storage may be missing or throw. */
export function promptDismissed(storage, now = Date.now()) {
  try {
    const at = Number(storage?.getItem(PROMPT_KEY));
    return at > 0 && now - at < PROMPT_DAYS * 864e5;
  } catch {
    return false;
  }
}

export function dismissPrompt(storage, now = Date.now()) {
  try {
    storage?.setItem(PROMPT_KEY, String(now));
  } catch {
    /* Private mode or blocked storage: the prompt may show again, which is harmless. */
  }
}
