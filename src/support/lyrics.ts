import type { APIRequestContext } from '@playwright/test';

/** An LRC line the song page renders: it starts with a `[mm:ss.xx]` time tag (`SongViewPage.jsx`). */
const TIME_TAGGED_LINE = /\[(\d+):(\d+\.\d+)\](.*)/;

/** Number of time-tagged lines in the song's LRC file on S3: the number of lyric lines the page must show. */
export async function timeTaggedLineCount(request: APIRequestContext, lyricUrl: string): Promise<number> {
  const response = await request.get(lyricUrl);
  if (!response.ok()) throw new Error(`Test setup: lyric file ${lyricUrl} returned ${response.status()}`);
  return (await response.text()).split('\n').filter((line) => TIME_TAGGED_LINE.test(line)).length;
}
