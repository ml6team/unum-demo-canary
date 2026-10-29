# Design decisions

**Status:** verified (rules from AGENTS.md and code); intent NEEDS HUMAN CONFIRMATION where marked  
**Last-verified revision:** `d403c56`  
**Source:** `AGENTS.md`, `src/`, `src/data/index.ts`

## Fixed "current time" (`NOW`)

`NOW` is exported from `src/data/index.ts` as a hard-coded `Date` (`2026-10-01T12:00:00Z`). All time-relative logic (incident state, history window, upcoming maintenance) uses it instead of `Date.now()` or `new Date()`.

**Effect:** The page renders identically on any calendar date. Tests are deterministic without mocking. Updating the page's apparent "current time" requires editing `src/data/index.ts` and redeploying.

## Logic / rendering separation

All computation lives in `src/lib/`. `src/main.ts` calls library functions and writes results to the DOM — it contains no logic of its own. `src/data/` holds typed fixture exports.

**Effect:** Every behaviour is unit-testable without a browser. DOM changes are cheap to audit.

## No runtime dependencies

The project rule prohibits adding runtime dependencies. Dev dependencies are permitted only when unavoidable.

**Effect:** The deployed page is self-contained static files; no CDN or package registry is needed at runtime.

## UTC-only time handling

All day boundaries and time formatting use UTC helpers in `src/lib/time.ts`. Local-time `Date` methods are not used in application code.

## Fixture integrity enforced by tests

`src/lib/fixtures.test.ts` asserts:
- Incident and service IDs are unique.
- Services referenced by incidents exist in `services.json`.
- Past incidents fall within the 90-day history window.
- A service's `status` is non-operational exactly when an active incident affects it.

These constraints must hold before any PR is merged.

## Branch and PR conventions

- Branch: `factory/<linear-id>-<slug>` (lowercase, hyphens).
- PR title: `<type>: <summary> (<LINEAR-ID>)`.
- PR body: link Linear ticket and approved design, summarise how the change matches the design, list any deviation and its reason.
- Required review: @GeorgesLorre (CODEOWNERS).

## CI gate

All of `npm ci && npm run lint && npm run typecheck && npm test && npm run build` must pass before a PR can merge. CI runs the same sequence (`ci.yml`).
