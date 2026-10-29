# Source modules

**Verified** · revision `d403c56`

All logic lives in `src/lib/`. Each module has a `*.test.ts` sibling.

## `src/lib/types.ts`
Shared TypeScript interfaces and union types. No logic.

## `src/lib/time.ts`
UTC day helpers: `utcDayKey`, `startOfUtcDay`, `addUtcDays`, `durationMs`.
Constants: `MINUTE_MS`, `HOUR_MS`, `DAY_MS`.
Rule: all day-boundary logic uses these helpers, never local-time `Date` methods.

## `src/lib/status.ts`
Severity ranking and label maps for `ServiceStatus`.
Exports: `worstStatus`, `overallStatus`, `STATUS_LABEL`, `UPDATE_LABEL`, `compareSeverity`.
`overallStatus` produces the page-level banner: worst status across all services, its label, and the list of affected services.

## `src/lib/incidents.ts`
Incident lifecycle and grouping.
Exports: `incidentState` (upcoming / active / resolved), `pastIncidents` (90-day window),
`upcomingMaintenance`, `activeIncidents`, `groupByDay`, `updatesNewestFirst`,
`affectedServiceNames`.
Constant: `HISTORY_DAYS = 90`.

## `src/lib/format.ts`
Formatting for display — always UTC.
Exports: `formatDay`, `formatTime`, `formatDateTime`, `formatRange`, `formatDuration`, `formatIncidentDuration`.

## `src/main.ts`
DOM rendering only. Imports data from `src/data` and functions from `src/lib`;
performs no computation.

## `src/data/index.ts`
Typed exports: `NOW` (fixed `2026-10-01T12:00:00Z`), `services`, `incidents`.
Rule: never call `new Date()` or `Date.now()` for current time anywhere in the codebase.
