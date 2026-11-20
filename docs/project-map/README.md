# Project map: Northwind status

Evidence-marked facts about the system. Operating rules for agents live in `/AGENTS.md`.

- Markers: **verified** (checked against code/live system), **inferred**, **NEEDS HUMAN CONFIRMATION**.
- Last verified revision: `d403c56` (`main`). Pass type: from scratch, coverage-led (no prior map).
- Not mapped: the `factory/*` branches/open PRs (unmerged work, not part of `main`); GitHub repo/Pages/branch-protection settings beyond what the API tools could read.

| Node | File |
|---|---|
| Status page app (architecture, data, business rules) | [system.md](system.md) |
| Build, CI, delivery, dependencies | [delivery.md](delivery.md) |
| Emergency stop and rollback (GitHub Pages) | [delivery.md#emergency-stop-and-rollback-github-pages-production](delivery.md#emergency-stop-and-rollback-github-pages-production) |
