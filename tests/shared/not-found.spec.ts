import type { APIRequestContext, APIResponse } from '@playwright/test';
import { sendApiRequest } from '../../src/api/api-request';
import type { NotFoundBody, SongApi } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import { serverMessage, uiText } from '../../src/data/messages';
import type { RecordedBugId } from '../../src/data/test-metadata';
import { test, expect } from '../../src/fixtures/test';
import { knownDefect } from '../../src/support/known-defect';

/**
 * Unknown ids are reported as not found, in the API and in the UI.
 * One data-driven test per layer (`automation-analysis.md` §6, overlap #1):
 * TS-NAV-02 is added here as a row when its area is automated.
 */
interface NotFoundCase {
  scenario: string;
  name: string;
  request: (clients: { songApi: SongApi; request: APIRequestContext }) => Promise<APIResponse>;
  /** Exact body message when the story fixes one; otherwise only the 404 status is required. */
  serverMessage?: string;
  uiPath: string;
  /** Exact text when the story fixes one; otherwise any visible "not found" message (US-007-AC-05, US-009-AC-05). */
  uiMessage: string | RegExp;
  knownDefect?: { bug: RecordedBugId; observed: string };
}

const anyNotFoundMessage = /not found/i;

const notFoundCases: NotFoundCase[] = [
  {
    scenario: 'TS-SONG-02',
    name: 'unknown song',
    request: ({ songApi }) => songApi.detail(catalog.unknownSongId),
    serverMessage: serverMessage.songNotFound,
    uiPath: `/song/${catalog.unknownSongId}`,
    uiMessage: uiText.songNotFound,
  },
  {
    scenario: 'TS-DISC-07',
    name: 'unknown category',
    request: ({ request }) => sendApiRequest(request, { method: 'GET', route: `/api/category/${catalog.unknownCategoryId}` }),
    uiPath: `/category/${catalog.unknownCategoryId}`,
    uiMessage: anyNotFoundMessage,
    knownDefect: { bug: 'BUG-US-007-AC-05', observed: 'GET /api/category/{id} answers 204 and the page stays blank' },
  },
  {
    scenario: 'TS-DISC-12',
    name: 'unknown artist',
    request: ({ request }) => sendApiRequest(request, { method: 'GET', route: `/api/artist/${catalog.unknownArtistId}` }),
    uiPath: `/artist/${catalog.unknownArtistId}`,
    uiMessage: anyNotFoundMessage,
    knownDefect: { bug: 'BUG-US-009-AC-05', observed: 'GET /api/artist/{id} answers 204 and the page shows only a Play button' },
  },
];

test.describe('Not-found states', () => {
  for (const notFound of notFoundCases) {
    test(`${notFound.scenario} ${notFound.name}`, { tag: ['@critical'] }, async ({ page, songApi, request }) => {
      await test.step('API: 404 with the not-found message', async () => {
        const response = await notFound.request({ songApi, request });
        // Both layers break together today, so the defect is marked once, before the first broken assertion.
        if (notFound.knownDefect) knownDefect(notFound.knownDefect.bug, notFound.knownDefect.observed);
        expect(response.status()).toBe(404);
        if (notFound.serverMessage) {
          expect(((await response.json()) as NotFoundBody).message).toBe(notFound.serverMessage);
        }
      });

      await test.step('UI: the page reports it', async () => {
        await page.goto(notFound.uiPath);
        const message =
          typeof notFound.uiMessage === 'string'
            ? page.getByRole('main').getByText(notFound.uiMessage, { exact: true })
            : page.getByRole('main').getByText(notFound.uiMessage);
        await expect(message).toBeVisible();
      });
    });
  }
});
