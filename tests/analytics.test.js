import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, webcrypto } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { analyticsConfig, initAnalytics, resolveBuildRevision } from '../.vitepress/theme/analytics.js';
import { attachSearchAnalytics, createSearchTracker } from '../.vitepress/theme/search-analytics.js';

const PRIVATE = 'private student+name@example.test / Приватно';
const encoded = encodeURIComponent(PRIVATE);
const attempt = randomUUID();
const sha = 'a'.repeat(40);
const key = 'phc_offline_test_only';

function clock() {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  return {
    schedule(fn, delay) { tasks.set(++id, { fn, at: now + delay }); return id; },
    cancel(id) { tasks.delete(id); },
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
}

test('settled attempts: no keystroke inflation, exact identity, cancellation and click linkage', () => {
  const time = clock();
  const events = [];
  const tracker = createSearchTracker({ ...time, capture: (event, properties) => events.push({ event, properties }) });
  tracker.update('pri', 4);
  time.tick(499);
  assert.equal(events.length, 0);
  tracker.update(PRIVATE, 2);
  time.tick(499);
  tracker.click(1);
  assert.equal(events[0].properties.search_pending, true);
  assert.equal(events[0].properties.search_id, undefined);
  time.tick(1);
  const id = events[1].properties.search_id;
  assert.equal(events[1].event, 'catalog_search_v2');
  tracker.click(0);
  assert.equal(events[2].properties.search_id, id);
  tracker.update(PRIVATE + 'x', 2);
  time.tick(200);
  tracker.update(PRIVATE, 2);
  time.tick(500);
  assert.equal(events.length, 3, 'canceled edit does not create another intent');
  tracker.click(1);
  assert.equal(events[3].properties.search_id, id, 'quiet restoration relinks clicks');
  tracker.update(PRIVATE, 3);
  assert.equal(events[4].event, 'search_results_updated_v2');
  assert.equal(events[4].properties.search_id, id);
  tracker.update(PRIVATE, 3);
  assert.equal(events.length, 5, 'same result count is deduplicated');
  tracker.update(PRIVATE + ' ', 0);
  time.tick(500);
  assert.notEqual(events[5].properties.search_id, id, 'spaces remain part of identity');
  assert.equal(events[6].event, 'search_zero_results_v2');
  tracker.update(PRIVATE.toUpperCase(), 1);
  time.tick(500);
  assert.notEqual(events[7].properties.search_id, events[5].properties.search_id);
  tracker.update('', 0);
  time.tick(500);
  assert.equal(events.length, 8, 'clearing has no event');
  tracker.update('unfinished', 2);
  tracker.dispose();
  time.tick(1000);
  tracker.click(0);
  tracker.update('disposed', 1);
  time.tick(1000);
  assert.equal(events.length, 8);
  assert.ok(!JSON.stringify(events).includes('private'));
});

test('latest dynamic result count wins at settlement; failures never interrupt search', () => {
  const time = clock();
  const events = [];
  const tracker = createSearchTracker({ ...time, capture: (...args) => events.push(args) });
  tracker.update(PRIVATE, 0);
  time.tick(400);
  tracker.update(PRIVATE, 6);
  time.tick(100);
  assert.equal(events.length, 1);
  assert.equal(events[0][1].result_count, 6);
  tracker.click(-1);
  tracker.click(6);
  assert.equal(events.length, 1);
  const broken = createSearchTracker({ ...time, capture() { throw Error('offline'); } });
  broken.update(PRIVATE, 1);
  assert.doesNotThrow(() => time.tick(500));
  assert.doesNotThrow(() => broken.click(0));
});

test('missing key, initialization failure and capture failure fail open', () => {
  let initialized = false;
  initAnalytics({ init() { initialized = true; } }, '')('catalog_search_v2', {});
  assert.equal(initialized, false);
  const unavailable = { init() { throw Error('unavailable'); }, capture() { throw Error('offline'); } };
  assert.doesNotThrow(() => initAnalytics(unavailable, '')('catalog_search_v2', {}));
  assert.doesNotThrow(() => initAnalytics(unavailable, key)('catalog_search_v2', {}));
  assert.doesNotThrow(() => initAnalytics({ ...unavailable, init() {} }, key)('catalog_search_v2', {}));
});

test('build revision accepts only trusted full lowercase build SHAs', async () => {
  assert.equal(resolveBuildRevision({ CF_PAGES_COMMIT_SHA: sha }), sha);
  assert.equal(resolveBuildRevision({ GITHUB_ACTIONS: 'true', GITHUB_SHA: sha }), sha);
  for (const env of [{}, { GITHUB_SHA: sha }, { VITE_APP_REVISION: sha }, { CF_PAGES_COMMIT_SHA: sha.toUpperCase() }, { CF_PAGES_COMMIT_SHA: 'abc' }]) {
    assert.equal(resolveBuildRevision(env), undefined);
  }
  const source = readFileSync(new URL('../.vitepress/theme/analytics.js', import.meta.url), 'utf8');
  for (const revision of [undefined, 'invalid', sha]) {
    // Emulate Vite's compile-time literal substitution, before module startup.
    const compiled = source.replaceAll('__APP_REVISION__', JSON.stringify(revision) ?? 'undefined');
    const module = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
    const clean = module.analyticsConfig(key).before_send({ event: 'catalog_search_v2', properties: { app_revision: 'b'.repeat(40), analytics_schema_version: 999 } });
    assert.equal(clean.properties.app_revision, revision === sha ? sha : undefined);
    assert.equal(clean.properties.analytics_schema_version, 2);
  }
});

test('final allowlist reconstructs envelope and properties, validating safe scalars', () => {
  const clean = analyticsConfig(key).before_send({
    event: 'catalog_search_v2', uuid: PRIVATE, timestamp: PRIVATE, $set: { email: PRIVATE }, $set_once: { query: encoded }, unknown: PRIVATE,
    properties: { query: PRIVATE, result_id: PRIVATE, nested: { query: PRIVATE }, $set: { email: PRIVATE }, $set_once: { query: encoded }, result_count: -1, position: 3, search_id: PRIVATE, distinct_id: PRIVATE, app_revision: sha, token: PRIVATE },
  });
  assert.deepEqual(clean, { event: 'catalog_search_v2', properties: { token: key, service: 'recordings-listing', analytics_schema_version: 2, $process_person_profile: false } });
  for (const event of ['$pageview', '$autocapture', '$exception', '$snapshot', '$web_vitals', '$identify', 'catalog_search', 'search_zero_results', 'result_clicked']) {
    assert.equal(analyticsConfig(key).before_send({ event, properties: { query: PRIVATE } }), null);
  }
});

// This is a browser transport fixture, not an SDK mock. Execute the installed
// SDK in an isolated realm: every network surface terminates here. The installed
// CommonJS entrypoint retains private method names for remote-config testing;
// the shipped minified bundle is exercised separately against the same fixture.
function sdkBrowser(bundle = false, offline = false) {
  const requests = [];
  const errors = [];
  const time = clock();
  const storage = () => {
    const values = new Map();
    return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k) };
  };
  const location = new URL(`https://recordings.example.test/${encoded}?q=${encoded}&utm_source=${encoded}#${encoded}`);
  const listeners = new Map();
  const target = () => ({
    addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) ?? []), fn]); },
    removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) ?? []).filter((f) => f !== fn)); },
  });
  const element = (tag = 'div') => {
    let href;
    return {
      ...target(), tagName: tag.toUpperCase(), nodeType: 1, style: {}, children: [], childNodes: [], classList: { contains: () => false },
      get href() { return href?.href; }, set href(value) { href = new URL(value, location); },
      get hostname() { return href?.hostname; }, get protocol() { return href?.protocol; }, get host() { return href?.host; },
      get pathname() { return href?.pathname; }, get search() { return href?.search; }, get hash() { return href?.hash; },
      appendChild(child) { if (child.src || child.href) requests.push({ transport: 'element', url: child.src || child.href }); return child; },
      insertBefore(child) { return this.appendChild(child); }, removeChild() {},
      getAttribute() { return null; }, setAttribute() {}, querySelectorAll() { return []; }, querySelector() { return null; },
    };
  };
  const document = {
    ...target(), location, URL: location.href, referrer: `https://referrer.example.test/${encoded}`, title: PRIVATE,
    readyState: 'complete', visibilityState: 'visible', cookie: '', body: element('body'), head: element('head'), documentElement: element('html'),
    createElement: element, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
    getElementsByTagName: () => [], createEvent: () => ({ initEvent() {} }),
  };
  class XHR {
    withCredentials = false;
    open(method, url) { this.url = url; this.method = method; }
    setRequestHeader() {}
    send(body) { requests.push({ transport: 'xhr', url: this.url, body }); this.status = 200; this.readyState = 4; this.responseText = '{}'; this.onreadystatechange?.(); this.onload?.(); }
    abort() {}
  }
  const context = {
    ...target(), exports: {}, console: { log() {}, info() {}, warn() {}, error: (...args) => errors.push(args) },
    Date, URL, URLSearchParams, Blob, FormData, Request, Response, Headers, TextEncoder, TextDecoder, AbortController, atob, btoa, performance,
    Uint8Array, ArrayBuffer, crypto: webcrypto, document, location,
    navigator: { userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36', language: 'en', onLine: true, sendBeacon(url, body) { requests.push({ transport: 'beacon', url, body }); return true; } },
    localStorage: storage(), sessionStorage: storage(), screen: { width: 1200, height: 800 }, innerWidth: 1200, innerHeight: 800,
    setTimeout: time.schedule, clearTimeout: time.cancel, setInterval: time.schedule, clearInterval: time.cancel,
    XMLHttpRequest: XHR,
    fetch: async (url, options = {}) => { requests.push({ transport: 'fetch', url: String(url), body: options.body }); if (offline) throw new Error('offline'); return { status: 200, ok: true, text: async () => '{}', json: async () => ({}) }; },
    Image: class { set src(url) { requests.push({ transport: 'image', url }); } },
    WebSocket: class { constructor(url) { requests.push({ transport: 'websocket', url }); } },
    MutationObserver: class { observe() {} disconnect() {} },
    history: { pushState() {}, replaceState() {} },
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  if (bundle) {
    try {
      vm.runInContext(readFileSync(new URL('../node_modules/posthog-js/dist/main.js', import.meta.url), 'utf8'), context, { timeout: 10000 });
    } catch (error) { throw new Error(`SDK fixture startup: ${error.message}`); }
    return { sdk: context.exports.posthog, context, requests, errors, time, listeners };
  }
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    assert.ok(!filename.startsWith('node:') && filename.includes('node_modules'), 'SDK cannot access host builtins');
    const source = readFileSync(filename, 'utf8');
    if (filename.endsWith('.json')) return JSON.parse(source);
    const module = { exports: {} };
    cache.set(filename, module);
    const resolve = createRequire(filename).resolve;
    const fn = vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { timeout: 10000, filename });
    fn((name) => load(resolve(name)), module, module.exports);
    return module.exports;
  }
  const sdk = load(fileURLToPath(new URL('../node_modules/posthog-js/lib/src/entrypoints/main.cjs.js', import.meta.url))).posthog;
  return { sdk, context, requests, errors, time, listeners };
}

