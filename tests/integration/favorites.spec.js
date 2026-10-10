import { test, expect } from '@playwright/test';
import { collectErrors, favoriteStar, isolateNetwork, math, openMobileMenu, originalStar, sp } from './helpers.js';

test('hydrated favorites survive keyboard toggles, mobile navigation, reload and cross-tab updates', async ({ page, context }) => {
  await isolateNetwork(context);
  // Seed before hydration, but only once: subsequent reload must read the real
  // persisted result instead of silently reseeding the fixture.
  await context.addInitScript(({ link }) => {
    if (!localStorage.getItem('integration-seeded')) {
      localStorage.setItem('favorites', JSON.stringify([link]));
      localStorage.setItem('integration-seeded', 'true');
    }
  }, { link: sp });
  const errors = collectErrors(page);
  await page.goto(math);
  await expect(originalStar(page, sp)).toHaveCount(1);
  await expect(originalStar(page, sp)).toHaveAttribute('aria-pressed', 'true');
  await expect(favoriteStar(page, sp)).toHaveCount(1);
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('1');

  await originalStar(page, math).focus();
  await page.keyboard.press('Enter');
  await expect(originalStar(page, math)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('2');
  await page.keyboard.press('Space');
  await expect(originalStar(page, math)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('1');

  await page.setViewportSize({ width: 390, height: 844 });
  await openMobileMenu(page);
  await page.locator(`#favorites-section a[href="${sp}"]`).click();
  await expect(page).toHaveURL(new RegExp(sp.replaceAll('.', '\\.') + '$'));
  await expect(page.locator('.vp-doc h1')).toContainText('Структурно програмирање');
  await expect(page.locator('.VPSidebar')).not.toHaveClass(/open/);
  await openMobileMenu(page);
  await favoriteStar(page, sp).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#favorites-section')).toHaveCount(0);
  await expect(originalStar(page, sp)).toBeFocused();
  await expect(originalStar(page, sp)).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Enter');
  await expect(favoriteStar(page, sp)).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await openMobileMenu(page);
  await expect(favoriteStar(page, sp)).toHaveCount(1);
  await expect(originalStar(page, sp)).toHaveAttribute('aria-pressed', 'true');

  const second = await context.newPage();
  const secondErrors = collectErrors(second);
  await second.goto(sp);
  await expect(originalStar(second, sp)).toHaveAttribute('aria-pressed', 'true');
  await originalStar(second, math).click();
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('2');
  await expect(originalStar(page, math)).toHaveAttribute('aria-pressed', 'true');
  await favoriteStar(page, math).focus();
  await page.keyboard.press('Enter');
  await expect(originalStar(page, math)).toBeFocused();
  await expect(originalStar(second, math)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('1');
  await expect(originalStar(page, sp)).toHaveCount(1);
  await expect(favoriteStar(page, sp)).toHaveCount(1);
  await expect(originalStar(second, sp)).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('favorites')))).toEqual([sp]);
  expect(errors).toEqual([]);
  expect(secondErrors).toEqual([]);
});
