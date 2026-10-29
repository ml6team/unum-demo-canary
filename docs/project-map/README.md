# Project map — Northwind status page

Repository: `ml6team/unum-demo-canary`  
Default branch: `main`  
Coverage basis: from-scratch pass (no prior map).  
Last-verified revision: `d403c56` (2026-10-01)  

---

## Index

1. [System overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Source modules](#3-source-modules)
4. [Data layer](#4-data-layer)
5. [Build and toolchain](#5-build-and-toolchain)
6. [CI/CD and deployment](#6-cicd-and-deployment)
7. [Dependencies](#7-dependencies)
8. [Business rules and constraints](#8-business-rules-and-constraints)
9. [Emergency stop and rollback — GitHub Pages](#9-emergency-stop-and-rollback--github-pages)

---

## 1. System overview

**Verified.** Source: `README.md`, `package.json`, `vite.config.ts` @ `d403c56`.

Northwind status is a public, fully static status page for Northwind's services. It is a single-page Vite + vanilla TypeScript application with no server component. The page runs entirely client-side; there is no API, no backend, and no database. All data is baked in at build time from JSON fixtures.

The live site is served from GitHub Pages at `https://ml6team.github.io/unum-demo-canary/`.

---

## 2. Architecture

**Verified.** Source: `src/` tree, `vite.config.ts`, `package.json` @ `d403c56`.

Two layers:

| Layer | Path | Role |
|---|---|---|
| Logic | `src/lib/` | Pure functions, no DOM access. Each module has a co-located `*.test.ts`. |
| Rendering | `src/main.ts` | DOM writes only. Calls into `src/lib/`; performs no computation itself. |

The build base path is `/unum-demo-canary/` (`vite.config.ts`, `base` field).

The fixed current time `NOW` (exported from `src/data/index.ts`) makes the page and all tests deterministic regardless of when they run.

---

## 3. Source modules

**Verified.** Source: `src/lib/` directory listing, file contents @ `d403c56`.

### `src/lib/types.ts`
Core TypeScript types: `Service`, `ServiceStatus`, `Impact`, `IncidentKind`, `IncidentUpdateStatus`, `IncidentUpdate`, `Incident`. All other modules import from here; changes here propagate everywhere.

### `src/lib/time.ts`
UTC day helpers: `utcDayKey`, `startOfUtcDay`, `addUtcDays`, `durationMs`, `DAY_MS`. All date arithmetic in the app must go through these functions — never through local-time `Date` methods.

### `src/lib/status.ts`
Status aggregation: `worstStatus`, `overallStatus`, `STATUS_LABEL`, `UPDATE_LABEL`, `compareSeverity`. `overallStatus` drives the page header; `worstStatus` selects the most severe `ServiceStatus` from an iterable.

### `src/lib/incidents.ts`
Incident querying: `incidentState`, `pastIncidents`, `upcomingMaintenance`, `activeIncidents`, `groupByDay`, `updatesNewestFirst`, `affectedServiceNames`. History window is 90 days (`HISTORY_DAYS = 90`).

### `src/lib/format.ts`
Display formatting for day, time, range, and duration. Always UTC. Used only by `src/main.ts`.

### `src/lib/fixtures.test.ts`
Consistency guard for the JSON fixtures (not a unit test of a production function). Enforces: ids unique, service references valid, past incidents within 90-day window, service status non-operational iff an active incident affects it.

### `src/main.ts`
DOM entry point. Imports from `src/lib/` and `src/data/`. Renders the page; no computation.

### `src/style.css`
All styles. Colours are CSS custom properties; dark mode via a `@media (prefers-color-scheme: dark)` override. Status colours come from `tone-*` classes; status must always be conveyed by text _and_ colour.

---

## 4. Data layer

**Verified.** Source: `src/data/index.ts`, `src/data/services.json`, `src/data/incidents.json` @ `d403c56`.

| File | Content |
|---|---|
| `src/data/services.json` | Six services with id, name, description, and current `ServiceStatus`. |
| `src/data/incidents.json` | Incidents and maintenance windows over ~90 days, plus upcoming maintenance. |
| `src/data/index.ts` | Typed exports of both JSON files; defines `NOW = new Date('2026-10-01T12:00:00Z')`. |

Rule: `NOW` is the single source of current time for both the page and tests. Never call `new Date()` or `Date.now()` for current time.

`fixtures.test.ts` validates consistency between `services.json` and `incidents.json` on every test run.

---

## 5. Build and toolchain

**Verified.** Source: `package.json`, `biome.json`, `tsconfig.json`, `.npmrc` @ `d403c56`.

| Tool | Version | Role |
|---|---|---|
| Node | ≥22 (CI uses 24) | Runtime requirement |
| Vite | ^8.3.2 | Dev server and bundler |
| TypeScript | ^7.0.2 | Type-checking (`tsc --noEmit`) |
| Vitest | ^5.0.3 | Test runner |
| Biome | 2.5.15 | Formatter and linter |

Npm cache is redirected to `/tmp/.npm-cache` (`.npmrc`) so it works in sandboxes without a writable `HOME`.

Scripts:

| Script | Command |
|---|---|
| `dev` | `vite` |
| `build` | `tsc --noEmit && vite build` → `dist/` |
| `test` | `vitest run` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `biome check .` |
| `format` | `biome check --write .` |

Biome config: 2-space indent, 100-char line width, single quotes, recommended rule preset, import organizer on.

---

## 6. CI/CD and deployment

**Verified.** Source: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/CODEOWNERS` @ `d403c56`.

### CI (`.github/workflows/ci.yml`)

Triggers: all pull requests, pushes to `main`.  
Steps in order: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.  
All five steps are required. The workflow is the `ci` check that PRs must pass.

### Deployment (`.github/workflows/deploy.yml`)

Triggers: push to `main`, manual `workflow_dispatch`.  
Steps: `npm ci` → `npm run build` → upload `dist/` as Pages artifact → deploy to GitHub Pages.  
Deploy job runs in the `github-pages` GitHub environment.  
Concurrency group `pages` prevents overlapping deploys; in-progress deploys are **not** cancelled.

Promotion path: merge to `main` → CI passes → deploy workflow runs automatically → live at `https://ml6team.github.io/unum-demo-canary/`.

### Code ownership

`.github/CODEOWNERS`: all files (`*`) require a review from `@GeorgesLorre` before a PR can be merged.

---

## 7. Dependencies

**Verified.** Source: `package.json` @ `d403c56`.

All dependencies are dev-only (build and toolchain). There are **no runtime dependencies**. The shipped bundle is vanilla JS compiled from TypeScript.

No self-managed or privately published packages. No external service integrations at runtime.

---

## 8. Business rules and constraints

**Verified** (from code and `AGENTS.md`). Source: `src/lib/`, `AGENTS.md` @ `d403c56`.

- Logic lives in `src/lib/`. `main.ts` renders only.
- Every behaviour change starts with a failing test.
- `NOW` is the single source of current time; `new Date()` and `Date.now()` are banned for current time.
- All day boundaries are UTC; use `time.ts` helpers.
- Status is conveyed by text **and** colour. Every colour comes from a `tone-*` CSS class.
- No new runtime dependencies; dev dependencies only when unavoidable.
- New UI must work in light and dark mode, at ≥375 px width, and be keyboard-accessible (semantic headings, native `<details>` or real buttons, visible focus).
- `fixtures.test.ts` consistency rules: unique ids, valid service references, past incidents in window, service non-operational iff active incident targets it.
- Branch naming: `factory/<linear-id>-<slug>` (lowercase, hyphens). Example: `factory/unusfd-12-uptime-bars`.
- PR title: `<type>: <summary> (<LINEAR-ID>)`. PR body: link the Linear ticket and approved design; summarise how the change matches the design; list deviations with reasons.

---

## 9. Emergency stop and rollback — GitHub Pages

**Verified** (deployment mechanism). Source: `.github/workflows/deploy.yml`, GitHub Pages environment @ `d403c56`.  
Authority: **NEEDS HUMAN CONFIRMATION** — no authority is named in the deployment config or CODEOWNERS beyond the code-review requirement. The documented repository owner is `@GeorgesLorre`; treated as provisional authority pending confirmation.

### Environment

| Attribute | Value |
|---|---|
| Role | Public production (sole environment) |
| URL | `https://ml6team.github.io/unum-demo-canary/` |
| Serving mechanism | GitHub Pages, fed by the `github-pages` Actions environment |
| Live revision | The `dist/` artifact from the last successful `deploy.yml` run on `main` |

### Emergency stop

GitHub Pages for a repository can be disabled from the repository settings (Settings → Pages → turn off Pages). This stops serving the site immediately.  
**Observable result**: the URL returns 404.  
**Who may do this**: repository admin(s) — **NEEDS HUMAN CONFIRMATION** of who holds admin access.

Alternatively, a single-commit revert to `main` triggers a new deploy within minutes (see rollback below), which replaces the live content without taking the site offline.

### Rollback

Deployed revisions are recorded as GitHub Actions workflow runs for `deploy.yml` and as GitHub Pages deployment history (Settings → Pages → Deployments, or Actions tab filtered to `deploy` workflow).

To restore a previous working revision:

1. Identify the last healthy `main` commit before the current one — check the `deploy.yml` run history in the Actions tab.
2. Create a revert commit on `main` (or fast-forward `main` to that commit via a PR if the team's process requires review):
   ```
   git revert <bad-commit-sha>   # creates a revert commit
   git push origin main
   ```
3. The `deploy.yml` workflow triggers automatically on push to `main` and redeploys `dist/`.
4. **Observable result**: `https://ml6team.github.io/unum-demo-canary/` serves the reverted content; the Actions deploy run completes successfully.

**Health evidence**: The `deploy.yml` run history on the Actions tab is the authoritative record of what was deployed and when. The previous working revision is the commit before the current HEAD on `main` (inferred — no explicit health check or smoke test is defined in the workflow; marked inferred).

**Data/config restore**: not applicable — all content is baked into the static build from the repository. Rolling back the code rolls back all data.
