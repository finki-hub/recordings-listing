import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

import type { WireEvent } from './wire-types.ts';

import {
  analyticsConfig,
  type CaptureSearchEvent,
  initAnalytics,
  resolveBuildRevision,
} from '../.vitepress/theme/analytics.ts';
import {
  attachSearchAnalytics,
  createSearchTracker,
} from '../.vitepress/theme/search-analytics.ts';
import {
  attempt,
  clock,
  decode,
  encoded,
  type FixtureHandler,
  key,
  PRIVATE,
  readinessFixture,
  sdkBrowser,
  type SearchEvent,
  sha,
  uninitializedObserver,
} from './fixtures/analytics.ts';
import { at, domFixture, get, wireEvents } from './helpers.ts';

const hasValidTimestamp = (value: string) =>
  // eslint-disable-next-line unicorn/prefer-temporal -- Validate the SDK's existing Date timestamps while supporting Node 24.
  Number.isFinite(Date.parse(value));
const collator = new Intl.Collator();
const posthogEndpointPattern = /^https:\/\/eu\.i\.posthog\.com\/e\//u;
const uuidPattern = /^[0-9a-f-]{36}$/u;

test('settled attempts: no keystroke inflation, exact identity, cancellation and click linkage', () => {
  const time = clock();
  const events: SearchEvent[] = [];
  const tracker = createSearchTracker({
    ...time,
    capture: (event, properties) => {
      events.push({ event, properties });
    },
  });
  tracker.update('pri', 4);
  time.tick(499);
  assert.equal(events.length, 0);
  tracker.update(PRIVATE, 2);
  time.tick(499);
  tracker.click(1);
  assert.equal(at(events, 0).properties.search_pending, true);
  assert.equal(at(events, 0).properties.search_id, undefined);
  time.tick(1);
  const id = at(events, 1).properties.search_id;
  assert.equal(at(events, 1).event, 'catalog_search_v2');
  tracker.click(0);
  assert.equal(at(events, 2).properties.search_id, id);
  tracker.update(`${PRIVATE}x`, 2);
  time.tick(200);
  tracker.update(PRIVATE, 2);
  time.tick(500);
  assert.equal(
    events.length,
    3,
    'canceled edit does not create another intent',
  );
  tracker.click(1);
  assert.equal(
    at(events, 3).properties.search_id,
    id,
    'quiet restoration relinks clicks',
  );
  tracker.update(PRIVATE, 3);
  assert.equal(at(events, 4).event, 'search_results_updated_v2');
  assert.equal(at(events, 4).properties.search_id, id);
  tracker.update(PRIVATE, 3);
  assert.equal(events.length, 5, 'same result count is deduplicated');
  tracker.update(`${PRIVATE} `, 0);
  time.tick(500);
  assert.notEqual(
    at(events, 5).properties.search_id,
    id,
    'spaces remain part of identity',
  );
  assert.equal(at(events, 6).event, 'search_zero_results_v2');
  tracker.update(PRIVATE.toUpperCase(), 1);
  time.tick(500);
  assert.notEqual(
    at(events, 7).properties.search_id,
    at(events, 5).properties.search_id,
  );
  tracker.update('', 0);
  time.tick(500);
  assert.equal(events.length, 8, 'clearing has no event');
  tracker.update('unfinished', 2);
  tracker.dispose();
  time.tick(1_000);
  tracker.click(0);
  tracker.update('disposed', 1);
  time.tick(1_000);
  assert.equal(events.length, 8);
  assert.ok(!JSON.stringify(events).includes('private'));
});

test('latest dynamic result count wins at settlement; failures never interrupt search', () => {
  const time = clock();
  const events: Array<Parameters<CaptureSearchEvent>> = [];
  const tracker = createSearchTracker({
    ...time,
    capture: (...args) => {
      events.push(args);
    },
  });
  tracker.update(PRIVATE, 0);
  time.tick(400);
  tracker.update(PRIVATE, 6);
  time.tick(100);
  assert.equal(events.length, 1);
  assert.equal(at(events, 0)[1].result_count, 6);
  tracker.click(-1);
  tracker.click(6);
  assert.equal(events.length, 1);
  const broken = createSearchTracker({
    ...time,
    capture: () => {
      throw new Error('offline');
    },
  });
  broken.update(PRIVATE, 1);
  assert.doesNotThrow(() => {
    time.tick(500);
  });
  assert.doesNotThrow(() => {
    broken.click(0);
  });
});

