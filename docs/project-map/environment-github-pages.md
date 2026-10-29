# Environment: GitHub Pages

**Verified** · revision `d403c56` · source: `.github/workflows/deploy.yml`

**Role:** production — the only environment; serves the public status page.
**Live URL:** `https://ml6team.github.io/unum-demo-canary/`
**Deployment target:** GitHub Pages, repository `ml6team/unum-demo-canary`, environment name `github-pages`.
**Deployed revision:** the `dist/` artifact produced from the latest `main` commit that passed CI and deploy.

To identify the currently-serving revision: check the most recent successful
`deploy` workflow run in the Actions tab of the repository.

---

## Emergency stop and rollback — GitHub Pages

**Authority:** @GeorgesLorre (`.github/CODEOWNERS`). NEEDS HUMAN CONFIRMATION: whether other team members may also invoke these actions.

### Emergency stop

The fastest way to stop serving content is to disable GitHub Pages for the repository:

1. Go to **Settings → Pages** in the `ml6team/unum-demo-canary` repository.
2. Set **Source** to **None** (or disable Pages entirely).
3. Save. The site stops responding within seconds to a few minutes.
4. **Observable result:** `https://ml6team.github.io/unum-demo-canary/` returns 404.

Alternatively, cancel any in-flight deploy workflow run to prevent a bad deployment from landing, but this does not stop an already-deployed site.

NOTE: The repository does not expose a CLI or API command for this in its source; the action is taken through the GitHub web UI or the GitHub REST API (`PUT /repos/{owner}/{repo}/pages` with `source.branch` removed or Pages disabled).

### Rollback

**Where deployed revisions are recorded:** the `deploy` workflow run history in the Actions tab (`https://github.com/ml6team/unum-demo-canary/actions/workflows/deploy.yml`).

**Select the previous working revision:** identify the last successful `deploy` run before the current one. The commit SHA it built from is visible in that run's logs.

**Action to restore it:**

Option A — Re-run a prior workflow run (fastest, no code change):
1. Open the previous successful `deploy` run in the Actions tab.
2. Click **Re-run all jobs**.
3. This redeploys the artifact that run produced.
4. **Observable result:** `https://ml6team.github.io/unum-demo-canary/` serves the content from the selected prior run.

Option B — Revert the commit on `main`:
1. `git revert <bad-commit-sha>` on a branch, push, merge to `main`.
2. The deploy workflow triggers automatically.
3. **Observable result:** same as above, plus the revert is recorded in the commit history.

**NEEDS HUMAN CONFIRMATION:** whether the GitHub Actions "Re-run" approach is authorized for production rollback, or whether only a code revert is acceptable. Sources checked: `deploy.yml`, repository settings (not accessible via the integration).

No data or configuration restore is required — the site is fully static with no database or external state.
