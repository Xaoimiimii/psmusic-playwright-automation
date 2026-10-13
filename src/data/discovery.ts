/**
 * Discovery limits and ordering (US-005, US-008), from `HomePage.jsx` (`slice(0, 8)`, `slice(0, 10)`) and
 * `TopChartsPage.jsx` (10 charts of 10 songs, genres 10 and 26 moved to the front). Observed 2026-10-13.
 */
export const discoveryLimits = {
  homeGenres: 8,
  homeArtists: 10,
  charts: 10,
  chartRows: 10,
} as const;

/** Genre ids shown first on Charts, in this order: 10 "Nhạc Việt" (Vietnamese Music), 26 "Âu Mỹ" (Western Music). */
export const chartsFirst: readonly number[] = [10, 26];
