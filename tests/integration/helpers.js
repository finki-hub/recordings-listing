import { expect } from '@playwright/test';
import { gunzipSync } from 'node:zlib';

export const sp = '/courses/semester-1/strukturno-programiranje.html';
export const math = '/courses/semester-1/matematika-1.html';
export const oop = '/courses/semester-2/objektno-orientirano-programiranje.html';

// Installed SDK requests terminate here, before any page script runs. No real
// analytics key, remote config, fonts, or other third-party request is needed.
export async function isolateNetwork(context, events = [], wires = [], transports = []) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:4188') {
      const body = request.postDataBuffer();
      if (body?.length) {
        const compressed = body[0] === 31 && body[1] === 139;
        transports.push({ url: request.url(), compressed });
        let text = (compressed ? gunzipSync(body) : body).toString();
        if (text.startsWith('data=')) text = Buffer.from(new URLSearchParams(text).get('data'), 'base64').toString();
        const payload = JSON.parse(text);
        wires.push(request.url() + JSON.stringify(payload));
        events.push(...(payload.batch ?? (Array.isArray(payload) ? payload : [payload])));
      }
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        contentType: 'application/json',
        body: '{}',
      });
    } else if (url.origin === 'http://127.0.0.1:4187') {
      await route.continue();
    } else {
      await route.abort();
    }
  });
}

export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/hydration|mismatch/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

export async function openSearch(page) {
  await page.getByRole('button', { name: 'Пребарај', exact: true }).click();
  const box = page.locator('.VPLocalSearchBox');
  await expect(box).toBeVisible();
  return box.locator('input');
}

export async function readyResults(page) {
  await expect(page.locator('.VPLocalSearchBox ul.results')).toHaveAttribute('aria-busy', 'false');
}

export async function openMobileMenu(page) {
  const menu = page.getByRole('button', { name: 'Мени', exact: true });
  if (!(await page.locator('.VPSidebar').evaluate((sidebar) => sidebar.classList.contains('open')))) {
    await menu.focus();
    await menu.press('Enter');
  }
  await expect(page.locator('.VPSidebar')).toHaveClass(/open/);
}

export function originalStar(page, link) {
  return page.locator(`.VPSidebar button.favorite-star[data-favorite-link="${link}"]:not(#favorites-section button)`);
}

export function favoriteStar(page, link) {
  return page.locator(`#favorites-section button.favorite-star[data-favorite-link="${link}"]`);
}
