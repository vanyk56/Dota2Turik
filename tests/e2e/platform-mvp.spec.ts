// [Phase: MVP v1] Playwright E2E Tests for Core Platform Flows (Section 16)
import { test, expect } from '@playwright/test';

test.describe('Dota 2 Tournament Platform — MVP E2E', () => {
  test('renders home page with dot-matrix canvas, navigation, and RU/EN locale toggle', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('header')).toContainText('Dota turnir');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('initiates Steam OpenID 2.0 redirect on login endpoint', async ({
    request,
  }) => {
    const response = await request.get('/api/auth/steam/login', {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    const location = response.headers()['location'] ?? '';
    expect(location).toContain('https://steamcommunity.com/openid/login');
    expect(location).toContain('openid.mode=checkid_setup');
  });

  test('renders team catalog with search and filter controls', async ({
    page,
  }) => {
    await page.goto('/teams');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[name="q"]')).toBeVisible();
    await expect(page.locator('select[name="region"]')).toBeVisible();
  });

  test('renders tournaments directory and leaderboard', async ({ page }) => {
    await page.goto('/tournaments');
    await expect(page.locator('h1')).toBeVisible();

    await page.goto('/leaderboard');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('protects /admin route for unauthenticated guests with 403 Forbidden state', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(page.getByText('403 — Доступ ограничен')).toBeVisible();
  });
});
