# Delivery pipeline

**Verified** · revision `d403c56` · sources: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/CODEOWNERS`

## CI (`ci.yml`)

Trigger: every pull request and every push to `main`.
Steps: `npm ci → lint → typecheck → test → build` (Node 24, ubuntu-latest, 10 min timeout).
Concurrency: cancels in-progress runs for the same ref.

## Deploy (`deploy.yml`)

Trigger: push to `main`, or manual `workflow_dispatch`.
Steps:
1. `build` job: checkout → Node 24 → `npm ci` → `npm run build` → upload `dist/` as Pages artifact.
2. `deploy` job (needs `build`): deploys artifact to the `github-pages` environment.

Concurrency: `group: pages`, `cancel-in-progress: false` — deploy runs never cancel each other.

## PR and review flow

- Branch naming: `factory/<linear-id>-<slug>` (all lowercase, hyphens).
- Every PR requests review from `@GeorgesLorre` via CODEOWNERS.
- PR title: `<type>: <summary> (<LINEAR-ID>)`.
- Merge triggers deploy automatically.
