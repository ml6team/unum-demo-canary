# Flagpole

Internal dashboard for the product's feature flags. It lists every flag with its owner, on/off state and combined error rate over the last 24 hours, and shows request volume and health for the selected flag.

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

reset test