test('missing key, initialization failure and capture failure fail open', () => {
  let initialized = false;
  initAnalytics(
    {
      capture: () => {},
      init: () => {
        initialized = true;
      },
    },
    '',
  )('catalog_search_v2', {});
  assert.equal(initialized, false);
  const unavailable = {
    capture: () => {
      throw new Error('offline');
    },
    init: () => {
      throw new Error('unavailable');
    },
  };
  assert.doesNotThrow(() => {
    initAnalytics(unavailable, '')('catalog_search_v2', {});
  });
  assert.doesNotThrow(() => {
    initAnalytics(unavailable, key)('catalog_search_v2', {});
  });
  assert.doesNotThrow(() => {
    initAnalytics({ ...unavailable, init: () => {} }, key)(
      'catalog_search_v2',
      {},
    );
  });
});

test('build revision accepts only trusted full lowercase build SHAs', async () => {
  assert.equal(resolveBuildRevision({ CF_PAGES_COMMIT_SHA: sha }), sha);
  assert.equal(
    resolveBuildRevision({
      CF_PAGES_COMMIT_SHA: '',
      GITHUB_ACTIONS: 'true',
      GITHUB_SHA: sha,
    }),
    sha,
  );
  assert.equal(
    resolveBuildRevision({ GITHUB_ACTIONS: 'true', GITHUB_SHA: sha }),
    sha,
  );
  for (const env of [
    {},
    { GITHUB_SHA: sha },
    { VITE_APP_REVISION: sha },
    { CF_PAGES_COMMIT_SHA: sha.toUpperCase() },
    { CF_PAGES_COMMIT_SHA: 'abc' },
  ]) {
    assert.equal(resolveBuildRevision(env), undefined);
  }
  const source = readFileSync(
    new URL('../.vitepress/theme/analytics.ts', import.meta.url),
    'utf8',
  );
  for (const revision of [undefined, 'invalid', sha]) {
    // Emulate Vite's compile-time literal substitution, before module startup.
    const compiled = source.replaceAll('__APP_REVISION__', () =>
      revision === undefined ? 'undefined' : JSON.stringify(revision),
    );
    const module = (await import(
      `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(compiled)).toString('base64')}`
    )) as { analyticsConfig: typeof analyticsConfig };
    const clean = module.analyticsConfig(key).before_send({
      event: 'catalog_search_v2',
      properties: {
        analytics_schema_version: 999,
        app_revision: 'b'.repeat(40),
      },
    });
    assert.ok(clean);
    assert.equal(
      clean.properties['app_revision'],
      revision === sha ? sha : undefined,
    );
    assert.equal(clean.properties['analytics_schema_version'], 2);
  }
});

test('final allowlist reconstructs envelope and properties, validating safe scalars', () => {
  const clean = analyticsConfig(key).before_send({
    $set: { email: PRIVATE },
    $set_once: { query: encoded },
    event: 'catalog_search_v2',
    properties: {
      $set: { email: PRIVATE },
      $set_once: { query: encoded },
      app_revision: sha,
      distinct_id: PRIVATE,
      nested: { query: PRIVATE },
      position: 3,
      query: PRIVATE,
      result_count: -1,
      result_id: PRIVATE,
      search_id: PRIVATE,
      token: PRIVATE,
    },
    timestamp: PRIVATE,
    unknown: PRIVATE,
    uuid: PRIVATE,
  });
  assert.deepEqual(clean, {
    event: 'catalog_search_v2',
    properties: {
      $process_person_profile: false,
      analytics_schema_version: 2,
      service: 'recordings-listing',
      token: key,
    },
  });
  for (const event of [
    '$pageview',
    '$autocapture',
    '$exception',
    '$snapshot',
    '$web_vitals',
    '$identify',
    'catalog_search',
    'search_zero_results',
    'result_clicked',
  ]) {
    assert.equal(
      analyticsConfig(key).before_send({
        event,
        properties: { query: PRIVATE },
      }),
      null,
    );
  }
});

