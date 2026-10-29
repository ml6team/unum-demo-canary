# Architecture

**Verified** · revision `d403c56`

## Layer separation

```
src/lib/       Pure logic — no DOM access. Fully unit-tested.
src/data/      JSON fixtures + typed exports. Consumed by lib and main.
src/main.ts    DOM rendering only. Calls lib; performs no computation.
src/style.css  All styles. Colours are CSS custom properties with dark-mode override.
index.html     SPA shell.
public/        Static assets (favicon.svg).
dist/          Vite build output (not committed).
```

## Rendering model

`main.ts` imports from `src/data` and `src/lib`, renders the result into the DOM
in a single synchronous pass. There is no state management, no routing, and no
async data loading.

## Constraint: no new runtime dependencies

The project carries zero runtime npm dependencies. Dev dependencies are allowed
only when unavoidable. See `package.json → devDependencies`. Source:
`AGENTS.md` rule, verified against `package.json`.
