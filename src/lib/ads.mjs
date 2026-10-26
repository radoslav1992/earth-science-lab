// Adsterra ad units, copied from the Adsterra publisher dashboard once the site is approved.
// While the keys are empty, AdSlot renders nothing at all (no reserved space, no requests).
// Ads load only on `domain`, so local and preview builds stay ad-free.
export const ads = {
  domain: 'earthsciencelab.org',
  host: 'https://bauval.org',
  native: '',
  leaderboard: '', // 728×90, wide screens
  mobile: '', // 320×50, phones
  rectangle: '', // 300×250
};

// The leaderboard needs both its desktop and phone sizes.
export const adsEnabled = {
  leaderboard: Boolean(ads.leaderboard && ads.mobile),
  rectangle: Boolean(ads.rectangle),
  native: Boolean(ads.native),
};
export const anyAds = Object.values(adsEnabled).some(Boolean);
