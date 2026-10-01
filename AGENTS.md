# Flagpole

Feature flag dashboard. Static site built with Vite and vanilla TypeScript, deployed to GitHub Pages at `/unum-demo-canary/`.

## Layout

```
src/
  lib/          pure logic, no DOM access. Every module has a *.test.ts next to it.
    types.ts    Flag, User, Counts, FlagMetrics, MetricsSnapshot
    flags.ts    isEnabled(flag, userId), exposedUsers, setEnabled
    metrics.ts  errorRate, combined, health, compareGroups, DEGRADED_THRESHOLD
    format.ts   number, percentage, percentage-point and date formatting
  data/         JSON fixtures and their typed exports (index.ts)
    flags.json    flag definitions
    users.json    100 users, user-000 to user-099, with a plan tier
    metrics.json  per-flag request and error counts, split into canary and baseline groups
  main.ts       DOM rendering and event handling only
  style.css     all styles; colours are CSS custom properties with a dark-mode override
```

## Rules

- Logic goes in `src/lib/`. `main.ts` calls into it and renders the result; it does not compute anything itself.
- Every behaviour change starts with a failing test in `src/lib/`. Write the test, see it fail, then implement.
- All flag evaluation goes through `isEnabled(flag, userId)`. The UI must not read `flag.enabled` to decide who sees a feature.
- No new runtime dependencies. Dev dependencies only when unavoidable.
- Formatting and lint are Biome. `npm run format` fixes what it can; `npm run lint` must be clean.
- New UI must work in light and dark mode, at desktop and phone width (375px), and stay keyboard accessible: real buttons, `role="switch"` with `aria-checked` for toggles, visible focus.
- Keep fixtures consistent: every flag in `flags.json` has an entry in `metrics.json`. `src/lib/fixtures.test.ts` enforces this.

## Before opening a PR

```sh
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

All five must pass. CI runs the same steps as the required `ci` check.

## Git and PRs

- Branch: `factory/<linear-id>-<slug>`, all lowercase, hyphens. Example: `factory/unusfd-12-canary-rollout`.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`).
- PR title: `<type>: <summary> (<LINEAR-ID>)`. Example: `feat: percentage rollout per flag (UNUSFD-12)`.
- PR body: link the Linear ticket, then summarise how the change matches the approved design, and list any deviation from it with the reason.
