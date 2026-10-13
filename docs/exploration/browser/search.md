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

- Results page tabs (All / Songs / Artists), paging, and whether repeated artists on page 2+ are visible in the UI.
- The loading state of the suggestion box (needs a slow controlled response, TS-SRCH-02).

## 8. Browser pass (2026-10-13)

Local dev build `https://localhost:5173`, English UI, tracker blocked. Source: `Header.jsx`, `SearchResultPage.jsx`.

| # | Observation | Evidence |
|---|---|---|
| SE-1 | Suggestions: no request for 1 character; one `GET /api/song/search?keyword=Binz&page=1&size=5` for "Binz" typed fast, 300 ms after the last key (driven with a paused page clock in TS-SRCH-01) | RUNTIME-OBSERVED + SOURCE |
| SE-2 | "Binz": the box lists the top result "Binz" first, then songs ("Hồn Lỡ Sa Vào", "Lift", …). Each suggestion is a `button` in `[class*="suggestBox"]`; it navigates on **mouse down**: artist → `/artist/27`, song → `/song/{id}`. "xyzqwvzz" → "No suitable suggestions" (first time seen) | RUNTIME-OBSERVED |
| SE-3 | After a suggestion click the input blurs, and the header marks it unfocused 150 ms later (`setTimeout`). Focusing it again within those 150 ms is undone: typing then shows no box at all. A user who clicks back at once sees no suggestions until the next focus. Tests wait for the box to close first | RUNTIME-OBSERVED (TS-SRCH-03 run) + SOURCE |
| SE-4 | **Song suggestions show no artist line.** The header reads `artistsName` / `artistName` / `artist`, but search items carry `artists: [{ id, name }]`, so the subtitle is always empty. US-010 does not say whether the artist should be shown; to be confirmed | RUNTIME-OBSERVED + SOURCE |
| SE-5 | The search text stays in the header after a navigation (e.g. "Binz" still in the field on `/artist/27`) | RUNTIME-OBSERVED |
| SE-6 | Enter on `"  Chờ Anh Nhé  "` → `/search?q=Chờ Anh Nhé` (trimmed); Enter on spaces only does nothing | RUNTIME-OBSERVED |
| SE-7 | `/search?q=Chờ Anh Nhé`: heading "Search results", tabs All / Songs / Artists, "Top result" = song 1, then "Songs". `/search?q=xyzqwvzz`: `No results found for "xyzqwvzz".` | RUNTIME-OBSERVED |
| SE-8 | The no-result message is shown when there is no song and no top result (source), so a search that finds only artists would also say "No results found". Not reproduced with real data yet | SOURCE |
| SE-9 | Partial keywords: "Chờ Anh" lists song 1 (no top result); "Bin" lists artist 27 (no top result). Song durations now come as `"00:05:22.5600000"` (fractional seconds), not `"00:05:22"` as on 2026-10-08 | RUNTIME-OBSERVED (API) |
