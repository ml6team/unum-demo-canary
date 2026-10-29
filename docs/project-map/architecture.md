# Architecture

**Status:** verified  
**Last-verified revision:** `d403c56`  
**Source:** `src/`, `index.html`, `vite.config.ts`, `tsconfig.json`

## Purpose

Public status page for Northwind's services. A static single-page application served from GitHub Pages at `https://<org>.github.io/unum-demo-canary/`. Shows current service health, active incidents, upcoming maintenance, and 90-day incident history.

No server, no API calls at runtime — everything is baked into the build from JSON fixtures.

## Module map

```
src/
  data/
    services.json     six service records (id, name, description, status)
    incidents.json    incident and maintenance history + upcoming maintenance
    index.ts          typed re-exports; defines NOW (fixed at 2026-10-01T12:00:00Z)
  lib/                pure logic — no DOM, no side effects
    types.ts          Service, Incident, IncidentUpdate, Impact, ServiceStatus types
    time.ts           UTC day helpers: utcDayKey, startOfUtcDay, addUtcDays, durationMs
    status.ts         worstStatus, overallStatus, STATUS_LABEL, UPDATE_LABEL
    incidents.ts      incidentState, pastIncidents, upcomingMaintenance, activeIncidents, groupByDay
    format.ts         day/time/range/duration formatting (always UTC)
    fixtures.test.ts  data-integrity assertions (id uniqueness, service refs, window bounds)
  main.ts             DOM rendering only; calls lib functions, writes to the DOM
  style.css           all styles; tone-* classes carry semantic colour; dark-mode via CSS vars
index.html            SPA entry point; defines DOM scaffolding main.ts populates
```

## Data flow

```
services.json + incidents.json
      ↓ (typed by data/index.ts)
  src/lib/*    (pure computation)
      ↓
  src/main.ts  (DOM writes)
      ↓
Browser (static HTML/JS/CSS served from GitHub Pages)
```

`NOW` in `src/data/index.ts` is the fixed reference point for all time-relative logic (incident state, history window, upcoming maintenance). The page renders identically regardless of when it is loaded.

## Key relationships

- `main.ts` **uses** `src/lib/*` for all logic; contains no computation itself.
- `src/lib/incidents.ts` **uses** `src/lib/time.ts` for UTC day arithmetic.
- `src/lib/format.ts` **uses** `src/lib/time.ts` for duration calculation.
- `src/lib/status.ts` **produces** the overall banner status from service records.
- `src/data/index.ts` **exports** typed fixtures consumed by both `main.ts` and tests.
- `fixtures.test.ts` **validates** consistency between `services.json` and `incidents.json`.

## Services modelled

Six services: API, Web app, Git operations, Webhooks, Notifications, Search  
Source: `src/data/services.json` — verified at revision `d403c56`.

## Constraints

- No runtime dependencies. All `devDependencies` (Biome, TypeScript, Vite, Vitest).
- All time logic uses UTC helpers in `time.ts`. Local `Date` methods are banned in application code.
- `NOW` from `src/data/index.ts` is the sole source of "current time". `new Date()` / `Date.now()` are not used in application code.
- Status is conveyed by both text and colour (`tone-*` CSS classes).
- UI must work in light and dark mode, at ≥375px width, and be keyboard accessible.
