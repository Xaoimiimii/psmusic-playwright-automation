import { sendApiRequest } from '../../src/api/api-request';
import type { SongDetail } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import {
  bearerVariants,
  INVALID_ACCESS_TOKEN,
  optionalUserEndpoint,
  protectedEndpoints,
  serviceKeyEndpoints,
  serviceKeyRejection,
  serviceKeyVariants,
} from '../../src/data/access-control';
import { test, expect } from '../../src/fixtures/test';

test.describe('Technical behaviors: API access control', () => {
  test.describe('TS-AUTHZ-01 requests without a valid service key are refused', () => {
    for (const [index, endpoint] of serviceKeyEndpoints.entries()) {
      // One endpoint is enough for the app gate (automation-analysis.md §11.2).
      const tag = index === 0 ? ['@smoke', '@critical', '@api'] : ['@critical', '@api'];

      test(`${endpoint.method} ${endpoint.name}`, { tag }, async ({ request }) => {
        for (const variant of serviceKeyVariants) {
          await test.step(variant.case, async () => {
            const response = await sendApiRequest(request, endpoint, variant.credentials);
            expect(response.status()).toBe(401);
            expect(await response.json()).toEqual(serviceKeyRejection);
          });
        }
      });
    }
  });

  test.describe('TS-AUTHZ-02 bearer token enforcement', () => {
    for (const endpoint of protectedEndpoints) {
      test(`protected: ${endpoint.method} ${endpoint.name} refuses a missing or invalid token`, {
        tag: ['@critical', '@api'],
      }, async ({ request }) => {
        for (const variant of bearerVariants) {
          await test.step(variant.case, async () => {
            const response = await sendApiRequest(request, endpoint, variant.credentials);
            expect(response.status()).toBe(401);
            expect(await response.text(), 'empty body').toBe('');
          });
        }
      });
    }

    test(`public: ${optionalUserEndpoint.name} with an invalid token is served as a guest`, {
      tag: ['@critical', '@api'],
    }, async ({ request }) => {
      const response = await sendApiRequest(request, optionalUserEndpoint, { accessToken: INVALID_ACCESS_TOKEN });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as SongDetail;
      expect(body, 'the song is served, with the guest flags').toMatchObject({
        id: catalog.songWithMedia,
        isFavorited: false,
        isReviewed: false,
      });
    });
  });
});