async function decode(request) {
  let body = request.body;
  if (body instanceof Blob) body = await body.arrayBuffer();
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    const bytes = Buffer.from(body instanceof ArrayBuffer ? body : body.buffer);
    body = bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes).toString() : bytes.toString();
  }
  if (typeof body === 'string' && body.startsWith('data=')) body = Buffer.from(new URLSearchParams(body).get('data'), 'base64').toString();
  return typeof body === 'string' ? JSON.parse(body) : body;
}

test('installed SDK wire excludes private inputs, including persisted defaults and remote-enabled features', async () => {
  const { sdk, requests, errors, time, listeners } = sdkBrowser();
  sdk.init(key, analyticsConfig(key));
  const capture = (event, properties) => sdk.capture(event, properties);
  assert.equal(sdk.config.token, key, JSON.stringify(errors));
  assert.equal(requests.length, 0, 'initialization must not contact flags/config/replay');
  sdk.register({ query: PRIVATE, nested: { secret: encoded }, $current_url: PRIVATE, $set: { email: PRIVATE }, $set_once: { query: encoded }, app_revision: sha });
  capture('catalog_search_v2', { search_id: attempt, result_count: 2, query: PRIVATE, result_id: encoded, $set: { email: PRIVATE }, $set_once: { query: encoded } });
  // Exercise the real SDK remote-config entrypoint; explicit local prohibitions
  // must still win if a cached/server configuration arrives.
  sdk._onRemoteConfig({ ok: true, config: {
    supportedCompression: ['gzip-js'], sessionRecording: { enabled: true }, autocapture: { enabled: true },
    capturePerformance: true, captureHeatmaps: true, captureDeadClicks: true,
    surveys: [{ id: PRIVATE }], productTours: [{ id: PRIVATE }],
    autocaptureExceptions: true, logs: { captureConsoleLogs: true },
  } });
  for (const event of ['$pageview', '$autocapture', '$exception', '$snapshot', '$web_vitals', '$identify', '$heatmaps', 'catalog_search']) sdk.capture(event, { query: PRIVATE });
  sdk.captureException(new Error(PRIVATE));
  sdk.captureLog({ body: PRIVATE, level: 'error', attributes: { query: encoded } });
  sdk.metrics.count(PRIVATE, 1, { query: encoded });
  await sdk.metrics.flush();
  sdk.reloadFeatureFlags();
  capture('result_clicked_v2', { search_id: attempt, result_count: 2, position: 1, search_pending: false, result_id: PRIVATE });
  time.tick(5000);
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(requests.length > 0, `expected actual SDK transport: ${JSON.stringify(errors)}`);
  const events = [];
  assert.ok(requests.some(({ body }) => body instanceof ArrayBuffer && new Uint8Array(body)[0] === 31 && new Uint8Array(body)[1] === 139), 'decode a genuinely compressed SDK request');
  for (const request of requests) {
    assert.match(request.url, /^https:\/\/eu\.i\.posthog\.com\/e\//);
    assert.ok(['fetch', 'xhr', 'beacon'].includes(request.transport));
    const payload = await decode(request);
    if (payload.batch) {
      assert.deepEqual(Object.keys(payload).sort(), ['api_key', 'batch', 'sent_at']);
      assert.equal(payload.api_key, key);
      assert.ok(Number.isFinite(new Date(payload.sent_at).getTime()));
    }
    events.push(...(payload.batch ?? (Array.isArray(payload) ? payload : [payload])));
    const wire = request.url + JSON.stringify(payload);
    for (const sentinel of [PRIVATE, encoded, 'example.test', 'utm_source', '$set', 'result_id', 'app_revision']) assert.ok(!wire.includes(sentinel), `unexpected ${sentinel}`);
  }
  assert.deepEqual(events.map((e) => e.event), ['catalog_search_v2', 'result_clicked_v2'], JSON.stringify(events));
  for (const event of events) {
    assert.equal(event.properties.search_id, attempt);
    assert.equal(event.properties.token, key);
    assert.equal(event.properties.$process_person_profile, false);
    assert.equal(event.properties.analytics_schema_version, 2);
    assert.match(event.properties.distinct_id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(Object.keys(event).filter((k) => !['event', 'properties', 'uuid', 'timestamp', 'offset'].includes(k)), []);
    assert.ok(Number.isFinite(new Date(event.timestamp).getTime()) || Number.isFinite(event.offset));
  }
  assert.equal(listeners.get('error')?.length ?? 0, 0);
  assert.equal(sdk.config.disable_session_recording, true);
  sdk.opt_out_capturing();
  const previous = requests.length;
  capture('catalog_search_v2', { search_id: attempt, result_count: 1 });
  time.tick(5000);
  assert.equal(requests.length, previous, 'opt-out is honored');
});

test('shipped bundle reaches transport, while an unsanitized control exposes sentinels', async () => {
  for (const sanitized of [false, true]) {
    const { sdk, requests, time } = sdkBrowser(true);
    const config = analyticsConfig(key);
    if (!sanitized) delete config.before_send;
    sdk.init(key, config);
    sdk.capture('catalog_search_v2', { search_id: attempt, result_count: 1, query: PRIVATE, nested: { value: encoded } });
    time.tick(5000);
    await Promise.resolve();
    assert.equal(requests.length, 1);
    const wire = JSON.stringify(await decode(requests[0]));
    assert.equal(wire.includes(PRIVATE), !sanitized);
    assert.equal(wire.includes(encoded), !sanitized);
    assert.equal(wire.includes('example.test'), !sanitized, 'SDK URL defaults pass through the sanitizer');
    assert.ok(wire.includes('catalog_search_v2'));
  }
});

test('real SDK offline transport does not throw into search or navigation', async () => {
  const { sdk, requests, time } = sdkBrowser(true, true);
  const capture = initAnalytics(sdk, key);
  const tracker = createSearchTracker({ ...time, capture });
  tracker.update(PRIVATE, 1);
  assert.doesNotThrow(() => time.tick(500));
  assert.doesNotThrow(() => tracker.click(0));
  assert.doesNotThrow(() => time.tick(5000));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(requests.some((request) => request.transport === 'fetch'), 'the rejecting fetch transport was exercised');
  tracker.dispose();
});

test('DOM observer preserves inputs/navigation and disposes listeners when modal is replaced', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let changed;
  let activeBox;
  const listeners = () => {
    const handlers = new Map();
    return { handlers, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  };
  function modal(value) {
    const input = { ...listeners(), value };
    const result = { href: `/${encoded}`, closest: () => result };
    const list = { getAttribute: () => 'false', querySelector: () => null };
    const box = { ...listeners(), querySelector: (selector) => selector === 'input' ? input : selector === 'ul.results' ? list : result, querySelectorAll: () => [result] };
    return { box, input, result };
  }
  const first = modal(PRIVATE);
  activeBox = first.box;
  const events = [];
  let disconnected = false;
  const dispose = attachSearchAnalytics((...args) => events.push(args), { body: {}, querySelector: () => activeBox }, class {
    constructor(fn) { changed = fn; } observe() {} disconnect() { disconnected = true; }
  });
  t.mock.timers.tick(500);
  assert.equal(events[0][0], 'catalog_search_v2');
  first.box.handlers.get('click')({ target: first.result, preventDefault() { assert.fail('navigation blocked'); } });
  first.box.handlers.get('keydown')({ key: 'Enter', target: first.input, preventDefault() { assert.fail('keyboard navigation blocked'); } });
  first.box.handlers.get('keydown')({ key: 'Enter', target: first.result });
  assert.equal(events.length, 3, 'link activation is measured only by its click event');
  assert.equal(events[1][1].position, 0);
  assert.equal(events[2][1].search_id, events[0][1].search_id);
  assert.equal(first.input.value, PRIVATE);
  assert.equal(first.result.href, `/${encoded}`);
  first.input.value = 'pending';
  first.input.handlers.get('input')();
  const second = modal('');
  activeBox = second.box;
  changed();
  t.mock.timers.tick(500);
  assert.equal(events.length, 3, 'old pending edit was canceled');
  assert.equal(first.input.handlers.size, 0);
  assert.equal(first.box.handlers.size, 0);
  second.input.value = PRIVATE;
  second.input.handlers.get('input')();
  t.mock.timers.tick(500);
  assert.notEqual(events[3][1].search_id, events[0][1].search_id);
  dispose();
  assert.equal(disconnected, true);
  assert.equal(second.box.handlers.size, 0);
});

function readinessFixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let callback;
  let options;
  let disconnected = false;
  let active;
  const events = [];
  const modal = (value) => {
    const handlers = new Map();
    const state = { busy: true, count: 0, empty: false };
    const input = { value, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
    // Installed VitePress: ul.results[aria-busy], with li.no-results only
    // when filterText && !results.length && enableNoResults.
    const list = { getAttribute: (name) => name === 'aria-busy' ? String(state.busy) : null, querySelector: (selector) => selector === '.no-results' && state.empty ? {} : null };
    const box = {
      querySelector: (selector) => selector === 'input' ? input : selector === 'ul.results' ? list : null,
      querySelectorAll: () => Array.from({ length: state.count }, () => ({})),
      addEventListener() {}, removeEventListener() {},
    };
    return { input, list, box, state, handlers };
  };
  const first = modal(PRIVATE);
  active = first;
  const dispose = attachSearchAnalytics((event, properties) => events.push({ event, properties }), { body: {}, querySelector: () => active?.box }, class {
    constructor(fn) { callback = fn; }
    observe(_target, config) { options = config; }
    disconnect() { disconnected = true; }
  });
  const mutate = async (type = 'childList', attributeName) => {
    // MutationObserver delivery is asynchronous and respects its actual filter.
    await Promise.resolve();
    if (!disconnected && (type === 'childList' ? options.childList : options.attributes && options.attributeFilter.includes(attributeName))) {
      callback([{ type, attributeName, target: active?.list }]);
    }
  };
  return { first, events, mutate, dispose, modal, replace(next) { active = next; }, get options() { return options; } };
}

test('busy search waits beyond 500ms and settles nonempty on attribute-only readiness', async (t) => {
  const fixture = readinessFixture(t);
  const { first, events, mutate, dispose } = fixture;
  t.mock.timers.tick(800);
  assert.equal(events.length, 0, 'empty loading DOM is not a completed zero-result attempt');
  first.state.count = 3;
  await mutate();
  assert.equal(events.length, 0, 'rendered results still await highlighting/search completion');
  first.state.busy = false;
  await mutate('attributes', 'aria-busy');
  assert.deepEqual(events.map(({ event }) => event), ['catalog_search_v2']);
  assert.equal(events[0].properties.result_count, 3);
  assert.deepEqual(fixture.options.attributeFilter, ['aria-busy']);
  await mutate('attributes', 'class');
  await mutate('attributes', 'aria-busy');
  t.mock.timers.tick(1000);
  assert.equal(events.length, 1, 'readiness and unrelated attributes do not inflate attempts');
  dispose();
});

test('completed empty requires the no-results marker and emits exactly one zero', async (t) => {
  const { first, events, mutate, dispose } = readinessFixture(t);
  t.mock.timers.tick(800);
  first.state.busy = false;
  await mutate('attributes', 'aria-busy');
  assert.equal(events.length, 0, 'index-not-ready empty DOM lacks a completed-empty marker');
  first.state.empty = true;
  await mutate();
  assert.deepEqual(events.map(({ event }) => event), ['catalog_search_v2', 'search_zero_results_v2']);
  assert.equal(events[0].properties.search_id, events[1].properties.search_id);
  await mutate('attributes', 'aria-busy');
  await mutate();
  t.mock.timers.tick(500);
  assert.equal(events.length, 2);
  dispose();
});

test('late readiness revalidates edited query and replacement modal quiet periods', async (t) => {
  const { first, events, mutate, dispose, modal, replace } = readinessFixture(t);
  t.mock.timers.tick(800);
  first.input.value = 'new query';
  first.handlers.get('input')();
  first.state.busy = false;
  first.state.count = 2;
  await mutate('attributes', 'aria-busy');
  t.mock.timers.tick(499);
  assert.equal(events.length, 0, 'old readiness cannot settle a new edit early');
  const next = modal('replacement query');
  next.state.busy = false;
  next.state.count = 1;
  replace(next);
  await mutate();
  t.mock.timers.tick(1);
  assert.equal(events.length, 0, 'detached modal timer was canceled');
  t.mock.timers.tick(499);
  assert.equal(events.length, 1);
  assert.equal(events[0].properties.result_count, 1);
  next.input.value = 'unfinished';
  next.handlers.get('input')();
  dispose();
  await mutate('attributes', 'aria-busy');
  t.mock.timers.tick(1000);
  assert.equal(events.length, 1);
});

test('busy refinements keep clicks pending and restore canceled-edit linkage without false zeros', () => {
  const time = clock();
  const events = [];
  const tracker = createSearchTracker({ ...time, capture: (event, properties) => events.push({ event, properties }) });
  tracker.update(PRIVATE, 2, true);
  time.tick(500);
  const id = events[0].properties.search_id;
  tracker.update(PRIVATE, 0, false);
  time.tick(800);
  assert.equal(events.length, 1, 'busy count changes do not emit completed-result updates');
  tracker.update('edit', 2, false);
  tracker.update(PRIVATE, 2, false);
  time.tick(500);
  tracker.click(0);
  assert.equal(events[1].properties.search_pending, true);
  assert.equal(events[1].properties.search_id, undefined);
  tracker.update(PRIVATE, 2, true);
  tracker.click(0);
  assert.equal(events[2].properties.search_id, id);
  assert.equal(events.length, 3, 'restoring a settled query does not duplicate the intent');
  tracker.dispose();
});
