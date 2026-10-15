import { test, expect } from '@playwright/test';
import { languageNames, translations } from '../../.vitepress/i18n.ts';
import { collectErrors, favoriteStar, isolateNetwork, math, oop, readyResults, sp } from './helpers.js';

const prefix = (language) => language === 'mk' ? '' : `/${language}`;

async function choose(page, language) {
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: languageNames[language], exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

test('built language pages translate headings and metadata while keeping recording links and anchors without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await isolateNetwork(context);
  const page = await context.newPage();
  let original;
  try {
    for (const language of ['mk', 'en', 'sq', 'tr']) {
      const route = prefix(language) + sp;
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.locator('.vp-doc h1')).toContainText('Структурно програмирање');
      await expect(page.locator('.vp-doc h2').first()).toContainText(translations[language].sections.lectures);
      await expect(page.locator('.custom-block-title')).toHaveText(translations[language].learnify.title);
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `https://recordings.finki-hub.com${route}`);
      await expect(page.locator('head link[rel="alternate"]')).toHaveCount(4);
      const content = await page.locator('.vp-doc').first().evaluate((doc) => ({
        links: [...doc.querySelectorAll('a:not(.header-anchor)')].map((a) => [a.getAttribute('href'), a.textContent]),
        anchors: [...doc.querySelectorAll('h1, h2, h3')].map((heading) => heading.id),
      }));
      if (original) expect(content).toEqual(original);
      else original = content;
    }
  } finally { await context.close(); }
});

test('switching languages preserves course sections and legacy favorites, and search uses the selected locale', async ({ page, context }) => {
  await isolateNetwork(context);
  await context.addInitScript(({ math }) => {
    if (!localStorage.getItem('localization-seeded')) {
      localStorage.setItem('favorites', JSON.stringify([math]));
      localStorage.setItem('localization-seeded', 'yes');
    }
  }, { math });
  const errors = collectErrors(page);
  await page.goto(`${sp}?view=all#предавања`);
  for (const language of ['en', 'sq', 'tr', 'mk']) {
    const t = translations[language];
    await choose(page, language);
    const url = new URL(page.url());
    expect(url.pathname).toBe(prefix(language) + sp);
    expect(url.search).toBe('?view=all');
    expect(decodeURIComponent(url.hash)).toBe('#предавања');
    await expect(favoriteStar(page, prefix(language) + math)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#favorites-section > .item .text')).toHaveText(t.favorites.title);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('favorites')))).toEqual([math]);
    expect(await page.evaluate(() => localStorage.getItem('finki-hub-lang'))).toBe(language);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', t.title);
    await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', t.brand);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `https://recordings.finki-hub.com${prefix(language) + sp}`);
    await expect(page.getByRole('combobox')).toBeFocused();
    expect(await page.getByRole('combobox').evaluate((el) => el.matches(':focus-visible'))).toBe(false);

    await page.getByRole('button', { name: t.search.button.buttonAriaLabel, exact: true }).click();
    await page.locator('.VPLocalSearchBox input').fill('oop');
    await readyResults(page);
    const result = page.locator(`.VPLocalSearchBox a.result[href^="${prefix(language) + oop}"]`).filter({
      has: page.locator('.title.main .text', { hasText: /^Објектно-ориентирано програмирање$/ }),
    });
    await expect(result).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.VPLocalSearchBox')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('mobile dropdown supports keyboard selection, persistence and unavailable storage', async ({ page, context }) => {
  await isolateNetwork(context);
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/tr/');
  await page.getByRole('combobox').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Türkçe', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('combobox')).toBeFocused();
  expect(await page.getByRole('combobox').evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  for (const language of ['en', 'sq', 'tr', 'mk']) {
    await choose(page, language);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  await choose(page, 'sq');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'sq');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'sq');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await choose(page, 'tr');
  await expect(page).toHaveURL(/\/tr\/$/);
  expect(errors).toEqual([]);
});
