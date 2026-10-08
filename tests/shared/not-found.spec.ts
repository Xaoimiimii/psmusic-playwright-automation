import type { APIResponse } from '@playwright/test';
import type { NotFoundBody, SongApi } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import { serverMessage, uiText } from '../../src/data/messages';
import { test, expect } from '../../src/fixtures/test';

/**
 * Unknown ids are reported as not found, in the API and in the UI.
 * One data-driven test per layer (`automation-analysis.md` §6, overlap #1):
 * TS-DISC-07, TS-DISC-12 and TS-NAV-02 are added here as rows when their areas are automated.
 */
interface NotFoundCase {
  scenario: string;
  name: string;
  request: (clients: { songApi: SongApi }) => Promise<APIResponse>;
  serverMessage: string;
  uiPath: string;
  uiMessage: string;
}

const notFoundCases: NotFoundCase[] = [
  {
    scenario: 'TS-SONG-02',
    name: 'unknown song',
    request: ({ songApi }) => songApi.detail(catalog.unknownSongId),
    serverMessage: serverMessage.songNotFound,
    uiPath: `/song/${catalog.unknownSongId}`,
    uiMessage: uiText.songNotFound,
  },
];

test.describe('Not-found states', () => {
  for (const notFound of notFoundCases) {
    test(`${notFound.scenario} ${notFound.name}`, { tag: ['@critical'] }, async ({ page, songApi }) => {
      await test.step('API: 404 with the not-found message', async () => {
        const response = await notFound.request({ songApi });
        expect(response.status()).toBe(404);
        expect(((await response.json()) as NotFoundBody).message).toBe(notFound.serverMessage);
      });

      await test.step('UI: the page reports it', async () => {
        await page.goto(notFound.uiPath);
        await expect(page.getByRole('main').getByText(notFound.uiMessage, { exact: true })).toBeVisible();
      });
    });
  }
});
