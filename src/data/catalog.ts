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
  /** "Vietnamese Music": a genre with songs, the first Home genre tile on 2026-10-12. */
  genreWithSongs: 10,
  /**
   * Songs reserved for the favorites tests, one per test, so their like-count deltas do not collide with each other
   * or with the song-1 tests (shared counters, `automation-analysis.md` §8). All have MP3 and lyrics (probe 2026-10-13).
   */
  songForFavoriteToggle: 1129,
  songForFavoritesPage: 2179,
  songForFavoriteRecord: 1349,
  /** No song has this id (code T-UNK). */
  unknownSongId: 99999999,
  /** No category / artist has this id; the API answers 204 today (known defects US-007-AC-05, US-009-AC-05). */
  unknownCategoryId: 99999999,
  unknownArtistId: 99999999,
} as const;
