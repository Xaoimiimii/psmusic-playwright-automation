import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../config/env';

/**
 * Route paths of the song endpoints used by the song page
 * (`SongController.cs` `[Route("api/song")]`, `ArtistController.cs` `[Route("api/artist")]`,
 * `RatingController.cs` `[Route("api/rating")]`).
 */
export const songRoutes = {
  detail: (songId: number) => `/api/song/${songId}/detail`,
  related: (songId: number) => `/api/song/${songId}/related`,
  player: (songId: number) => `/api/song/${songId}/player`,
  favoriteToggle: (songId: number) => `/api/song/${songId}/favorite-toggle`,
  addReview: (songId: number) => `/api/rating/${songId}/add-review`,
  /** Takes a SONG id, not an artist id (`ArtistController.GetArtistsBySong`). */
  artistsOfSong: (songId: number) => `/api/artist/${songId}/artists`,
} as const;

/** `SongDetail2DTO`. `artist` is every artist name joined with ", ". */
export interface SongDetail {
  id: number;
  title: string;
  artist: string;
  imageUrl: string;
  favorite: number;
  reviews: number;
  isFavorited: boolean;
  isReviewed: boolean;
  lyricUrl: string;
  audioUrl: string;
  duration: string;
}

/** `ArtistDTO` returned by `artistsOfSong`. */
export interface SongArtist {
  id: number;
  name: string;
  avatarUrl: string;
}

/** `RelatedSongDTO`: another song sharing at least one artist (at most 30, unordered). */
export interface RelatedSong {
  id: number;
  title: string;
  imageUrl: string;
  mp3Url: string;
  duration: string;
  artist: string;
  artists: { id: number; name: string }[];
}

/** `SongPlayerDTO`. */
export interface SongPlayer {
  id: number;
  title: string;
  likes: number;
  reviews: number;
  isFavorited: boolean;
  isReviewed: boolean;
}

/** Body of a 404 from `detail` and `player`. */
export interface NotFoundBody {
  message: string;
}

/**
 * Client for the song page endpoints. Every call carries the `X-App-Service-Key`
 * header; `accessToken` adds a bearer token for the per-user fields
 * (`isFavorited`, `isReviewed`) and for the member-only toggle.
 */
export class SongApi {
  constructor(private readonly request: APIRequestContext) {}

  detail(songId: number, accessToken?: string): Promise<APIResponse> {
    return this.request.get(this.url(songRoutes.detail(songId)), { headers: this.headers(accessToken) });
  }

  player(songId: number, accessToken?: string): Promise<APIResponse> {
    return this.request.get(this.url(songRoutes.player(songId)), { headers: this.headers(accessToken) });
  }

  toggleFavorite(songId: number, accessToken: string): Promise<APIResponse> {
    return this.request.post(this.url(songRoutes.favoriteToggle(songId)), { headers: this.headers(accessToken) });
  }

  async detailOrThrow(songId: number, accessToken?: string): Promise<SongDetail> {
    return this.jsonOrThrow<SongDetail>(await this.detail(songId, accessToken), `detail of song ${songId}`);
  }

  async playerOrThrow(songId: number, accessToken?: string): Promise<SongPlayer> {
    return this.jsonOrThrow<SongPlayer>(await this.player(songId, accessToken), `player data of song ${songId}`);
  }

  async relatedOrThrow(songId: number): Promise<RelatedSong[]> {
    const response = await this.request.get(this.url(songRoutes.related(songId)), { headers: this.headers() });
    return this.jsonOrThrow<RelatedSong[]>(response, `related songs of song ${songId}`);
  }

  async artistsOfSongOrThrow(songId: number): Promise<SongArtist[]> {
    const response = await this.request.get(this.url(songRoutes.artistsOfSong(songId)), { headers: this.headers() });
    return this.jsonOrThrow<SongArtist[]>(response, `artists of song ${songId}`);
  }

  /** Toggles the favorite and returns the new state; fails loudly on any non-success. */
  async toggleFavoriteOrThrow(songId: number, accessToken: string): Promise<boolean> {
    const response = await this.toggleFavorite(songId, accessToken);
    const body = await this.jsonOrThrow<{ isFavorited: boolean }>(response, `favorite toggle of song ${songId}`);
    return body.isFavorited;
  }

  private async jsonOrThrow<T>(response: APIResponse, what: string): Promise<T> {
    if (!response.ok()) {
      throw new Error(`Test setup: ${what} failed with ${response.status()} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  private url(route: string): string {
    return new URL(route, env.apiBaseUrl).href;
  }

  private headers(accessToken?: string): Record<string, string> {
    const headers: Record<string, string> = { 'X-App-Service-Key': env.serviceKey };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
  }
}
