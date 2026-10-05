# Northwind status

Public status page for Northwind's services. Static site built with Vite and vanilla TypeScript, deployed to GitHub Pages at `/unum-demo-canary/`.

## Layout

```
src/
  lib/            pure logic, no DOM access. Every module has a *.test.ts next to it.
    types.ts      Service, ServiceStatus, Impact, Incident, IncidentUpdate
    time.ts       UTC day helpers: utcDayKey, startOfUtcDay, addUtcDays, durationMs, DAY_MS
    status.ts     worstStatus, overallStatus, STATUS_LABEL, UPDATE_LABEL
    incidents.ts  incidentState, pastIncidents, upcomingMaintenance, activeIncidents, groupByDay
    uptime.ts     serviceUptime: 90 daily statuses and the uptime percentage of a service
    format.ts     day, time, range, duration and uptime formatting (always UTC)
    fixtures.test.ts  consistency checks on the JSON fixtures
  data/           JSON fixtures and their typed exports (index.ts)
    services.json   the six services and their current status
    incidents.json  incidents and maintenance windows over the last 90 days, plus upcoming maintenance
    index.ts        typed exports and NOW, the fixed current time of the page
  main.ts         DOM rendering only
  style.css       all styles; colours are CSS custom properties with a dark-mode override
```

## Rules

- Logic goes in `src/lib/`. `main.ts` calls into it and renders the result; it does not compute anything itself.
- Every behaviour change starts with a failing test in `src/lib/`. Write the test, see it fail, then implement.
- "Now" is always `NOW` from `src/data`. Never call `new Date()` or `Date.now()` for the current time, so the page and tests are deterministic.
- All day boundaries are UTC. Use the helpers in `time.ts` rather than local-time `Date` methods.
- Status is always conveyed by text as well as colour. Every colour comes from a `tone-*` class in `style.css`.
- No new runtime dependencies. Dev dependencies only when unavoidable.
- Formatting and lint are Biome. `npm run format` fixes what it can; `npm run lint` must be clean.
- New UI must work in light and dark mode, at desktop and phone width (375px), and stay keyboard accessible: semantic headings, native `<details>` or real buttons for anything interactive, visible focus.
- Keep fixtures consistent. `src/lib/fixtures.test.ts` enforces that ids are unique, services referenced by incidents exist, past incidents fall inside the 90-day window, and a service is non-operational exactly when an active incident affects it.

## Before opening a PR

```sh
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

All five must pass. CI runs the same steps as the required `ci` check.

## Git and PRs

- Branch: `factory/<linear-id>-<slug>`, all lowercase, hyphens. Example: `factory/unusfd-12-uptime-bars`.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`).
- PR title: `<type>: <summary> (<LINEAR-ID>)`. Example: `feat: 90-day uptime per service (UNUSFD-12)`.
- PR body: link the Linear ticket and the approved design, then summarise how the change matches the design, and list any deviation from it with the reason.
