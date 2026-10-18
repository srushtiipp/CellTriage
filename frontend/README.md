# CellTriage — vehicle-user app

Engineering dashboard for a signed-in vehicle user: health, session telemetry, a pack-level digital twin and an AI assistant for **their assigned vehicle**. Built on the mid-sem prototype's layout (React 19, Vite, Tailwind v3, react-three-fiber). The fleet-administrator interface is a separate phase.

## Run it

```bash
npm install          # first time only: adds @supabase/supabase-js (run npm install, not npm ci, so the lockfile updates)
cp .env.example .env # then fill in the values below
npm run dev          # backend must be running on :8000 (dev proxy: /api -> http://localhost:8000)
npm run build
```

| Variable | Meaning |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key. **Never** a service_role key |
| `VITE_API_BASE_URL` | Backend URL for production builds. Leave empty in dev. The backend's CORS must allow the site's origin |

## How it works

- **Sign-in:** Supabase email + password. Then `GET /api/auth/me` decides the role (`vehicle_user`) and the assigned vehicles. The app never reads the `profiles` table and never trusts a role chosen in the UI. Admin accounts, accounts with no vehicle and accounts with no profile each get a clear screen.
- **One API client** (`src/lib/apiClient.js`): Bearer token on every call, one token refresh on 401, then sign-out with a "session expired" message. Typed errors (`network`, `timeout`, `unavailable`, ...).
- **Data:** `/summary`, `/health` and `/metrics` are loaded once per vehicle (`VehicleDataContext`), each with its own loading/error state. Paginated endpoints are read until `total` is reached.
- **Session join:** health and metrics are combined **only** by `(vehicle_id, session_id)` (`src/lib/sessions.js`). Never by array position or timestamp. Records without a `session_id` stay unmatched and are reported.
- **No mock data, anywhere.** Missing values show as an em dash, never as 0. Null timestamps are never replaced with dates; date columns appear only when the API provides them.

## Pages

| Route | Data |
|---|---|
| `/` Command Center | `/summary`, `/health`, `/metrics` |
| `/battery-health` | `/health`, `/summary` |
| `/digital-twin` | `/health`, `/metrics` (session scrubber) |
| `/cell-diagnostics` | `/metrics` (voltage and temperature spread) |
| `/charging` | `/metrics` joined to `/health` |
| `/ai-assistant` | `POST /api/ai/copilot` |
| `/profile` | `/api/auth/me` |

## Scientific wording rules (do not change casually)

- The value is a **session-estimated health index** relative to a fixed **135 Ah** reference capacity.
- Values above 100 are shown as reported and explained, never labelled "Excellent". Risk level comes from the backend (`risk_level`), not from SOH thresholds.
- No remaining-useful-life, no feature importance, no "contributing factors", and no capacity unless the API sends `estimated_capacity_ah`.

## Digital twin: what is and is not real

The API returns pack-level values per session, not individual cells. The 3D blocks are **illustrative geometry** (`src/components/twin/packLayout.js`). Fill height = the session's real SOC; nothing is simulated per cell or module. If the backend later exposes per-cell voltages, that is the place to extend.
