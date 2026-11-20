# Build, CI, delivery, dependencies

Last verified: `d403c56`.

## Pipelines

- **`ci`** (`.github/workflows/ci.yml`): on every PR and push to `main`: `npm ci`, lint, typecheck, test, build on Node 24. Read-only permissions. **verified**
- **`deploy`** (`.github/workflows/deploy.yml`): on push to `main` and manual `workflow_dispatch`: build, then publish `dist/` to GitHub Pages (environment `github-pages`). **Merging to `main` is a production deploy.** **verified**
- Vite `base` is `/unum-demo-canary/` (`vite.config.ts`); the site lives at `https://ml6team.github.io/unum-demo-canary/`. **verified**: URL returned HTTP 200 on 2026-11-20.
- Whether `ci` is a required status check / branch protection is configured: AGENTS.md says so; **NEEDS HUMAN CONFIRMATION** (branch-protection settings not readable with available tools).
- `.github/CODEOWNERS`: `* @GeorgesLorre` (all PRs request his review). **verified**

## Dependencies

Dev only: Biome, TypeScript, Vite, Vitest (versions in `package.json`, locked in `package-lock.json`). No runtime dependencies, no self-managed or published packages (`"private": true`). `.npmrc` puts the npm cache in `/tmp/.npm-cache`. **verified**

## Environments

One: production on GitHub Pages. No staging, no preview deploys. **verified** (only `deploy.yml` deploys).

## Emergency stop and rollback: GitHub Pages production

- **Environment / live target:** public site `https://ml6team.github.io/unum-demo-canary/`. Identify the served revision by comparing the hashed bundle name in the page's HTML (`assets/index-*.js`) with a local `npm ci && npm run build` of a commit, and the latest successful `deploy` run's `head_sha` (Actions → deploy). On 2026-11-20 the live bundle `index-yrQaTatt.js` matched a local build of `d403c56`. **verified**

### Emergency stop

- **Action:** repo Settings → Pages → *Unpublish site* (or REST `DELETE /repos/ml6team/unum-demo-canary/pages`). This suspends the site, removing user-facing traffic immediately. **inferred** (GitHub Pages feature; not executed).
- **Confirms:** the site URL returns HTTP 404.
- **Who:** repo admins; documented human maintainer is `@GeorgesLorre` (CODEOWNERS). **NEEDS HUMAN CONFIRMATION** that this is the full authority list. Checked: CODEOWNERS, repo README/AGENTS.md; no other maintainer documentation found.
- Note: merging or running `deploy` after unpublishingdoes not restore it; re-enable Pages deliberately (Settings → Pages, source *GitHub Actions*, then run `deploy`).  **inferred**

### Rollback

- **Revision record:** Actions → `deploy` runs (`head_sha`, conclusion) and `git log` on `main`. Each successful run is a full site build of that SHA.
- **Select previous working revision:** the `head_sha` of the last successful `deploy` run before the bad one. No health evidence is recorded anywhere, so the choice is **inferred**; confirm by building it locally.
- **Action (preferred):** open a PR on `main` reverting the bad commit and merge it; `deploy` publishes the result. A human merges. Alternative: re-run the earlier successful `deploy` run from Actions ("Re-run all jobs"), which redeploys that SHA's build. **inferred** — whether the `github-pages` environment allows deploys from re-runs is unconfirmed.
- **Confirms:** live bundle hash matches a local build of the target SHA, and the latest `deploy` run is green.
- **Data/config restore:** none; data is fixtures in the repo.
- **Who:** as above, `@GeorgesLorre` (**NEEDS HUMAN CONFIRMATION**).
- **NEEDS HUMAN CONFIRMATION:** the rollback procedure above was not exercised; no documented runbook exists. Checked: workflows, README, AGENTS.md, run history. Run history shows several runs with other `head_sha`s (e.g. `7d0cbb0`) that are not reachable in the current `main` history, so `main` appears to have been rewritten; "previous revision" must therefore be taken from run `head_sha`s that still exist in git, not assumed from `git log`.
