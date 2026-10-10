import { test, expect } from '@playwright/test';
import { isolateNetwork, oop, openSearch, readyResults, sp } from './helpers.js';
import { learnifyCoursePages } from '../../.vitepress/theme/learnify-callout.js';

const origin = 'https://recordings.finki-hub.com';

async function expectCalloutAfterTitle(page) {
  const isBetweenTitleAndFirstSection = await page.evaluate(() => {
    const title = document.querySelector('.vp-doc h1');
    const callout = document.querySelector('.custom-block a[href="https://learnify.mk"]')?.closest('.custom-block');
    const firstSection = document.querySelector('.vp-doc h2');
    return Boolean(title && callout &&
      (title.compareDocumentPosition(callout) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (!firstSection || (callout.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING)));
  });
  expect(isBetweenTitleAndFirstSection).toBe(true);
}

test('built HTML has unique route-specific metadata and eligible Learnify markup without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await isolateNetwork(context);
  const page = await context.newPage();
  try {
    for (const [route, callout] of [['/', false], [sp, true], ['/courses/semester-1/index.html', false], ['/courses/semester-1/biznis-i-menadzhment.html', false], ['/introduction.html', false]]) {
      await page.goto(`http://127.0.0.1:4187${route}`);
      const canonical = page.locator('head link[rel="canonical"]');
      const ogUrl = page.locator('head meta[property="og:url"]');
      await expect(canonical).toHaveCount(1);
      await expect(ogUrl).toHaveCount(1);
      await expect(canonical).toHaveAttribute('href', origin + route);
      await expect(ogUrl).toHaveAttribute('content', origin + route);
      await expect(page.locator('.custom-block a[href="https://learnify.mk"]')).toHaveCount(callout ? 1 : 0);
      if (callout) await expectCalloutAfterTitle(page);
    }

    for (const relativePath of learnifyCoursePages) {
      const route = `/${relativePath.replace(/\.md$/, '.html')}`;
      await page.goto(`http://127.0.0.1:4187${route}`);
      await expect(page.locator('.custom-block a[href="https://learnify.mk"]')).toHaveCount(1);
      await expectCalloutAfterTitle(page);
    }
  } finally {
    await context.close();
  }
});

test('Learnify reacts to SPA routes and real search aliases target course headings, not Notes', async ({ page, context }) => {
  await isolateNetwork(context);
  await page.goto(sp);
  await expect(page.locator('.custom-block a[href="https://learnify.mk"]')).toBeVisible();
  await expectCalloutAfterTitle(page);
  // A marker distinguishes SPA navigation from a full document reload.
  await page.evaluate(() => { window.integrationNavigationMarker = true; });
  await page.locator('.VPNavBarMenu a[href="/introduction.html"]').click();
  await expect(page).toHaveURL(/\/introduction\.html$/);
  expect(await page.evaluate(() => window.integrationNavigationMarker)).toBe(true);
  await expect(page.locator('.custom-block a[href="https://learnify.mk"]')).toHaveCount(0);
  await page.locator(`.VPSidebar a[href="${oop}"]`).click();
  await expect(page).toHaveURL(/objektno-orientirano-programiranje\.html$/);
  await expect(page.locator('.custom-block a[href="https://learnify.mk"]')).toBeVisible();
  await expectCalloutAfterTitle(page);

  const aliases = [
    ['oop', oop, 'Објектно-ориентирано програмирање'],
    ['web programiranje', '/courses/semester-5/veb-programiranje.html', 'Веб програмирање'],
    ['sp', sp, 'Структурно програмирање'],
    ['aps', '/courses/semester-3/algoritmi-i-podatochni-strukturi.html', 'Алгоритми и податочни структури'],
  ];
  for (const [alias, route, title] of aliases) {
    const input = await openSearch(page);
    await input.fill(alias);
    await readyResults(page);
    const result = page.locator(`.VPLocalSearchBox a.result[href^="${route}"]`).filter({
      has: page.locator('.title.main .text', { hasText: new RegExp(`^${title}$`) }),
    });
    await expect(result).toHaveCount(1);
    await expect(result).toContainText(title);
    await expect(result).not.toContainText('Белешки');
    // Navigate using the actual result, then verify it points at the H1 anchor.
    const href = await result.getAttribute('href');
    await result.click();
    await expect(page.locator('.vp-doc h1')).toContainText(title);
    const headingId = await page.locator('.vp-doc h1').getAttribute('id');
    expect(decodeURIComponent(new URL(href, 'http://127.0.0.1:4187').hash)).toBe(`#${headingId}`);
    await expect(page.locator('.VPLocalSearchBox')).toHaveCount(0);
  }
});
