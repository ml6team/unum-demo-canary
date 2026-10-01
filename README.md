# Northwind status

Public status page for Northwind. It shows the current status of each service, upcoming scheduled maintenance and the incident history of the last 90 days, with every update for each incident.

Data comes from the JSON fixtures in `src/data/`. The page's current time is fixed at `NOW` in `src/data/index.ts` (Oct 1, 2026, 12:00 UTC), so it reads the same on any date.

## Run

Requires Node 22 or later.

```sh
npm ci
npm run dev        # http://localhost:5173/unum-demo-canary/
npm test
npm run build      # outputs dist/
```

Pushes to `main` deploy to GitHub Pages. See `AGENTS.md` for project conventions.
