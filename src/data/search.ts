import type { SearchItem, SearchResponse } from '../api/search-api';

/**
 * Search test data. Real keywords are catalog names indexed at API startup (`docs/exploration/browser/search.md` §5,
 * re-observed 2026-10-13); they stay valid while these rows exist in PostgreSQL when the API starts.
 */
export const searchData = {
  /** Exact artist name: top result artist 27; case does not matter. */
  artist: { keyword: 'Binz', id: 27, name: 'Binz' },
  /** Exact song title with diacritics: top result song 1. */
  song: { keyword: 'Chờ Anh Nhé', id: 1, name: 'Chờ Anh Nhé' },
  /** Artist with diacritics: top result artist 13. */
  artistWithDiacritics: { keyword: 'Dương Domic', id: 13, name: 'Dương Domic' },
  /** Matches nothing: `{ topResult: null, results: [], total: 0, totalPages: 0 }`. */
  noMatch: 'xyzqwvzz',
  /** Typed with surrounding spaces: Enter must search for the trimmed text. */
  paddedKeyword: '  Chờ Anh Nhé  ',
} as const;

/** Minimum length before the header asks for suggestions, and the typing pause (`Header.jsx`). */
export const suggestionRule = { minLength: 2, debounceMs: 300 } as const;

const binz: SearchItem = {
  type: 'artist', id: 27, name: 'Binz', avatarUrl: 'https://i.scdn.co/image/ab6761610000f178c1e37930853ff1686dcdd567',
  mp3Url: null, duration: '00:00:00', artists: [],
};
const choAnhNhe: SearchItem = {
  type: 'song', id: 1, name: 'Chờ Anh Nhé', avatarUrl: 'https://i.scdn.co/image/ab67616d00001e02a09fb80b07fb17f8ab7b844a',
  mp3Url: 'https://psmusic.s3.ap-southeast-2.amazonaws.com/songs/MP3/Ch%E1%BB%9D%20Anh%20Nh%C3%A9%20-%20Ho%C3%A0ng%20D%C5%A9ng.mp3',
  duration: '00:05:22.5600000', artists: [{ id: 1, name: 'Hoàng Dũng' }, { id: 2, name: 'Hoàng Rob' }],
};

/**
 * Controlled search responses for the UI scenarios (`automation-analysis.md` §3.5), in the shape observed from the
 * real API: an artist as top result followed by a song, and the empty result. TS-SRCH-08 checks the real index.
 */
export const searchFixtures: { withArtistAndSong: SearchResponse; empty: SearchResponse } = {
  withArtistAndSong: { topResult: binz, results: [choAnhNhe], total: 2, totalPages: 1 },
  empty: { topResult: null, results: [], total: 0, totalPages: 0 },
};
