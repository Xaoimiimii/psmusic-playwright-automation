/**
 * Player volume values (US-013-AC-06). The default comes from `PlayerContext.jsx` (`useState(0.7)`), confirmed at
 * runtime on 2026-10-09 (`docs/exploration/browser/pages-and-locators.md` §10, volume rows).
 */
export const playerVolume = {
  /** Volume of a fresh session: 70%. */
  default: 0.7,
  /** A non-default level, so restoring after unmute is distinguishable from the default and the 0.5 fallback. */
  changed: 0.3,
  muted: 0,
} as const;
