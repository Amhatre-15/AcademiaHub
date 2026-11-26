# End-to-End Tests (Playwright)

Phase 17 browser automation for AcademiaHub. These specs drive a real Chromium
instance against a real Express API and PostgreSQL database.

## What is covered

| Spec | Journey |
| :--- | :--- |
| `auth.spec.ts` | Login form, friendly error on bad credentials, unauthenticated redirect, student blocked from `/admin`, faculty cockpit landing. |
| `classroom-cycle.spec.ts` | Faculty starts a class from the timetable → rotating QR checkpoint appears → Student A checks in with the manual fallback → Student B validates an HMAC QR and a 30-second-old replay is rejected → faculty launches a live quiz → student answers (blur triggers the anti-cheat warning) → session closes → attendance finalises as `PRESENT` / `LATE`. |

Camera capture itself is covered by Vitest unit tests; the browser suite
validates the same backend endpoint through the official manual fallback and
through a cryptographically correct dynamic QR payload.

## One-time setup

```bash
# From the repository root
npm install
npm run test:e2e:install          # downloads Chromium (~150 MB)

# Database credentials live in backend/.env
# If the cloud DB is paused, use the local container:
#   docker compose -f docker-compose.local-db.yml up -d
#   then point DATABASE_URL/DIRECT_URL at localhost:5433
```

The suite seeds its own isolated fixture (`E2E` branch, `e2e_faculty`,
`e2e_student_a/b`). It never touches the demo data used by the rest of the app.

## Run

```bash
npm run test:e2e              # boots backend + frontend automatically
npm run test:e2e:ui           # interactive Playwright UI
npm run test:e2e:report       # open the last HTML report
```

Useful environment variables:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend origin |
| `E2E_API_URL` | `http://localhost:5000` | Backend origin |
| `E2E_NO_WEBSERVER` | unset | Reuse servers you started manually |
| `E2E_SKIP_SEED` | unset | Skip fixture re-seeding |
| `CI` | unset | Enables retries and disables server reuse |

## Fixture lifecycle

`e2e/global-setup.ts` runs `npm run e2e:seed --prefix backend`, which is
idempotent and also:

- resets orphaned `ACTIVE` sessions left by a crashed run,
- closes stale `ACTIVE` quizzes,
- re-points the timetable entry at **today** (Monday fallback on Sundays).

If a previous run aborted mid-cycle, simply re-run the suite — the seed cleans
up after it.

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `API is not reachable` | `npm run dev --prefix backend`, then re-run with `E2E_NO_WEBSERVER=1`. |
| `login failed … database paused` | Restore Supabase or switch to the Docker PostgreSQL fallback. |
| `Too many login attempts` | Auth defaults to 20 requests / 15 min / IP. The Playwright config sets `AUTH_RATE_LIMIT_MAX=200` for its own backend; if you reuse a manually started server, start it with the same variable. |
| No timetable “Start Class” button | The fixture schedules the entry for today (Monday on Sundays) inside a slot that contains the current time. Re-run `npm run e2e:seed --prefix backend`. |
| Test stuck at `Launch Dynamic QR` | Ensure only one ACTIVE session exists for `e2e_faculty`; re-run `npm run e2e:seed --prefix backend`. |