test('production before_send accepts valid UUIDs and sanitizes the envelope', () => {
  const { sdk } = sdkBrowser(true);
  initAnalytics(sdk, key);
  const beforeSend = sdk.config.before_send;
  assert.ok(typeof beforeSend === 'function');
  assert.deepEqual(
    beforeSend({
      event: 'catalog_search_v2',
      properties: { query: PRIVATE, result_count: 2, search_id: attempt },
      uuid: attempt,
    }),
    {
      event: 'catalog_search_v2',
      properties: {
        $process_person_profile: false,
        analytics_schema_version: 2,
        result_count: 2,
        search_id: attempt,
        service: 'recordings-listing',
        token: key,
      },
      uuid: attempt,
    },
  );
});

test('production before_send rejects missing and malformed UUIDs', () => {
  const { sdk } = sdkBrowser(true);
  initAnalytics(sdk, key);
  const beforeSend = sdk.config.before_send;
  assert.ok(typeof beforeSend === 'function');
  const envelope = {
    event: 'catalog_search_v2',
    properties: { result_count: 2, search_id: attempt },
    uuid: attempt,
  };
  // Simulate malformed SDK envelopes without weakening the callback's types.
  Reflect.deleteProperty(envelope, 'uuid');
  assert.equal(beforeSend(envelope), null, 'missing UUID is rejected');
  for (const uuid of ['', PRIVATE, 'not-a-uuid']) {
    Reflect.set(envelope, 'uuid', uuid);
    assert.equal(beforeSend(envelope), null, 'malformed UUID is rejected');
  }
});

test('production before_send rejects unknown events even with a valid UUID', () => {
  const { sdk } = sdkBrowser(true);
  initAnalytics(sdk, key);
  const beforeSend = sdk.config.before_send;
  assert.ok(typeof beforeSend === 'function');
  for (const event of ['$pageview', 'catalog_search', 'unknown_event']) {
    assert.equal(
      beforeSend({
        event,
        properties: { query: PRIVATE, result_count: 2, search_id: attempt },
        uuid: attempt,
      }),
      null,
    );
  }
});

