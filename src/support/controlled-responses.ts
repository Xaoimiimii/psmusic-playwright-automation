import { test, type Page } from '@playwright/test';
import { searchRoutes, type SearchResponse } from '../api/search-api';
import { songRoutes, type NextBatchSong, type ReviewSubmission, type SongPlayer } from '../api/song-api';
import { env } from '../config/env';
import { serverMessage } from '../data/messages';

/**
 * PSMusic API responses answered in the browser (`page.route`), the "controlled response" lever of
 * `automation-analysis.md` §1 item 2: client behavior is tested without writing permanent data to the shared
 * database. Each helper records an annotation, so the report says which response was not the real one.
 */

function apiUrl(route: string): string {
  return new URL(route, env.apiBaseUrl).href;
}

function annotate(description: string): void {
  test.info().annotations.push({ type: 'controlled-response', description });
}

/**
 * Answers the member's stream request (`POST /api/song/stream/{id}`, sent once playback passes 20 s) with 200 in the
 * browser, so a member test that plays music writes no permanent stream row (TR-01).
 */
export async function holdStreamRecording(page: Page): Promise<void> {
  annotate('POST /api/song/stream/{id} is answered with 200 in the browser: no stream is recorded.');
  const streamPath = /^\/api\/song\/stream\/\d+$/;
  const apiOrigin = new URL(env.apiBaseUrl).origin;
  await page.route(
    (url) => url.origin === apiOrigin && streamPath.test(url.pathname),
    (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 200 }) : route.fallback()),
  );
}

/**
 * Makes the play queue end: the first `next-batch` returns `songs`, every later one an empty list, so the queue is
 * exactly the started song followed by `songs`. A real queue is refilled before it can end (US-013-AC-03).
 */
export async function endQueueAfter(page: Page, songs: NextBatchSong[]): Promise<void> {
  annotate(`GET /api/song/next-batch returns ${songs.length} real catalog song(s) once, then an empty list.`);
  let calls = 0;
  await page.route(`${apiUrl(songRoutes.nextBatch)}*`, (route) =>
    route.fulfill({ json: calls++ === 0 ? songs : [] }),
  );
}

/**
 * Answers every `GET /api/song/search` with `response`, so suggestions and results do not depend on the shared
 * Elasticsearch index (`automation-analysis.md` §3.5). The fixture must keep the real shape (`src/data/search.ts`).
 */
export async function answerSearchWith(page: Page, response: SearchResponse, label: string): Promise<void> {
  annotate(`GET ${searchRoutes.search} is answered in the browser with ${label}.`);
  await page.route(`${apiUrl(searchRoutes.search)}*`, (route) => route.fulfill({ json: response }));
}

/**
 * Answers the review submit of `songId` with the real success body (`RatingController.AddReview`) without saving it
 * (reviews are permanent, TR-01). `sent` resolves with the body the modal posted.
 */
export async function answerReviewSubmit(page: Page, songId: number): Promise<{ sent: Promise<ReviewSubmission> }> {
  annotate(`POST ${songRoutes.addReview(songId)} is answered in the browser with 200 "${serverMessage.reviewSuccess}": nothing is saved.`);
  let resolveBody: (body: ReviewSubmission) => void;
  const sent = new Promise<ReviewSubmission>((resolve) => (resolveBody = resolve));
  await page.route(apiUrl(songRoutes.addReview(songId)), async (route) => {
    resolveBody(route.request().postDataJSON() as ReviewSubmission);
    await route.fulfill({ json: { message: serverMessage.reviewSuccess } });
  });
  return { sent };
}

/**
 * Serves the real `/player` response of `songId` with `isReviewed: true`, as for a user who already reviewed it,
 * without writing a permanent review (TR-01).
 */
export async function reportSongAsReviewed(page: Page, songId: number): Promise<void> {
  annotate(`GET ${songRoutes.player(songId)} is the real response with isReviewed set to true.`);
  await page.route(apiUrl(songRoutes.player(songId)), async (route) => {
    const response = await route.fetch();
    const player = (await response.json()) as SongPlayer;
    await route.fulfill({ response, json: { ...player, isReviewed: true } });
  });
}
