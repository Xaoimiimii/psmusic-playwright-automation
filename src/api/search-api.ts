import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../config/env';

/** Search, served from Elasticsearch (`SongController.Search` → `SongService.SearchAll`). */
export const searchRoutes = {
  search: '/api/song/search',
} as const;

/** One search item (`docs/exploration/browser/search.md` §2). Artists have `mp3Url: null` and no `artists`. */
export interface SearchItem {
  type: 'song' | 'artist';
  id: number;
  name: string;
  avatarUrl: string;
  mp3Url: string | null;
  duration: string;
  artists: { id: number; name: string }[];
}

/**
 * Search response. `topResult` is an exact, case-insensitive name match (or null) and is removed from `results`;
 * `results` lists artists first, then songs. `total` counts the items of this response, not the hits.
 */
export interface SearchResponse {
  topResult: SearchItem | null;
  results: SearchItem[];
  total: number;
  totalPages: number;
}

export class SearchApi {
  constructor(private readonly request: APIRequestContext) {}

  search(keyword: string, options: { page?: number; size?: number } = {}): Promise<APIResponse> {
    const url = new URL(searchRoutes.search, env.apiBaseUrl);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('page', String(options.page ?? 1));
    url.searchParams.set('size', String(options.size ?? 10));
    return this.request.get(url.href, { headers: { 'X-App-Service-Key': env.serviceKey } });
  }

  async searchOrThrow(keyword: string, options: { page?: number; size?: number } = {}): Promise<SearchResponse> {
    const response = await this.search(keyword, options);
    if (!response.ok()) throw new Error(`Test setup: search "${keyword}" failed with ${response.status()} ${await response.text()}`);
    return (await response.json()) as SearchResponse;
  }
}