test('installed SDK wire excludes private inputs, including persisted defaults and remote-enabled features', async () => {
  const { context, errors, listeners, requests, sdk, time } = sdkBrowser(true);
  let remoteConfigApplied = false;
  context._POSTHOG_REMOTE_CONFIG = {
    [key]: {
      config: {
        autocapture: { enabled: true },
        autocaptureExceptions: true,
        captureDeadClicks: true,
        captureHeatmaps: true,
        capturePerformance: true,
        logs: { captureConsoleLogs: true },
        productTours: [{ id: PRIVATE }],
        sessionRecording: { enabled: true },
        get supportedCompression() {
          remoteConfigApplied = true;
          return ['gzip-js'];
        },
        surveys: [{ id: PRIVATE }],
      },
    },
  };
  initAnalytics(sdk, key);
  assert.equal(
    remoteConfigApplied,
    true,
    'preloaded remote config was processed',
  );
  assert.deepEqual(
    errors,
    [],
    'remote configuration applies without SDK errors',
  );
  const capture = (event: string, properties: Record<string, unknown>) =>
    sdk.capture(event, properties);
  assert.equal(sdk.config.token, key, JSON.stringify(errors));
  assert.equal(
    requests.length,
    0,
    'initialization must not contact flags/config/replay',
  );
  sdk.register({
    $current_url: PRIVATE,
    $set: { email: PRIVATE },
    $set_once: { query: encoded },
    app_revision: sha,
    nested: { secret: encoded },
    query: PRIVATE,
  });
  capture('catalog_search_v2', {
    $set: { email: PRIVATE },
    $set_once: { query: encoded },
    query: PRIVATE,
    result_count: 2,
    result_id: encoded,
    search_id: attempt,
  });
  for (const event of [
    '$pageview',
    '$autocapture',
    '$exception',
    '$snapshot',
    '$web_vitals',
    '$identify',
    '$heatmaps',
    'catalog_search',
  ])
    sdk.capture(event, { query: PRIVATE });
  sdk.captureException(new Error(PRIVATE));
  sdk.captureLog({
    attributes: { query: encoded },
    body: PRIVATE,
    level: 'error',
  });
  sdk.metrics.count(PRIVATE, 1, { attributes: { query: encoded } });
  await sdk.metrics.flush();
  sdk.reloadFeatureFlags();
  capture('result_clicked_v2', {
    position: 1,
    result_count: 2,
    result_id: PRIVATE,
    search_id: attempt,
    search_pending: false,
  });
  capture('search_results_updated_v2', { result_count: 5, search_id: attempt });
  capture('search_zero_results_v2', { result_count: 0, search_id: attempt });
  time.tick(5_000);
  await Promise.resolve();
  await Promise.resolve();
  assert.notEqual(
    requests.length,
    0,
    `expected actual SDK transport: ${JSON.stringify(errors)}`,
  );
  const events: WireEvent[] = [];
  assert.ok(
    requests.some(
      ({ body }) =>
        body instanceof ArrayBuffer &&
        new Uint8Array(body)[0] === 31 &&
        new Uint8Array(body)[1] === 139,
    ),
    'decode a genuinely compressed SDK request',
  );
  for (const request of requests) {
    assert.match(request.url, posthogEndpointPattern);
    assert.ok(['beacon', 'fetch', 'xhr'].includes(request.transport));
    const payload = await decode(request);
    if (!Array.isArray(payload) && 'batch' in payload) {
      assert.deepEqual(Object.keys(payload).toSorted(collator.compare), [
        'api_key',
        'batch',
        'sent_at',
      ]);
      assert.equal(payload.api_key, key);
      assert.ok(hasValidTimestamp(payload.sent_at));
    }
    events.push(...wireEvents(payload));
    const wire = request.url + JSON.stringify(payload);
    for (const sentinel of [
      PRIVATE,
      encoded,
      'example.test',
      'utm_source',
      '$set',
      'result_id',
      'app_revision',
    ])
      assert.ok(!wire.includes(sentinel), `unexpected ${sentinel}`);
  }
  assert.deepEqual(
    events.map((e) => e.event),
    [
      'catalog_search_v2',
      'result_clicked_v2',
      'search_results_updated_v2',
      'search_zero_results_v2',
    ],
    JSON.stringify(events),
  );
  assert.deepEqual(
    events.map((event) => event.properties.result_count),
    [2, 2, 5, 0],
  );
  assert.equal(at(events, 1).properties.position, 1);
  assert.equal(at(events, 1).properties.search_pending, false);
  assert.equal('position' in at(events, 0).properties, false);
  assert.equal('search_pending' in at(events, 0).properties, false);
  for (const event of events) {
    assert.equal(event.properties.search_id, attempt);
    assert.equal(event.properties.token, key);
    assert.equal(event.properties.$process_person_profile, false);
    assert.equal(event.properties.analytics_schema_version, 2);
    assert.match(event.properties.distinct_id ?? '', uuidPattern);
    assert.deepEqual(
      Object.keys(event).filter(
        (k) =>
          !['event', 'offset', 'properties', 'timestamp', 'uuid'].includes(k),
      ),
      [],
    );
    assert.ok(
      hasValidTimestamp(event.timestamp ?? '') || Number.isFinite(event.offset),
    );
  }
  assert.equal(listeners.get('error')?.length ?? 0, 0);
  assert.equal(sdk.config.disable_session_recording, true);
  sdk.opt_out_capturing();
  const previous = requests.length;
  capture('catalog_search_v2', { result_count: 1, search_id: attempt });
  time.tick(5_000);
  assert.equal(requests.length, previous, 'opt-out is honored');
});

test('shipped bundle reaches transport, while an unsanitized control exposes sentinels', async () => {
  for (const sanitized of [false, true]) {
    const { requests, sdk, time } = sdkBrowser(true);
    if (sanitized) {
      initAnalytics(sdk, key);
    } else {
      const config = analyticsConfig(key);
      Reflect.deleteProperty(config, 'before_send');
      sdk.init(key, config);
    }
    sdk.capture('catalog_search_v2', {
      nested: { value: encoded },
      query: PRIVATE,
      result_count: 1,
      search_id: attempt,
    });
    time.tick(5_000);
    await Promise.resolve();
    assert.equal(requests.length, 1);
    const wire = JSON.stringify(await decode(at(requests, 0)));
    assert.equal(wire.includes(PRIVATE), !sanitized);
    assert.equal(wire.includes(encoded), !sanitized);
    assert.equal(
      wire.includes('example.test'),
      !sanitized,
      'SDK URL defaults pass through the sanitizer',
    );
    assert.ok(wire.includes('catalog_search_v2'));
  }
});

