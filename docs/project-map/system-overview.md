# System overview

**Verified** · revision `d403c56`

Northwind Status is a public status page that shows current service health,
upcoming maintenance windows, and 90-day incident history for Northwind's
services.

- **Kind:** static single-page site (no server, no API, no auth)
- **Runtime:** browser only; all data is bundled at build time from JSON fixtures
- **Live URL:** `https://ml6team.github.io/unum-demo-canary/`
  (path derived from `vite.config.ts` → `base: '/unum-demo-canary/'`)
- **Fixed "now":** `2026-10-01T12:00:00Z`, set in `src/data/index.ts → NOW`;
  the page renders identically regardless of when it is visited
- **Maintainer / code owner:** @GeorgesLorre (`.github/CODEOWNERS`)
