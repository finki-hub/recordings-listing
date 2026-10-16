import { expect, test } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';

import type { Transport, WireEvent } from '../wire-types.ts';

import { required } from '../helpers.ts';
import {
  collectErrors,
  isolateNetwork,
  oop,
  openSearch,
  readyResults,
} from './helpers.ts';

const oopRoutePattern = /objektno-orientirano-programiranje\.html#/u;
const uuidPattern = /^[0-9a-f-]{36}$/u;
const analyticsEndpointPattern = /^http:\/\/127\.0\.0\.1:4188\/e\//u;

test('real modal emits private-safe installed SDK wire with settled keyboard-click linkage', async ({
  context,
  page,
}) => {
  const assetsDir = new URL('../../.vitepress/dist/assets/', import.meta.url);
  const files = await readdir(assetsDir, { recursive: true });
  const assets = files.filter((name) => name.endsWith('.js'));
  const bundles = await Promise.all(
    assets.map((name) =>
      readFile(new URL(name.replaceAll('\\', '/'), assetsDir), 'utf8'),
    ),
  );
  const builtJavaScript = bundles.join('\n');
  for (const value of [
    'phc_integration_test_only',
    'http://127.0.0.1:4188',
    'catalog_search_v2',
  ]) {
    expect(
      builtJavaScript.includes(value),
      `production bundle contains ${value}`,
    ).toBe(true);
  }
  const events: WireEvent[] = [];
  const wires: string[] = [];
  const transports: Transport[] = [];
  // The SDK intentionally drops webdriver/HeadlessChrome client-hint traffic.
  // Emulate a human browser's bot hints only; capture and transport stay real.
  await context.addInitScript(() => {
    Object.defineProperties(navigator, {
      userAgentData: { get: () => null },
      webdriver: { get: () => false },
    });
  });
  await isolateNetwork(context, { events, transports, wires });
  const errors = collectErrors(page);
  const sentinel = 'qzxv938472privatepersonqzxv938472';
  const encoded = encodeURIComponent(sentinel);
  await page.goto(`${oop}?integration-private=${encoded}#${encoded}`);
  let input = await openSearch(page);
  await input.fill(sentinel);
  await readyResults(page);
  await expect(page.locator('.VPLocalSearchBox .no-results')).toBeVisible();
  await expect
    .poll(
      () =>
        events.filter((event) => event.event === 'search_zero_results_v2')
          .length,
      { timeout: 15_000 },
    )
    .toBe(1);
  await page
    .getByRole('button', { exact: true, name: 'Исчисти пребарување' })
    .click();
  await expect(input).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.locator('.VPLocalSearchBox')).toHaveCount(0);
  input = await openSearch(page);
  await input.fill('oop');
  await readyResults(page);
  await expect(
    page.locator(`.VPLocalSearchBox .result[href^="${oop}"]`),
  ).toHaveCount(1);
  await expect
    .poll(
      () =>
        events.filter(
          (event) =>
            event.event === 'catalog_search_v2' &&
            (event.properties.result_count ?? 0) > 0,
        ).length,
      { timeout: 15_000 },
    )
    .toBe(1);
  await input.press('Enter');
  await expect(page).toHaveURL(oopRoutePattern);
  await expect
    .poll(
      () =>
        events.filter((event) => event.event === 'result_clicked_v2').length,
      { timeout: 15_000 },
    )
    .toBe(1);

  const attempts = events.filter(
    (event) => event.event === 'catalog_search_v2',
  );
  expect(attempts).toHaveLength(2);
  const successful = required(
    attempts.find((event) => (event.properties.result_count ?? 0) > 0),
  );
  const empty = required(
    attempts.find((event) => event.properties.result_count === 0),
  );
  const click = required(
    events.find((event) => event.event === 'result_clicked_v2'),
  );
  expect(click.properties.search_id).toBe(successful.properties.search_id);
  expect(click.properties.search_pending).toBe(false);
  expect(click.properties.position).toBe(0);
  expect(click.properties.result_count).toBe(
    successful.properties.result_count,
  );
  expect(empty.properties.search_id).not.toBe(successful.properties.search_id);
  expect(
    required(events.find((event) => event.event === 'search_zero_results_v2'))
      .properties.search_id,
  ).toBe(empty.properties.search_id);
  for (const event of events) {
    expect(
      Object.keys(event).filter(
        (key) =>
          !['event', 'offset', 'properties', 'timestamp', 'uuid'].includes(key),
      ),
    ).toEqual([]);
    expect([
      'catalog_search_v2',
      'search_results_updated_v2',
      'search_zero_results_v2',
      'result_clicked_v2',
    ]).toContain(event.event);
    expect(event.properties.token).toBe('phc_integration_test_only');
    expect(event.properties.analytics_schema_version).toBe(2);
    expect(event.properties.service).toBe('recordings-listing');
    expect(event.properties.$process_person_profile).toBe(false);
    expect(event.properties.search_id).toMatch(uuidPattern);
    expect(Number.isSafeInteger(event.properties.result_count)).toBe(true);
    expect(event.properties.result_count).toBeGreaterThanOrEqual(0);
    const allowed = new Set([
      '$device_id',
      '$process_person_profile',
      '$session_id',
      '$window_id',
      'analytics_schema_version',
      'app_revision',
      'distinct_id',
      'position',
      'result_count',
      'search_id',
      'search_pending',
      'service',
      'token',
    ]);
    expect(
      Object.keys(event.properties).filter((key) => !allowed.has(key)),
    ).toEqual([]);
  }
  expect(wires.length).toBeGreaterThan(0);
  expect(transports.some(({ compressed }) => compressed)).toBe(true);
  for (const { url } of transports)
    expect(url).toMatch(analyticsEndpointPattern);
  for (const wire of wires) {
    for (const privateValue of [
      sentinel,
      encoded,
      'integration-private',
      'example.test',
      'objektno-orientirano-programiranje',
      '$current_url',
      'query',
      'result_id',
      '$set',
    ]) {
      expect(wire).not.toContain(privateValue);
    }
  }
  expect(errors).toEqual([]);
});
