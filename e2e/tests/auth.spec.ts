import { test, expect } from '@playwright/test';

test('visits login page', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByText('Welcome back')).toBeVisible();
});

test('signup page renders with a form', async ({ page }) => {
  await page.goto('/auth/signup');
  await expect(page).toHaveURL(/\/auth\/signup/);
  await expect(page.locator('form').first()).toBeVisible();
});

test('forgot-password page renders', async ({ page }) => {
  await page.goto('/auth/forgot-password');
  await expect(page).toHaveURL(/\/auth\/forgot-password/);
});

test('health endpoint responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
});
