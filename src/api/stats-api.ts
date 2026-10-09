/** Route paths of the stats endpoints (`StatsController.cs`, `[Route("api/stats")]`). */
export const statsRoutes = {
  /** `[Authorize]`; sent by the SPA right after login and every 45 s while signed in. */
  heartbeat: '/api/stats/heartbeat',
} as const;
