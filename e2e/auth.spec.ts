import { expect, test } from '@playwright/test';
import { FIXTURE, loginViaUi } from './fixtures';

/**
 * Phase 17 — Authentication and role-based route protection.
 */
test.describe('Authentication & RBAC', () => {
  test('unauthenticated visitors are redirected to the login page', async ({ page }) => {
    await page.goto('/student/live');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('invalid credentials surface a friendly error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill(FIXTURE.faculty);
    await page.locator('#password').fill('definitely-the-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/Username or password is incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('students land on their dashboard and cannot open admin routes', async ({ page }) => {
    await loginViaUi(page, FIXTURE.studentA);

    await expect(page).toHaveURL(/\/student(\/|$)/);
    await expect(page.getByText(/Welcome back/i)).toBeVisible();

    // Role guard must bounce the student back to their own dashboard.
    await page.goto('/admin/students');
    await expect(page).toHaveURL(/\/student(\/|$)/);
  });

  test('faculty land in the faculty cockpit', async ({ page }) => {
    await loginViaUi(page, FIXTURE.faculty);

    await expect(page).toHaveURL(/\/faculty(\/|$)/);
    await expect(page.getByRole('heading', { name: /faculty dashboard/i })).toBeVisible();
  });
});