test('real SDK offline transport does not throw into search or navigation', async () => {
  const { requests, sdk, time } = sdkBrowser(true, true);
  const capture = initAnalytics(sdk, key);
  const tracker = createSearchTracker({ ...time, capture });
  tracker.update(PRIVATE, 1);
  assert.doesNotThrow(() => {
    time.tick(500);
  });
  assert.doesNotThrow(() => {
    tracker.click(0);
  });
  assert.doesNotThrow(() => {
    time.tick(5_000);
  });
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  assert.ok(
    requests.some((request) => request.transport === 'fetch'),
    'the rejecting fetch transport was exercised',
  );
  tracker.dispose();
});

const modalListeners = () => {
  const handlers = new Map<string, FixtureHandler>();
  return {
    addEventListener: (name: string, fn: FixtureHandler) =>
      handlers.set(name, fn),
    handlers,
    removeEventListener: (name: string) => handlers.delete(name),
  };
};
const replacementModal = (value: string) => {
  const input = { ...modalListeners(), value };
  const result = { closest: () => result, href: `/${encoded}` };
  const list = { getAttribute: () => 'false', querySelector: () => null };
  const box = {
    ...modalListeners(),
    querySelector: (selector: string) => {
      if (selector === 'input') return input;
      if (selector === 'ul.results') return list;
      return selector === '.result.selected' ? result : null;
    },
    querySelectorAll: (selector: string) =>
      selector === '.result' ? [result] : [],
  };
  return { box, input, result };
};

test('DOM observer preserves inputs/navigation and disposes listeners when modal is replaced', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let changed: () => void = uninitializedObserver;
  let activeBox: ReturnType<typeof replacementModal>['box'];
  const first = replacementModal(PRIVATE);
  activeBox = first.box;
  const events: Array<Parameters<CaptureSearchEvent>> = [];
  let disconnected = false;
  const dispose = attachSearchAnalytics(
    (...args) => {
      events.push(args);
    },
    domFixture<Document>({
      body: {},
      querySelector: (selector: string) =>
        selector === '.VPLocalSearchBox' ? activeBox : null,
    }),
    class {
      constructor(fn: () => void) {
        changed = fn;
      }
      disconnect = () => {
        disconnected = true;
      };
      observe = () => {};
    } as unknown as typeof MutationObserver,
  );
  t.mock.timers.tick(500);
  assert.equal(at(events, 0)[0], 'catalog_search_v2');
  get(
    first.box.handlers,
    'click',
  )({
    preventDefault: () => {
      assert.fail('navigation blocked');
    },
    target: first.result,
  });
  get(
    first.box.handlers,
    'keydown',
  )({
    key: 'Enter',
    preventDefault: () => {
      assert.fail('keyboard navigation blocked');
    },
    target: first.input,
  });
  get(first.box.handlers, 'keydown')({ key: 'Enter', target: first.result });
  assert.equal(
    events.length,
    3,
    'link activation is measured only by its click event',
  );
  assert.equal(at(events, 1)[1].position, 0);
  assert.equal(at(events, 2)[1].search_id, at(events, 0)[1].search_id);
  assert.equal(first.input.value, PRIVATE);
  assert.equal(first.result.href, `/${encoded}`);
  first.input.value = 'pending';
  get(first.input.handlers, 'input')();
  const second = replacementModal('');
  activeBox = second.box;
  changed();
  t.mock.timers.tick(500);
  assert.equal(events.length, 3, 'old pending edit was canceled');
  assert.equal(first.input.handlers.size, 0);
  assert.equal(first.box.handlers.size, 0);
  second.input.value = PRIVATE;
  get(second.input.handlers, 'input')();
  t.mock.timers.tick(500);
  assert.notEqual(at(events, 3)[1].search_id, at(events, 0)[1].search_id);
  dispose();
  assert.equal(disconnected, true);
  assert.equal(second.box.handlers.size, 0);
});

test('busy search waits beyond 500ms and settles nonempty on attribute-only readiness', async (t) => {
  const fixture = readinessFixture(t);
  const { dispose, events, first, mutate } = fixture;
  t.mock.timers.tick(800);
  assert.equal(
    events.length,
    0,
    'empty loading DOM is not a completed zero-result attempt',
  );
  first.state.count = 3;
  await mutate();
  assert.equal(
    events.length,
    0,
    'rendered results still await highlighting/search completion',
  );
  first.state.busy = false;
  await mutate('attributes', 'aria-busy');
  assert.deepEqual(
    events.map(({ event }) => event),
    ['catalog_search_v2'],
  );
  assert.equal(at(events, 0).properties.result_count, 3);
  assert.deepEqual(fixture.options.attributeFilter, ['aria-busy']);
  await mutate('attributes', 'class');
  await mutate('attributes', 'aria-busy');
  t.mock.timers.tick(1_000);
  assert.equal(
    events.length,
    1,
    'readiness and unrelated attributes do not inflate attempts',
  );
  dispose();
});

