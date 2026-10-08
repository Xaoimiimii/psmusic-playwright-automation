# PSMusic - Search (runtime observations)

| Item | Value |
|---|---|
| Date | 2026-10-08 |
| Target | Local API `https://localhost:7215/api` (shared remote PostgreSQL, cloud Elasticsearch) |
| Method | Direct `GET /api/song/search` calls with `X-App-Service-Key` (curl). No browser pass yet |
| Context | First observation after the Elasticsearch API key renewal (2026-10-08). Until then every search returned `total: 0` (F-1) |
| Source cross-check | `S:Services/Implementations/SongService.cs` `SearchAll`, `S:Services/Implementations/ElasticSeeder.cs` (SUT commit `d1a3c44`) |

Status labels follow the other exploration files: RUNTIME-OBSERVED = seen in responses; SOURCE = read in code only.

## 1. Result

Search works. Both indices contain data: songs and artists are returned for real catalog names. RUNTIME-OBSERVED.

Whether the running server had already executed `ElasticSeeder` was not checked (the indices were populated either way).

## 2. Response shape

`200` with:

```json
{
  "topResult": { "type": "song", "id": 1176, "name": "Em", "avatarUrl": "https://image-cdn.nct.vn/...", "mp3Url": "https://psmusic.s3.ap-southeast-2.amazonaws.com/songs/MP3/...", "duration": "00:03:28", "artists": [{ "id": 27, "name": "Binz" }] },
  "results": [
    { "type": "artist", "id": 506, "name": "EM XINH \"SAY HI\"", "avatarUrl": "https://image-cdn.nct.vn/...", "mp3Url": null, "duration": "00:00:00", "artists": [] },
    { "type": "song", "id": 1458, "name": "Là Em, Chính Em", "avatarUrl": "...", "mp3Url": "...", "duration": "00:03:15", "artists": [{ "id": 13, "name": "Dương Domic" }] }
  ],
  "total": 11,
  "totalPages": 33
}
```

| Field | Observed meaning | Label |
|---|---|---|
| `topResult` | Exact, case-insensitive name match; `null` otherwise. Artist preferred over song (source) | RUNTIME-OBSERVED |
| `results` | Artists first, then songs. The top result is removed from this list | RUNTIME-OBSERVED |
| Artist item | `mp3Url: null`, `duration: "00:00:00"`, `artists: []` | RUNTIME-OBSERVED |
| Song item | `duration` as `"hh:mm:ss"`, `artists` = `[{ id, name }]` | RUNTIME-OBSERVED |
| `total` | Number of items **in this response** (`results.length` + 1 if `topResult`), not the number of hits. "Em", size 10: 10 results + top = 11 | RUNTIME-OBSERVED |
| `totalPages` | `ceil((song hits + artist hits) / size)`. "Em", size 10 → 33; size 20 → 17 | RUNTIME-OBSERVED, matches source |

No match (`keyword=xyzqwvzz`): `200 {"topResult":null,"results":[],"total":0,"totalPages":0}`.

## 3. Paging and size

| Input | Observed | Label |
|---|---|---|
| `size` = 0, 5, 9, 10 | Same response: at most 10 songs (US-010-AC-09 confirmed) | RUNTIME-OBSERVED |
| `size=20` | Up to 20 songs | RUNTIME-OBSERVED |
| `page=0` | Same as `page=1` | RUNTIME-OBSERVED |
| Songs and artists queried separately, each with `size` | `results` can hold up to `size` artists **plus** `size` songs: "Chờ Anh Nhé", size 10 → 19 results + top | RUNTIME-OBSERVED |
| Artists are not paged | The artist query always starts at 0 (`From(0)` in source). `keyword=em`: artist 506 is returned on page 1 **and** page 2 | RUNTIME-OBSERVED + SOURCE |

The repeated artists on later pages are an observation, not yet classified. The All tab shows only 4 artists (US-010-AC-05), so the user impact depends on how the results page merges pages (not checked in the browser).

## 4. Matching

| Query | Observed | Label |
|---|---|---|
| `Binz`, `BINZ`, `binz` | `topResult` = artist 27 "Binz"; Binz songs in `results` | RUNTIME-OBSERVED |
| `Em` / `em` | `topResult` = song 1176 "Em" (Binz) | RUNTIME-OBSERVED |
| `Chờ Anh Nhé` / `chờ anh nhé` | `topResult` = song 1 "Chờ Anh Nhé" | RUNTIME-OBSERVED |
| `Dương Domic` | `topResult` = artist 13 "Dương Domic" | RUNTIME-OBSERVED |
| `Là Em, Chính Em` | `topResult` = song 1458 | RUNTIME-OBSERVED |
| `Cho Anh Nhe` (no diacritics) | Song 1 is the first song in `results`, but **no** `topResult`: the exact-match check compares raw strings | RUNTIME-OBSERVED |
| `Bnz` (typo) | Fuzzy: Binz songs and "BDZ (Korean Ver.)" returned; no `topResult` | RUNTIME-OBSERVED |

Fuzzy and diacritic-insensitive matching returns loosely related items (for example artists named "… Anh" for "Chờ Anh Nhé"). Assert that known items are present, never the full list or its order beyond the top result (US-010-AC-10 still open).

## 5. Known titles for test data

| Keyword | Expected | Use |
|---|---|---|
| `Binz` | Top result artist 27 | Exact artist match, case variants |
| `Chờ Anh Nhé` | Top result song 1 | Exact song match with diacritics; song 1 is already the playback test song |
| `Em` | Top result song 1176; about 330 hits (33 pages at size 10) | Keyword with more than 10 matches (TS-SRCH-07), paging |
| `Dương Domic` | Top result artist 13 | Artist with diacritics |
| `xyzqwvzz` | Empty result | No-result state |

These come from the shared catalog. They stay valid while the songs exist in PostgreSQL when the API starts (the index is refilled only at startup).

## 6. Tooling note

In Git Bash on Windows, `curl --data-urlencode "keyword=Chờ Anh Nhé"` sent a mangled keyword (song 1 was not found). Pre-encoded UTF-8 (`keyword=Ch%E1%BB%9D%20Anh%20Nh%C3%A9`) works. Playwright's `APIRequestContext` encodes UTF-8 itself; the issue only matters for manual probes.

## 7. Still open

- Browser pass: suggestion box states (including "No suitable suggestions", never seen), results page tabs and the Top result card with real data.
- Whether repeated artists on page 2+ are visible in the UI.
