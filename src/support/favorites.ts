import { test } from '@playwright/test';
import type { AuthApi } from '../api/auth-api';
import type { SongApi } from '../api/song-api';
import type { Credentials } from '../data/users';

/**
 * Clean-up: removes `user`'s favorite on each song that still has one, through the API, so the shared like
 * counters are back where the test found them. Logs in again, because the browser may have logged out.
 */
export async function removeFavorites(authApi: AuthApi, songApi: SongApi, user: Credentials, songIds: number[]): Promise<void> {
  if (songIds.length === 0) return;
  await test.step(`Clean-up: remove the favorites set on song(s) ${songIds.join(', ')}`, async () => {
    const { token } = await authApi.loginOrThrow(user);
    for (const songId of songIds) {
      if ((await songApi.playerOrThrow(songId, token!)).isFavorited) await songApi.toggleFavoriteOrThrow(songId, token!);
    }
  });
}