test('completed empty requires the no-results marker and emits exactly one zero', async (t) => {
  const { dispose, events, first, mutate } = readinessFixture(t);
  t.mock.timers.tick(800);
  first.state.busy = false;
  await mutate('attributes', 'aria-busy');
  assert.equal(
    events.length,
    0,
    'index-not-ready empty DOM lacks a completed-empty marker',
  );
  first.state.empty = true;
  await mutate();
  assert.deepEqual(
    events.map(({ event }) => event),
    ['catalog_search_v2', 'search_zero_results_v2'],
  );
  assert.equal(
    at(events, 0).properties.search_id,
    at(events, 1).properties.search_id,
  );
  await mutate('attributes', 'aria-busy');
  await mutate();
  t.mock.timers.tick(500);
  assert.equal(events.length, 2);
  dispose();
});

test('late readiness revalidates edited query and replacement modal quiet periods', async (t) => {
  const { dispose, events, first, modal, mutate, replace } =
    readinessFixture(t);
  t.mock.timers.tick(800);
  first.input.value = 'new query';
  get(first.handlers, 'input')();
  first.state.busy = false;
  first.state.count = 2;
  await mutate('attributes', 'aria-busy');
  t.mock.timers.tick(499);
  assert.equal(
    events.length,
    0,
    'old readiness cannot settle a new edit early',
  );
  const next = modal('replacement query');
  next.state.busy = false;
  next.state.count = 1;
  replace(next);
  await mutate();
  t.mock.timers.tick(1);
  assert.equal(events.length, 0, 'detached modal timer was canceled');
  t.mock.timers.tick(499);
  assert.equal(events.length, 1);
  assert.equal(at(events, 0).properties.result_count, 1);
  next.input.value = 'unfinished';
  get(next.handlers, 'input')();
  dispose();
  await mutate('attributes', 'aria-busy');
  t.mock.timers.tick(1_000);
  assert.equal(events.length, 1);
});

test('busy refinements keep clicks pending and restore canceled-edit linkage without false zeros', () => {
  const time = clock();
  const events: SearchEvent[] = [];
  const tracker = createSearchTracker({
    ...time,
    capture: (event, properties) => {
      events.push({ event, properties });
    },
  });
  tracker.update(PRIVATE, 2, true);
  time.tick(500);
  const id = at(events, 0).properties.search_id;
  tracker.update(PRIVATE, 0, false);
  time.tick(800);
  assert.equal(
    events.length,
    1,
    'busy count changes do not emit completed-result updates',
  );
  tracker.update('edit', 2, false);
  tracker.update(PRIVATE, 2, false);
  time.tick(500);
  tracker.click(0);
  assert.equal(at(events, 1).properties.search_pending, true);
  assert.equal(at(events, 1).properties.search_id, undefined);
  tracker.update(PRIVATE, 2, true);
  tracker.click(0);
  assert.equal(at(events, 2).properties.search_id, id);
  assert.equal(
    events.length,
    3,
    'restoring a settled query does not duplicate the intent',
  );
  tracker.dispose();
});

test('programmatic clear before settlement cancels cached query and stale click linkage', async (t) => {
  const { dispose, events, first, mutate } = readinessFixture(t);
  first.state.busy = false;
  first.state.count = 1;
  await mutate();
  t.mock.timers.tick(450);
  assert.equal(events.length, 0);

  // VitePress clearSearch() changes filterText/input.value without an input
  // event. Its debounced result DOM catches up later, at 650ms.
  first.input.value = '';
  t.mock.timers.tick(50);
  t.mock.timers.tick(150);
  first.state.count = 0;
  await mutate();
  get(first.boxHandlers, 'click')({ target: first.result });

  assert.deepEqual(
    events,
    [],
    'neither the cleared attempt nor a stale result click is attributed',
  );
  dispose();
});
