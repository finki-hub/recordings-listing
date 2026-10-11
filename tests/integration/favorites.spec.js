import { test, expect } from '@playwright/test';
import { collectErrors, favoriteStar, isolateNetwork, math, openMobileMenu, originalStar, sp } from './helpers.js';

async function captureThemeEvidence(page, name) {
  const directory = process.env.FAVORITES_SCREENSHOT_DIR;
  if (directory) await page.screenshot({ path: `${directory}/${name}.png` });
}

async function expectStarIcon(button, selected) {
  await expect(button).toHaveAttribute('aria-pressed', String(selected));
  await expect(button.locator('svg.favorite-star-icon')).toHaveCount(1);
  await expect(button.locator('svg.favorite-star-icon')).toHaveAttribute('aria-hidden', 'true');
  const iconPath = button.locator('svg.favorite-star-icon path');
  await expect.poll(() => iconPath.evaluate((path, isSelected) => {
    const style = getComputedStyle(path);
    const buttonColor = getComputedStyle(path.closest('button')).color;
    return style.stroke === buttonColor &&
      (isSelected ? style.fill === buttonColor : style.fill === 'none');
  }, selected)).toBe(true);
  const bounds = await button.boundingBox();
  expect(bounds.width).toBe(44);
  expect(bounds.height).toBe(44);
}

async function expectBrandColor(control) {
  await expect.poll(() => control.evaluate((element) => {
    const actual = getComputedStyle(element).color;
    const probe = document.createElement('span');
    probe.style.color = 'var(--vp-c-brand-1)';
    document.body.appendChild(probe);
    const brand = getComputedStyle(probe).color;
    probe.remove();
    return actual === brand;
  })).toBe(true);
}

async function expectFavoritesHeadingGap(page) {
  const icon = page.locator('#favorites-section > .item .favorites-heading-icon');
  const label = page.locator('#favorites-section > .item .text');
  await expect.poll(async () => {
    const [iconBox, labelBox] = await Promise.all([icon.boundingBox(), label.boundingBox()]);
    return iconBox && labelBox ? labelBox.x - iconBox.x - iconBox.width : -1;
  }).toBeGreaterThanOrEqual(8);
}

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
  await expect(originalStar(page, sp)).toHaveAttribute('aria-label', 'Отстрани од омилени');
  await expectStarIcon(originalStar(page, sp), true);
  await expect(favoriteStar(page, sp)).toHaveCount(1);
  await expectStarIcon(favoriteStar(page, sp), true);
  await expectBrandColor(originalStar(page, sp));
  await expectBrandColor(favoriteStar(page, sp));
  const headingIcon = page.locator('#favorites-section .favorites-heading-icon');
  await expect(headingIcon).toHaveAttribute('aria-hidden', 'true');
  await expectBrandColor(headingIcon);
  await expectFavoritesHeadingGap(page);
  await captureThemeEvidence(page, 'favorites-desktop-light');
  await expect(originalStar(page, math)).toHaveAttribute('aria-label', 'Додади во омилени');
  await expectStarIcon(originalStar(page, math), false);
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('1');

  const appearance = page.locator('.VPSwitchAppearance');
  if (await page.locator('html').evaluate((html) => html.classList.contains('dark'))) {
    await appearance.click();
  }
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expectStarIcon(originalStar(page, sp), true);
  await expectBrandColor(originalStar(page, sp));
  await expectBrandColor(favoriteStar(page, sp));
  await appearance.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expectStarIcon(originalStar(page, sp), true);
  await expectStarIcon(originalStar(page, math), false);
  await expectBrandColor(originalStar(page, sp));
  await expectBrandColor(favoriteStar(page, sp));
  await expectBrandColor(headingIcon);
  await expectFavoritesHeadingGap(page);
  await captureThemeEvidence(page, 'favorites-desktop-dark');
  await appearance.click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await originalStar(page, math).focus();
  await page.keyboard.press('Enter');
  await expect(originalStar(page, math)).toHaveAttribute('aria-pressed', 'true');
  await expectStarIcon(originalStar(page, math), true);
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('2');
  await page.keyboard.press('Space');
  await expect(originalStar(page, math)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#favorites-section .favorites-count')).toHaveText('1');

  await page.setViewportSize({ width: 390, height: 844 });
  await openMobileMenu(page);
  await expectFavoritesHeadingGap(page);
  await captureThemeEvidence(page, 'favorites-mobile-light');
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

  const secondAppearance = second.locator('.VPSwitchAppearance');
  await secondAppearance.click();
  await expect(second.locator('html')).toHaveClass(/dark/);
  await second.setViewportSize({ width: 390, height: 844 });
  await openMobileMenu(second);
  await expectFavoritesHeadingGap(second);
  await captureThemeEvidence(second, 'favorites-mobile-dark');
});
