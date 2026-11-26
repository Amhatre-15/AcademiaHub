# Load & Concurrency Tests (k6)

Phase 17 performance validation for the two hot paths that define exam-morning
behaviour:

1. **Attendance rush** — ~1,200 students submit the rotating HMAC QR payload
   inside a 45-second window.
2. **Live socket storm** — 1,200 authenticated WebSockets join one session room
   and stay connected for the duration of a lecture.

Both scripts need [k6](https://k6.io/docs/get-started/installation/) on `PATH`
(`choco install k6`, `brew install k6`, or the official MSI/Docker image).

## 1. Prepare the fixture and token pool

```bash
# Isolated E2E class + faculty + timetable entry
npm run e2e:seed --prefix backend

# 1,200 students enrolled in that class + signed 7-day JWTs
npm run e2e:load-users --prefix backend
# custom size:
#   LOAD_STUDENT_COUNT=2500 npm run e2e:load-users --prefix backend
```

The generator writes `load-tests/tokens.json` (git-ignored). Tokens are signed
locally with `JWT_SECRET`, so the load generator does **not** pay bcrypt cost
for 1,200 logins.

## 2. Start a live session

Start a class from **Faculty → My Timetable → Start Class** (the E2E faculty
account is `e2e_faculty` / `E2e@Test123`). The attendance script's `setup()`
opens a 5-minute START checkpoint if none is active.

## 3. Run the benchmarks

```bash
# Attendance burst: 26 req/s × 45 s ≈ 1,170 unique students
npm run test:load:attendance

# WebSocket storm: ramp 0 → 1,200 sockets, hold 60 s
npm run test:load:sockets
```

Direct k6 invocations:

```bash
k6 run -e LOAD_RATE=40 -e LOAD_DURATION=45s load-tests/attendance-rush.js
k6 run -e VUS=500 -e HOLD_SECONDS=30 load-tests/live-session-sockets.js
k6 run -e API_URL=https://staging.example.com load-tests/attendance-rush.js
```

## Thresholds

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| `http_req_duration{scenario:attendance_rush}` | `p(95) < 120 ms`, `p(99) < 300 ms` | Project KPI from `future_plan.md` §3.4 |
| `attendance_success` | `> 99 %` | Every unique student is accepted once |
| `http_req_failed` | `< 1 %` | Network/server errors |
| `ws_connection_time` | `p(95) < 1500 ms` | Auth + upgrade + room join |
| `ws_error_rate` | `< 1 %` | Failed upgrades or socket errors |

> ℹ️ Model cloud round-trips realistically: if the database is remote, raise
> the latency thresholds or run against a local PostgreSQL container
> (`docker-compose.local-db.yml`). The 120 ms target assumes same-region
> infrastructure.

## Reading the output

- `attendance_duplicates` — a student token was reused. Increase the pool
  (≥ `LOAD_RATE × duration`) to eliminate.
- `attendance_expired_tokens` — clock drift between the k6 host and the API.
  Sync both clocks, or increase the 6-second tolerance in
  `backend/src/utils/attendance.ts`.
- WebSocket tests are bound by the OS file-descriptor limit. On Linux/macOS run
  `ulimit -n 65535` before `k6`; on Windows use Docker/WSL for large runs.
