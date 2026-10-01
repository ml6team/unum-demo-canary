# Flagpole

Internal dashboard for the product's feature flags. It lists every flag with its owner, on/off state and combined error rate over the last 24 hours, and shows request volume and health for the selected flag. The details panel also compares the canary group's error rate with the baseline group's and gives a verdict (canary worse, canary better, similar, or no data); flags whose canary is worse carry a marker in the table. A difference of 0.5 percentage points or more counts as worse or better.

Data comes from the JSON fixtures in `src/data/`. Toggling a flag changes local state only.

## Run

Requires Node 22 or later.

```sh
npm ci
npm run dev        # http://localhost:5173/unum-demo-canary/
npm test
npm run build      # outputs dist/
```

Pushes to `main` deploy to GitHub Pages. See `AGENTS.md` for project conventions.
