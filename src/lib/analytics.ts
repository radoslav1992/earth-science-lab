// GA4 events. A no-op unless a Google tag (or the consent defaults' gtag stub) exists.
// Never send personal data: only tool settings and results.
type Params = Record<string, string | number | boolean>;
export function track(name: string, params: Params = {}) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === 'function') gtag('event', name, params);
}

/** Site-wide listeners: Share to Google Classroom links and print buttons. */
export function trackCommonEvents() {
  document.addEventListener('click', event => {
    const target = event.target as Element | null;
    const share = target?.closest('[data-share-classroom]');
    if (share) track('share_classroom', { page: location.pathname });
    const print = target?.closest('[data-print]');
    if (print) { track('worksheet_print', { page: location.pathname }); window.print(); }
  });
}
