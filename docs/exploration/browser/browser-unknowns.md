# PSMusic - Browser Exploration Unknowns

Questions that browser exploration on 2026-09-30 could not answer. They are targets for **Repository Exploration** (source), **Documentation Review**, or the SUT team. Each item notes why the browser was insufficient.

## U-1 Backend / data
| # | Question | Why unknown from the browser | Suggested source |
|---|---|---|---|
| U-1.1 | Why does `/api/song/search` return 0 results for every query? (Empty `songs` index, wrong index name, ES unreachable with the error swallowed, or a query bug?) | Response is 200 with an empty body; no error surfaced | **Answered 2026-10-08:** outdated Elasticsearch API key (stakeholder); key renewed. The SUT now also seeds both indices at startup (`ElasticSeeder` (SUT commit `d1a3c44`, 2026-10-08)). Real results confirmed through the API on 2026-10-08 (`search.md`) |
| U-1.2 | Is the remote Neon database shared with other environments (Netlify dev/prod)? Who else is affected by test writes? | Not visible in traffic | SUT team / config owner |
| U-1.3 | How catalog data (songs, artists, categories) is created and refreshed | No admin UI observed | Repository / team |
| U-1.4 | Does un-favoriting delete the Favorite row or keep `IsFavorite=false`? | Only API state visible | Repository (`FavoriteRepository`) / DB |
| U-1.5 | Server-side enforcement of one review per user per song | UI hides the form; API not probed for a 2nd review | Repository / API test |
| U-1.6 | Rating value bounds (0, 6, negative) | Only rating=3 submitted | Repository / API test |
| U-1.7 | Stream de-duplication and time window rules (replay, seek, repeat) | Single observation only | Repository |
| U-1.8 | Exact popularity window and ordering for charts/trending, and why Charts order is 10, 26, 2, 1 | Ordering visible, rule not | Repository (`genre ordering`, `category/popular`) |
| U-1.9 | Server output caching on popular endpoints | Headers did not expose cache info | Repository (`OutputCache`) |

## U-2 Authentication and security
| # | Question | Why unknown |
|---|---|---|
| U-2.1 | Message for a wrong password on an existing account (enumeration comparison) | Not tested |
| U-2.2 | Rate limiting / lockout on login | Deliberately not probed |
| U-2.3 | Access-token lifetime and silent refresh after expiry (401 -> refresh -> retry) | Would require a 60 min wait or a config change |
| U-2.4 | Do old refresh tokens stay valid after rotation? Is the access token still valid after logout? | Would require handling token values |
| U-2.5 | Refresh-cookie behavior over plain HTTP or a non-localhost host (Secure + SameSite=None) | Only HTTPS localhost used |
| U-2.6 | Whether the `x-app-service-key` differs per environment and how it is provisioned for CI | Only one environment |
| U-2.7 | `GET /api/user/{id}` ownership check | Not called by the SPA; not probed |

## U-3 Frontend behavior not exercised
| # | Question |
|---|---|
| U-3.1 | Guest playback past 20 s: is a stream call attempted? |
| U-3.2 | Guest click on the player heart / rate button (expected auth modal per source) |
| U-3.3 | Download (song and playlist): mechanism and file naming |
| U-3.4 | Drag-and-drop reorder on Favorites: persisted or local only? (No API call observed because it wasn't exercised) |
| U-3.5 | Shuffle, repeat, volume, seek, lyrics sync, "Show More" / "View More" |
| U-3.6 | Header back/forward arrows |
| U-3.7 | Search suggestion dropdown UI (never rendered because results were empty) and the Songs/Artists tabs with data |
| U-3.8 | Mobile / responsive layout |
| U-3.9 | `ja`, `ru`, `de` translations completeness |
| U-3.10 | Behavior of a production build (duplicate calls, duplicate player controls) vs. the Vite dev server |
| U-3.11 | Logout from a public page: does it land on `/` or `/auth`? |
| U-3.12 | What `/recent` is meant to show (currently only a title) |

## U-4 Third-party services
| # | Question |
|---|---|
| U-4.1 | What data the recsys tracker sends (events, username) and whether "Decline" is meant to stop it. Partly answered: `/recommendation` sends `UserId` (username, even after logout) and `/evaluation` sends the clicked `Rank`; other event payloads still unknown (`recommendations.md`) |
| U-4.5 | Whether "Recommends for you" should be contextual to the viewed song (currently the same list on every song page) and what drives the ordering |
| U-4.2 | Whether the recsys popup / banner can be disabled for test environments |
| U-4.3 | Abstract API quota/limits and whether a test key or mock is available for sign-up tests |
| U-4.4 | S3 media availability and CORS stability for lyrics |

## U-5 Documentation alignment to check
- Repository docs expect logout to navigate to `/`; runtime landed on `/auth` (from `/favorites`). Reconcile with U-3.11.
- Repository docs describe the Gmail-only rule. Runtime showed only the "mailbox does not exist" branch; the API accepts non-Gmail.
- Requirements in `docs/requirements/user-stories.md` were not cross-checked against these observations in this task. The cross-check is now in `../exploration-validation.md` (2026-09-30).
- U-3.11 source check (2026-09-30): `AuthContext.logout()` calls `navigate("/")`, so landing on `/auth` from `/favorites` stays a repository/runtime conflict (cause INFERRED: the `/favorites` route guard fires on `user = null` before or after that navigation). Logout from a public page is still NOT TESTED.
