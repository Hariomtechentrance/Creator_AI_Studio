import { test, expect } from '@playwright/test';

test('visits login page', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByText('Welcome back')).toBeVisible();
});
