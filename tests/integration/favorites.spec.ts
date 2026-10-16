import { expect, type Locator, type Page, test } from '@playwright/test';

import { required } from '../helpers.ts';
import {
  collectErrors,
  favoriteStar,
  isolateNetwork,
  math,
  openMobileMenu,
  originalStar,
  sp,
} from './helpers.ts';

const starIconSelector = 'svg.favorite-star-icon';
const favoriteRemovalLabel = 'Отстрани од омилени';

const pressedAttribute = 'aria-pressed';
const favoriteAdditionLabel = 'Додади во омилени';
const favoriteCountSelector = '#favorites-section .favorites-count';
const darkClassPattern = /dark/u;
const openClassPattern = /open/u;

const captureThemeEvidence = async (page: Page, name: string) => {
  const directory = process.env['FAVORITES_SCREENSHOT_DIR'];
  if (directory) await page.screenshot({ path: `${directory}/${name}.png` });
};

const expectBrandColor = async (control: Locator) => {
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const actual = getComputedStyle(element).color;
        const probe = document.createElement('span');
        probe.style.color = 'var(--vp-c-brand-1)';
        document.body.append(probe);
        const brand = getComputedStyle(probe).color;
        probe.remove();
        return actual === brand;
      }),
    )
    .toBe(true);
};

const expectFavoritesHeadingGap = async (page: Page) => {
  const icon = page.locator(
    '#favorites-section > .item .favorites-heading-icon',
  );
  const label = page.locator('#favorites-section > .item .text');
  await expect
    .poll(async () => {
      const [iconBox, labelBox] = await Promise.all([
        icon.boundingBox(),
        label.boundingBox(),
      ]);
      return iconBox && labelBox ? labelBox.x - iconBox.x - iconBox.width : -1;
    })
    .toBeGreaterThanOrEqual(8);
};

const expectStarIcon = async (button: Locator, selected: boolean) => {
  await expect(button).toHaveAttribute(pressedAttribute, String(selected));
  await expect(button.locator(starIconSelector)).toHaveCount(1);
  await expect(button.locator(starIconSelector)).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  const iconPath = button.locator('svg.favorite-star-icon path');
  await expect
    .poll(() =>
      iconPath.evaluate((path, isSelected) => {
        const style = getComputedStyle(path);
        const buttonColor = getComputedStyle(
          path.closest('button') ?? path,
        ).color;
        return (
          style.stroke === buttonColor &&
          (isSelected ? style.fill === buttonColor : style.fill === 'none')
        );
      }, selected),
    )
    .toBe(true);
  const bounds = required(await button.boundingBox());
  expect(bounds.width).toBe(44);
  expect(bounds.height).toBe(44);
};

