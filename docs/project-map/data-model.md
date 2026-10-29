# Data model

**Verified** · revision `d403c56` · source: `src/lib/types.ts`

## Types

| Type | Values |
|---|---|
| `ServiceStatus` | `operational` \| `degraded` \| `partial-outage` \| `major-outage` |
| `Impact` | `degraded` \| `partial-outage` \| `major-outage` |
| `IncidentKind` | `incident` \| `maintenance` |
| `IncidentUpdateStatus` | `investigating` \| `identified` \| `monitoring` \| `resolved` \| `scheduled` \| `in-progress` \| `completed` |

## Interfaces

**`Service`** (`src/data/services.json` — 6 services)
- `id: string`, `name: string`, `description: string`, `status: ServiceStatus`
- A service is non-operational exactly when an active incident affects it (enforced by `fixtures.test.ts`).

**`Incident`** (`src/data/incidents.json`)
- `id`, `kind`, `title`, `impact`, `affectedServiceIds[]`, `startedAt`, `resolvedAt | null`, `updates[]`
- All times are ISO 8601 UTC instants.
- For maintenance: `startedAt`/`resolvedAt` are the planned window until completed, then actual.
- `resolvedAt === null` while an incident is ongoing.

**`IncidentUpdate`**
- `at: string` (ISO 8601 UTC), `status: IncidentUpdateStatus`, `body: string`

## Fixtures

`src/data/index.ts` exports `NOW`, `services`, and `incidents`.
`src/lib/fixtures.test.ts` enforces: unique ids, services referenced by incidents exist,
past incidents fall within the 90-day window, service status matches active incidents.
