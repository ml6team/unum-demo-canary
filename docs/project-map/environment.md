# Environment — GitHub Pages

**Status:** verified  
**Last-verified revision:** `d403c56`  
**Sources:** `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `vite.config.ts`

## Environment

| Property | Value |
|---|---|
| Role | Production (only environment) |
| Host | GitHub Pages |
| URL | `https://ml6team.github.io/unum-demo-canary/` |
| Base path | `/unum-demo-canary/` (set in `vite.config.ts`) |
| Trigger | Push to `main`, or manual `workflow_dispatch` on the `deploy` workflow |
| Build | `npm ci && npm run build` — outputs to `dist/` |
| Deploy action | `actions/deploy-pages@v5` |

## Deployment pipeline

`ci.yml` — runs on every PR and every push to `main`: `npm ci → lint → typecheck → test → build`.  
`deploy.yml` — runs on push to `main` (after `ci.yml`) and via `workflow_dispatch`: build → upload pages artifact → deploy.

The two workflows are independent; `deploy.yml` does not declare an explicit dependency on `ci.yml` passing, but GitHub branch protection (requiring the `ci` check) guards `main`. The `pages` concurrency group in `deploy.yml` ensures deploys are not cancelled mid-flight.

## Emergency stop and rollback

**Who may act:** @GeorgesLorre (CODEOWNERS, `.github/CODEOWNERS`). Authority for additional maintainers NEEDS HUMAN CONFIRMATION — only CODEOWNERS is documented.

### Emergency stop

GitHub Pages does not expose a one-click "disable" in the UI without going through Settings. The fastest action that stops user-facing traffic is:

1. In the repository **Settings → Pages**, set **Source** to **None** (disables Pages entirely).  
   **Observable result:** `https://ml6team.github.io/unum-demo-canary/` returns 404.

Alternative (slower, preserves Pages config): cancel or disable the `deploy` workflow under **Actions → deploy → ···** to prevent new deployments, but this does not remove the already-live page.

### Rollback

Deployed revisions are recorded in the GitHub Pages deployment history:  
**Actions → deploy → (select an earlier successful run) → Re-run all jobs**

Steps:
1. Identify the last successful `deploy` workflow run before the current one (GitHub Actions UI: `Actions → deploy`, filter by `main`, oldest recent is at top).  
   The previous working revision is the commit SHA linked on that run. *(Inferred — no external health log exists; NEEDS HUMAN CONFIRMATION if a monitoring record is available.)*
2. Re-run that workflow run via **Re-run all jobs** to rebuild and redeploy from that commit's source.  
   **Observable result:** The Pages URL serves content built from the earlier commit. Verify by checking the page's "Updated" timestamp, which reflects `NOW` in `src/data/index.ts` (fixed; will not change between deploys unless the data was edited).

> **Note:** Because `NOW` and the fixture data are static, a content rollback is only meaningful if the fixture data or page logic was changed in the bad commit. A Pages URL 404 or blank page is the more likely emergency.

### Data or configuration restore

Not applicable. There is no database or mutable runtime state. All content is static fixtures in the repository. A rollback re-deploys the previous build from source.