test('hydrated favorites survive keyboard toggles, mobile navigation, reload and cross-tab updates', async ({
  context,
  page,
}) => {
  await isolateNetwork(context);
  // Seed before hydration, but only once: subsequent reload must read the real
  // persisted result instead of silently reseeding the fixture.
  await context.addInitScript(
    ({ link }) => {
      if (localStorage.getItem('integration-seeded')) {
        return;
      }

      localStorage.setItem('favorites', JSON.stringify([link]));
      localStorage.setItem('integration-seeded', 'true');
    },
    { link: sp },
  );
  const errors = collectErrors(page);
  await page.goto(math);
  await expect(originalStar(page, sp)).toHaveCount(1);
  await expect(originalStar(page, sp)).toHaveAttribute(
    pressedAttribute,
    'true',
  );
  await expect(originalStar(page, sp)).toHaveAttribute(
    'aria-label',
    favoriteRemovalLabel,
  );
  await expectStarIcon(originalStar(page, sp), true);
  await expect(favoriteStar(page, sp)).toHaveCount(1);
  await expectStarIcon(favoriteStar(page, sp), true);
  await expectBrandColor(originalStar(page, sp));
  await expectBrandColor(favoriteStar(page, sp));
  const headingIcon = page.locator(
    '#favorites-section .favorites-heading-icon',
  );
  await expect(headingIcon).toHaveAttribute('aria-hidden', 'true');
  await expectBrandColor(headingIcon);
  await expectFavoritesHeadingGap(page);
  await captureThemeEvidence(page, 'favorites-desktop-light');
  await expect(originalStar(page, math)).toHaveAttribute(
    'aria-label',
    favoriteAdditionLabel,
  );
  await expectStarIcon(originalStar(page, math), false);
  await expect(page.locator(favoriteCountSelector)).toHaveText('1');

  const appearance = page.locator('.VPSwitchAppearance');
  if (
    await page
      .locator('html')
      .evaluate((html) => html.classList.contains('dark'))
  ) {
    await appearance.click();
  }
  await expect(page.locator('html')).not.toHaveClass(darkClassPattern);
  await expectStarIcon(originalStar(page, sp), true);
  await expectBrandColor(originalStar(page, sp));
  await expectBrandColor(favoriteStar(page, sp));
  await appearance.click();
  await expect(page.locator('html')).toHaveClass(darkClassPattern);
  await expectStarIcon(originalStar(page, sp), true);
  await expectStarIcon(originalStar(page, math), false);
  await expectBrandColor(originalStar(page, sp));
  await expectBrandColor(favoriteStar(page, sp));
  await expectBrandColor(headingIcon);
  await expectFavoritesHeadingGap(page);
  await captureThemeEvidence(page, 'favorites-desktop-dark');
  await appearance.click();
  await expect(page.locator('html')).not.toHaveClass(darkClassPattern);

  await originalStar(page, math).focus();
  await page.keyboard.press('Enter');
  await expect(originalStar(page, math)).toHaveAttribute(
    pressedAttribute,
    'true',
  );
  await expectStarIcon(originalStar(page, math), true);
  await expect(page.locator(favoriteCountSelector)).toHaveText('2');
  await page.keyboard.press('Space');
  await expect(originalStar(page, math)).toHaveAttribute(
    pressedAttribute,
    'false',
  );
  await expect(page.locator(favoriteCountSelector)).toHaveText('1');

  await page.setViewportSize({ height: 844, width: 390 });
  await openMobileMenu(page);
  await expectFavoritesHeadingGap(page);
  await captureThemeEvidence(page, 'favorites-mobile-light');
  await page.locator(`#favorites-section a[href="${sp}"]`).click();
  await expect(page).toHaveURL((url) => url.pathname === sp);
  await expect(page.locator('.vp-doc h1')).toContainText(
    'Структурно програмирање',
  );
  await expect(page.locator('.VPSidebar')).not.toHaveClass(openClassPattern);
  await openMobileMenu(page);
  await favoriteStar(page, sp).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#favorites-section')).toHaveCount(0);
  await expect(originalStar(page, sp)).toBeFocused();
  await expect(originalStar(page, sp)).toHaveAttribute(
    pressedAttribute,
    'false',
  );
  await page.keyboard.press('Enter');
  await expect(favoriteStar(page, sp)).toHaveAttribute(
    pressedAttribute,
    'true',
  );
  await page.reload();
  await openMobileMenu(page);
  await expect(favoriteStar(page, sp)).toHaveCount(1);
  await expect(originalStar(page, sp)).toHaveAttribute(
    pressedAttribute,
    'true',
  );

  const second = await context.newPage();
  const secondErrors = collectErrors(second);
  await second.goto(sp);
  await expect(originalStar(second, sp)).toHaveAttribute(
    pressedAttribute,
    'true',
  );
  await originalStar(second, math).click();
  await expect(page.locator(favoriteCountSelector)).toHaveText('2');
  await expect(originalStar(page, math)).toHaveAttribute(
    pressedAttribute,
    'true',
  );
  await favoriteStar(page, math).focus();
  await page.keyboard.press('Enter');
  await expect(originalStar(page, math)).toBeFocused();
  await expect(originalStar(second, math)).toHaveAttribute(
    pressedAttribute,
    'false',
  );
  await expect(page.locator(favoriteCountSelector)).toHaveText('1');
  await expect(originalStar(page, sp)).toHaveCount(1);
  await expect(favoriteStar(page, sp)).toHaveCount(1);
  await expect(originalStar(second, sp)).toHaveCount(1);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('favorites') ?? 'null') as unknown,
    ),
  ).toEqual([sp]);
  expect(errors).toEqual([]);
  expect(secondErrors).toEqual([]);

  const secondAppearance = second.locator('.VPSwitchAppearance');
  await secondAppearance.click();
  await expect(second.locator('html')).toHaveClass(darkClassPattern);
  await second.setViewportSize({ height: 844, width: 390 });
  await openMobileMenu(second);
  await expectFavoritesHeadingGap(second);
  await captureThemeEvidence(second, 'favorites-mobile-dark');
});
