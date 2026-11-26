import { execSync } from 'node:child_process';
import path from 'node:path';
import { request } from '@playwright/test';
import { API_URL, FIXTURE, apiLogin } from './fixtures';

/**
 * Runs once before the browser suite:
 *  1. Verifies the API server is reachable.
 *  2. Repairs the deterministic E2E fixture (users, class, timetable, clean state).
 *  3. Verifies all three roles can authenticate.
 *
 * The web server is already up at this point — Playwright starts `webServer`
 * entries before executing global setup.
 */
export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, '..');

  const api = await request.newContext({ baseURL: API_URL });

  // ── 1. Health probe ───────────────────────────────────────────────────────
  let healthy = false;
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const response = await api.get('/health');
      if (response.ok()) {
        healthy = true;
        break;
      }
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  if (!healthy) {
    await api.dispose();
    throw new Error(
      `AcademiaHub API is not reachable at ${API_URL}.\n` +
        'Start it manually with `npm run dev --prefix backend`, or unset E2E_NO_WEBSERVER.'
    );
  }

  // ── 2. Seed fixture ───────────────────────────────────────────────────────
  if (!process.env.E2E_SKIP_SEED) {
    console.log('\n[e2e] Seeding deterministic fixture…');
    execSync('npm run e2e:seed', {
      cwd: path.join(repoRoot, 'backend'),
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
  }

  // ── 3. Verify credentials ─────────────────────────────────────────────────
  const attempts: Array<[string, string]> = [
    [FIXTURE.admin, 'admin'],
    [FIXTURE.faculty, 'faculty'],
    [FIXTURE.studentA, 'student'],
  ];

  for (const [username, label] of attempts) {
    try {
      await apiLogin(api, username);
      console.log(`[e2e] ✓ ${label} login verified (${username})`);
    } catch (error) {
      await api.dispose();
      throw new Error(
        `E2E fixture user "${username}" could not log in. ` +
          'The database may be paused/unreachable — check backend/.env DATABASE_URL.\n' +
          String(error)
      );
    }
  }

  await api.dispose();
}
