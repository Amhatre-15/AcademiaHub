import { defineConfig, devices } from '@playwright/test';

/**
 * AcademiaHub — Playwright End-to-End configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 17 (Quality Assurance). These tests drive the real browser against a
 * real backend + PostgreSQL, exercising the complete classroom cycle:
 *
 *   Faculty starts class → rotating QR checkpoint → Student attends →
 *   live quiz → anti-cheat detection → session close → attendance finalised.
 *
 * Prerequisites (see e2e/README.md):
 *   1. A reachable PostgreSQL database (`DATABASE_URL` in backend/.env)
 *   2. `npx playwright install chromium`
 *   3. Nothing needs to be running — the config boots both dev servers.
 *
 * Useful environment variables:
 *   E2E_BASE_URL        Frontend origin (default http://localhost:5173)
 *   E2E_API_URL         Backend origin  (default http://localhost:5000)
 *   E2E_NO_WEBSERVER=1  Use servers you started yourself
 *   E2E_SKIP_SEED=1     Skip re-seeding the deterministic fixture
 */

const FRONTEND_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';

export default defineConfig({
  testDir: './e2e',
  // The classroom cycle shares one faculty/session, so run specs serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Remote/dev databases can take several seconds per query (Supabase pooler),
  // and the classroom journey performs a lot of them.
  timeout: 180_000,
  expect: { timeout: 30_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : [
        {
          command: 'npm run dev --prefix backend',
          url: `${API_URL}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            ...(process.env as Record<string, string>),
            // The suite performs several role logins; keep the auth limiter
            // out of the way locally and in CI.
            AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX ?? '200',
          },
        },
        {
          command: 'npm run dev --prefix frontend',
          url: FRONTEND_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
});
