# Status page app

Last verified: `d403c56`. Static, client-rendered site (Vite + vanilla TypeScript). No backend, no runtime dependencies. **verified** — `package.json` has only `devDependencies`.

## Nodes and relationships

- **`src/data/`** — JSON fixtures (`services.json`, `incidents.json`) plus `index.ts`, which exports typed arrays and `NOW`. *Produces* all data the page shows. There is no live data feed or API; changing what the page shows means editing fixtures. **verified** (`src/data/index.ts`).
- **`src/lib/`** — pure logic (time, status, incidents, formatting) with a `*.test.ts` per module. *Consumes* `src/data` types only; *validated by* vitest. **verified**
- **`src/main.ts`** — DOM rendering. *Uses* `src/lib` and `src/data`; *styled by* `src/style.css`. **verified**
- **`src/lib/fixtures.test.ts`** — *validates* the fixtures (see rules). **verified**

## Business rules (from code and tests)

- `NOW` in `src/data/index.ts` is a fixed instant, not the wall clock, so the live page shows a frozen "current" state regardless of the date. Whether this is intended beyond the demo is **NEEDS HUMAN CONFIRMATION**. Source: `NOW`; README states it is deliberate for determinism.
- The history window is 90 UTC days ending on the day of `NOW` (`HISTORY_DAYS`, `historyStart` in `src/lib/incidents.ts`). **verified**
- Incident state is derived from timestamps vs `now`: `upcoming` (starts later), `active` (no `resolvedAt` or ends later), else `resolved` (`incidentState`). **verified**
- Overall status = worst severity across services; severity order operational < degraded < partial-outage < major-outage (`src/lib/status.ts`). **verified**
- Fixture invariants enforced by `fixtures.test.ts`: unique ids; incident services exist; past incidents within the window; a service is non-operational exactly when an active incident affects it. **verified** (per AGENTS.md; test file is the enforcement point).
- All day boundaries are UTC (`src/lib/time.ts`). **verified**
