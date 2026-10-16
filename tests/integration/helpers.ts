import { type BrowserContext, expect, type Page } from '@playwright/test';
import { gunzipSync } from 'node:zlib';

import type { Transport, WireEvent, WirePayload } from '../wire-types.ts';

import { wireEvents } from '../helpers.ts';

const hydrationErrorPattern = /hydration|mismatch/iu;
const openClassPattern = /open/u;

export const sp = '/courses/semester-1/strukturno-programiranje.html';
export const math = '/courses/semester-1/matematika-1.html';
export const oop =
  '/courses/semester-2/objektno-orientirano-programiranje.html';

export const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (hydrationErrorPattern.test(message.text())) errors.push(message.text());
  });
  return errors;
};

export const favoriteStar = (page: Page, link: string) =>
  page.locator(
    `#favorites-section button.favorite-star[data-favorite-link="${link}"]`,
  );

// Installed SDK requests terminate here, before any page script runs. No real
// analytics key, remote config, fonts, or other third-party request is needed.
type NetworkEvidence = {
  events?: WireEvent[];
  transports?: Transport[];
  wires?: string[];
};
const decodeRequest = (body: Buffer) => {
  const compressed = body[0] === 31 && body[1] === 139;
  let text = (compressed ? gunzipSync(body) : body).toString();
  if (text.startsWith('data=')) {
    // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Keep Node Buffer decoding for the SDK's transport fixtures.
    text = Buffer.from(
      new URLSearchParams(text).get('data') ?? '',
      'base64',
    ).toString();
  }
  return { compressed, payload: JSON.parse(text) as WirePayload };
};
export const isolateNetwork = async (
  context: BrowserContext,
  { events = [], transports = [], wires = [] }: NetworkEvidence = {},
) => {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:4187') {
      await route.continue();
      return;
    }
    if (url.origin !== 'http://127.0.0.1:4188') {
      await route.abort();
      return;
    }
    const body = request.postDataBuffer();
    if (body && body.length > 0) {
      const { compressed, payload } = decodeRequest(body);
      transports.push({ compressed, url: request.url() });
      wires.push(request.url() + JSON.stringify(payload));
      events.push(...wireEvents(payload));
    }
    await route.fulfill({
      body: '{}',
      contentType: 'application/json',
      headers: {
        'access-control-allow-headers': '*',
        'access-control-allow-origin': '*',
      },
      status: 200,
    });
  });
};

export const openMobileMenu = async (page: Page) => {
  const menu = page.getByRole('button', { exact: true, name: 'Мени' });
  if (
    !(await page
      .locator('.VPSidebar')
      .evaluate((sidebar) => sidebar.classList.contains('open')))
  ) {
    await menu.focus();
    await menu.press('Enter');
  }
  await expect(page.locator('.VPSidebar')).toHaveClass(openClassPattern);
};

export const openSearch = async (page: Page) => {
  await page.getByRole('button', { exact: true, name: 'Пребарај' }).click();
  const box = page.locator('.VPLocalSearchBox');
  await expect(box).toBeVisible();
  return box.locator('input');
};

export const originalStar = (page: Page, link: string) =>
  page.locator(
    `.VPSidebar button.favorite-star[data-favorite-link="${link}"]:not(#favorites-section button)`,
  );

export const readyResults = async (page: Page) => {
  await expect(page.locator('.VPLocalSearchBox ul.results')).toHaveAttribute(
    'aria-busy',
    'false',
  );
};
