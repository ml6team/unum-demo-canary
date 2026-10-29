# Build and tooling

**Verified** · revision `d403c56` · sources: `package.json`, `tsconfig.json`, `biome.json`, `vite.config.ts`

## Runtime

Node ≥ 22 required (`package.json → engines`). CI uses Node 24.

## Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Dev server at `http://localhost:5173/unum-demo-canary/` |
| `build` | `tsc --noEmit && vite build` | Type-check + bundle to `dist/` |
| `test` | `vitest run` | Unit tests in `src/**/*.test.ts` |
| `typecheck` | `tsc --noEmit` | Type-check only |
| `lint` | `biome check .` | Lint and format check |
| `format` | `biome check --write .` | Auto-fix formatting |
| `preview` | `vite preview` | Serve `dist/` locally |

## Required pre-PR gate (all five must pass)

```sh
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

CI (`.github/workflows/ci.yml`) runs the same five steps.

## Toolchain

| Tool | Version (package.json) | Role |
|---|---|---|
| Vite | ^8.3.2 | Bundler, dev server |
| TypeScript | ^7.0.2 | Type checking |
| Vitest | ^5.0.3 | Test runner |
| Biome | 2.5.15 | Lint and format |

## npm cache

`.npmrc` sets `cache=/tmp/.npm-cache` for sandbox compatibility.
