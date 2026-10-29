# Dependencies

**Status:** verified  
**Last-verified revision:** `d403c56`  
**Source:** `package.json`, `.npmrc`, `biome.json`

## Runtime dependencies

None. The build output is plain HTML, CSS, and JS — no runtime packages are loaded by the browser.

## Dev dependencies

All are direct dev dependencies; no transitive packages are pinned beyond the `package-lock.json`.

| Package | Version | Role |
|---|---|---|
| `@biomejs/biome` | `2.5.15` (exact) | Lint and format (`npm run lint`, `npm run format`) |
| `typescript` | `^7.0.2` | Type checking and compile-time strictness |
| `vite` | `^8.3.2` | Dev server and production bundler |
| `vitest` | `^5.0.3` | Unit test runner |

## Node requirement

`>=22` (declared in `package.json` `engines`). CI uses Node 24 (`actions/setup-node@v7` in both workflows).

## npm configuration

`cache=/tmp/.npm-cache` (`.npmrc`) — npm cache is redirected to `/tmp` so installs work in sandboxes without a writable `HOME`.

## Package management

`npm` with lockfile (`package-lock.json`). Always install with `npm ci` (not `npm install`) to reproduce the locked tree. No workspace-level or monorepo configuration; this is a single-package repository.

## Self-managed packages

None. No packages are published from this repository.
