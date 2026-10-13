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

/** Titles longer than this are cut and end with "..." in the player bar (`PlayerControl.jsx` `formatSongTitle`, US-013-AC-08). */
export const PLAYER_TITLE_MAX_LENGTH = 25;

/** Title as the player bar shows it. */
export function playerBarTitle(title: string): string {
  return title.length > PLAYER_TITLE_MAX_LENGTH ? `${title.slice(0, PLAYER_TITLE_MAX_LENGTH)}...` : title;
}

/**
 * Queue refill (`PlayerContext.jsx` `playNextSong`, US-013-AC-03): Next asks for another `next-batch` once the song it
 * starts and the songs after it are 3 or fewer (`queue.length - nextIndex <= 3`); observed on 2026-10-12 as the 8th
 * Next after a fresh start. The refill is appended in its response order. Default batch size 10
 * (`SongController.GetNextBatch`).
 */
export const queueRefill = {
  remainingSongs: 3,
  batchSize: 10,
} as const;
