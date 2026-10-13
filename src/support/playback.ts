import { test, type Page } from '@playwright/test';
import { songRoutes, type NextBatchSong, type SongPlayer } from '../api/song-api';
import type { SongPage } from '../pages/song.page';
import { nextApiResponse } from './network';

export interface StartedPlayback {
  /** `/player` response of the started song: what the player bar shows. */
  player: SongPlayer;
  /** Songs queued after it, in queue order (the first `next-batch` response). Random on every start. */
  queue: NextBatchSong[];
}

/**
 * Opens `songId`'s page and presses Play. The player then loads the song (`GET /player`) and fills the queue with
 * a random `next-batch` (`PlayerContext.startNewSession`); both responses are returned so a test can predict
 * which song Next, Previous or the end of a song leads to.
 */
export async function playFromSongPage(page: Page, songPage: SongPage, songId: number): Promise<StartedPlayback> {
  return test.step(`Play song ${songId} from its song page`, async () => {
    await songPage.open(songId);
    const playerResponse = nextApiResponse(page, 'GET', songRoutes.player(songId));
    const batchResponse = nextApiResponse(page, 'GET', songRoutes.nextBatch);
    await songPage.play();
    return {
      player: (await (await playerResponse).json()) as SongPlayer,
      queue: (await (await batchResponse).json()) as NextBatchSong[],
    };
  });
}
