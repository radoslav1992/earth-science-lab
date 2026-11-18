// Which built pages search engines should index. astro.config.mjs filters the sitemap with isIndexable, the layout
// defaults its robots tag from it, and tests/site.test.mjs and scripts/check-build.mjs check the built site.
//
// - /404/: the error page.
// - /teachers/answers/<lab>/: teacher answer keys, linked only from /teachers/.
// - /tools/<lab>/activity/: the printable one-page student activities. Measured in November 2026, the eight are
//   blank worksheets (a results table and write-in lines) of 287–386 words (median 356); under a tenth of each is
//   wording shared with the other seven, and none repeats its lab page. That is the same kind of page as the Biology
//   Lab's activities, so they follow the same rule: kept for teachers and linked from their lab, the Labs hub, the
//   home page and the teacher hub, but out of the index, so the lab is the page that ranks.
export const noindexPatterns = [/^\/404(\/|\.html)?$/, /^\/teachers\/answers\//, /\/activity\/$/];
/** path: a site path such as "/tools/plate-map/" (or a full URL). */
export const isIndexable = path => {
  const p = /^https?:/.test(path) ? new URL(path).pathname : path;
  return !noindexPatterns.some(re => re.test(p));
};
