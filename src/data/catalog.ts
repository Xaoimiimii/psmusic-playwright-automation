/**
 * Read-only catalog ids observed in the shared environment
 * (`docs/exploration/browser/test-data.md` §3, code T-CAT).
 */
export const catalog = {
  /** "Chờ Anh Nhé": has lyrics and MP3; used as the reference public song page. 30 other songs by its artists. */
  songWithMedia: 1,
  /** "Million Dollar Boy": `lyricUrl` is an empty string (found by API probe on 2026-10-06). */
  songWithoutLyrics: 933,
  /** "Halo": exactly 4 other songs by its artist, the largest count that shows no View More (probe 2026-10-06). */
  songWithFourOtherSongs: 1129,
  /** "Good Luck, Babe!": no other song by its artist, so the section is not rendered (probe 2026-10-06). */
  songWithoutOtherSongs: 1349,
  /** No song has this id (code T-UNK). */
  unknownSongId: 99999999,
} as const;
