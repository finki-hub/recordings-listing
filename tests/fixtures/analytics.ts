import type { TestContext } from 'node:test';
import type { PostHog } from 'posthog-js';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';

import type {
  SearchEventName,
  SearchProperties,
} from '../../.vitepress/theme/analytics.ts';
import type { WirePayload } from '../wire-types.ts';

import { attachSearchAnalytics } from '../../.vitepress/theme/search-analytics.ts';
import { domFixture } from '../helpers.ts';

export type FixtureEvent = {
  key?: string;
  preventDefault?: () => void;
  target?: unknown;
};

export type FixtureHandler = (event?: FixtureEvent) => void;

export type FixtureSdk = Pick<
  PostHog,
  | 'capture'
  | 'captureException'
  | 'captureLog'
  | 'config'
  | 'metrics'
  | 'opt_out_capturing'
  | 'register'
  | 'reloadFeatureFlags'
> & { init: (key: string, config: unknown) => void };

export type SearchEvent = {
  event: SearchEventName;
  properties: SearchProperties;
};

export type WireRequest = { body?: unknown; transport: string; url: string };

export const PRIVATE = 'private student+name@example.test / Приватно';

export const encoded = encodeURIComponent(PRIVATE);

export const attempt = randomUUID();

export const sha = 'a'.repeat(40);

export const key = 'phc_offline_test_only';

export const clock = () => {
  let now = 0;
  let taskId = 0;
  const tasks = new Map<number, { at: number; fn: () => void }>();
  return {
    cancel: (id: number | ReturnType<typeof setTimeout> | undefined) => {
      if (typeof id === 'number') tasks.delete(id);
    },
    schedule: (fn: () => void, delay: number) => {
      taskId += 1;
      tasks.set(taskId, { at: now + delay, fn });
      return taskId;
    },
    tick: (ms: number) => {
      const end = now + ms;
      for (;;) {
        const next = [...tasks]
          .filter(([, task]) => task.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
};

export const decode = async (request: WireRequest): Promise<WirePayload> => {
  let body = request.body;
  if (body instanceof Blob) body = await body.arrayBuffer();
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    const bytes = Buffer.from(body instanceof ArrayBuffer ? body : body.buffer);
    body =
      bytes[0] === 31 && bytes[1] === 139
        ? gunzipSync(bytes).toString()
        : bytes.toString();
  }
  if (typeof body === 'string' && body.startsWith('data='))
    body = Buffer.from(
      new URLSearchParams(body).get('data') ?? '',
      'base64',
    ).toString();
  return (typeof body === 'string' ? JSON.parse(body) : body) as WirePayload;
};

// eslint-disable-next-line max-lines-per-function -- Keep the isolated SDK browser adapter together so every transport stays stubbed.
export const sdkBrowser = (bundle = false, offline = false) => {
  const requests: WireRequest[] = [];
  const errors: unknown[][] = [];
  const time = clock();
  const storage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (k: string) => values.get(k) ?? null,
      removeItem: (k: string) => values.delete(k),
      setItem: (k: string, v: unknown) => values.set(k, String(v)),
    };
  };
  const location = new URL(
    `https://recordings.example.test/${encoded}?q=${encoded}&utm_source=${encoded}#${encoded}`,
  );
  const listeners = new Map<string, Array<() => void>>();
  const target = () => ({
    addEventListener: (name: string, fn: () => void) => {
      listeners.set(name, [...(listeners.get(name) ?? []), fn]);
    },
    removeEventListener: (name: string, fn: () => void) => {
      listeners.set(
        name,
        (listeners.get(name) ?? []).filter((f) => f !== fn),
      );
    },
  });
  const element = (tag = 'div') => {
    let href: undefined | URL;
    const node = {
      ...target(),
      appendChild: (child: { href?: string; src?: string }) => {
        if (child.src || child.href)
          requests.push({
            transport: 'element',
            url: child.src ?? child.href ?? '',
          });
        return child;
      },
      childNodes: [],
      children: [],
      classList: { contains: () => false },
      getAttribute: () => null,
      get hash() {
        return href?.hash;
      },
      get host() {
        return href?.host;
      },
      get hostname() {
        return href?.hostname;
      },
      get href() {
        return href?.href;
      },
      set href(value: string | undefined) {
        const resolved = typeof value === 'string' ? value : '';
        href = new URL(resolved, location);
      },
      insertBefore(child: { href?: string; src?: string }) {
        // eslint-disable-next-line unicorn/prefer-dom-node-append -- Node.insertBefore returns the inserted node in the SDK fixture.
        return node.appendChild(child);
      },
      nodeType: 1,
      get pathname() {
        return href?.pathname;
      },
      get protocol() {
        return href?.protocol;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      removeChild: () => {},
      get search() {
        return href?.search;
      },
      setAttribute: () => {},
      style: {},
      tagName: tag.toUpperCase(),
    };
    return node;
  };
  const document = {
    ...target(),
    body: element('body'),
    cookie: '',
    createElement: element,
    createEvent: () => ({ initEvent: () => {} }),
    documentElement: element('html'),
    getElementById: () => null,
    getElementsByTagName: () => [],
    head: element('head'),
    location,
    querySelector: () => null,
    querySelectorAll: () => [],
    readyState: 'complete',
    referrer: `https://referrer.example.test/${encoded}`,
    title: PRIVATE,
    URL: location.href,
    visibilityState: 'visible',
  };
  class XHR {
    method = '';
    onload?: () => void;
    onreadystatechange?: () => void;
    readyState = 0;
    responseText = '';
    status = 0;
    url = '';
    withCredentials = false;
    abort = () => {};
    open(method: string, url: string) {
      this.url = url;
      this.method = method;
    }
    send(body: unknown) {
      requests.push({ body, transport: 'xhr', url: this.url });
      this.status = 200;
      this.readyState = 4;
      this.responseText = '{}';
      this.onreadystatechange?.();
      this.onload?.();
    }
    setRequestHeader = () => {};
  }
  const context = {
    _POSTHOG_REMOTE_CONFIG: undefined as unknown,
    self: undefined as unknown,
    window: undefined as unknown,
    ...target(),
    AbortController,
    ArrayBuffer,
    atob,
    Blob,
    btoa,
    clearInterval: time.cancel,
    clearTimeout: time.cancel,
    console: {
      error: (...args: unknown[]) => {
        errors.push(args);
      },
      info: () => {},
      log: () => {},
      warn: () => {},
    },
    crypto,
    Date,
    document,
    exports: {} as { posthog: FixtureSdk },
    fetch: (url: string | URL, options: RequestInit = {}) => {
      requests.push({
        body: options.body,
        transport: 'fetch',
        url: String(url),
      });
      if (offline) return Promise.reject(new Error('offline'));
      return Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      });
    },
    FormData,
    Headers,
    history: { pushState: () => {}, replaceState: () => {} },
    Image: class {
      get src() {
        return this.#source;
      }
      set src(url: string) {
        this.#source = url;
        requests.push({ transport: 'image', url });
      }
      #source = '';
    },
    innerHeight: 800,
    innerWidth: 1_200,
    localStorage: storage(),
    location,
    MutationObserver: class {
      disconnect = () => {};
      observe = () => {};
    },
    navigator: {
      language: 'en',
      onLine: true,
      sendBeacon: (url: string, body: unknown) => {
        requests.push({ body, transport: 'beacon', url });
        return true;
      },
      userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36',
    },
    performance,
    Request,
    Response,
    screen: { height: 800, width: 1_200 },
    sessionStorage: storage(),
    setInterval: time.schedule,
    setTimeout: time.schedule,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    URL,
    URLSearchParams,
    WebSocket: class {
      constructor(url: string) {
        requests.push({ transport: 'websocket', url });
      }
    },
    XMLHttpRequest: XHR,
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  if (bundle) {
    try {
      vm.runInContext(
        readFileSync(
          new URL(
            '../../node_modules/posthog-js/dist/main.js',
            import.meta.url,
          ),
          'utf8',
        ),
        context,
        { timeout: 10_000 },
      );
    } catch (error) {
      throw new Error(`SDK fixture startup: ${String(error)}`, {
        cause: error,
      });
    }
    return {
      context,
      errors,
      listeners,
      requests,
      sdk: context.exports.posthog,
      time,
    };
  }
  const cache = new Map<string, { exports: unknown }>();
  const load = (filename: string): unknown => {
    const cached = cache.get(filename);
    if (cached) return cached.exports;
    assert.ok(!filename.startsWith('node:'), 'SDK cannot access host builtins');
    assert.ok(
      filename.includes('node_modules'),
      'SDK loads only installed packages',
    );
    const source = readFileSync(filename, 'utf8');
    if (filename.endsWith('.json')) return JSON.parse(source);
    const module: { exports: unknown } = { exports: {} };
    cache.set(filename, module);
    const resolve = createRequire(filename).resolve;
    const fn = vm.runInContext(
      `(function(require, module, exports) {${source}\n})`,
      context,
      { filename, timeout: 10_000 },
    ) as (
      require: (name: string) => unknown,
      module: { exports: unknown },
      exports: unknown,
    ) => void;
    fn((name: string) => load(resolve(name)), module, module.exports);
    return module.exports;
  };
  const loaded = load(
    fileURLToPath(
      new URL(
        '../../node_modules/posthog-js/lib/src/entrypoints/main.cjs.js',
        import.meta.url,
      ),
    ),
  ) as { posthog: FixtureSdk };
  const sdk = loaded.posthog;
  return { context, errors, listeners, requests, sdk, time };
};

const readinessModal = (value: string) => {
  const handlers = new Map<string, FixtureHandler>();
  const boxHandlers = new Map<string, FixtureHandler>();
  const state = { busy: true, count: 0, empty: false };
  const input = {
    addEventListener: (name: string, fn: FixtureHandler) =>
      handlers.set(name, fn),
    removeEventListener: (name: string) => handlers.delete(name),
    value,
  };
  const result = { closest: () => result };
  // Installed VitePress: ul.results[aria-busy], with li.no-results only
  // when filterText && !results.length && enableNoResults.
  const list = {
    getAttribute: (name: string) =>
      name === 'aria-busy' ? String(state.busy) : null,
    querySelector: (selector: string) =>
      selector === '.no-results' && state.empty ? {} : null,
  };
  const box = {
    addEventListener: (name: string, fn: FixtureHandler) =>
      boxHandlers.set(name, fn),
    querySelector: (selector: string) => {
      if (selector === 'input') return input;
      return selector === 'ul.results' ? list : null;
    },
    querySelectorAll: (selector: string) => {
      const matches: Array<typeof result> = [];
      if (selector !== '.result') return matches;
      while (matches.length < state.count) matches.push(result);
      return matches;
    },
    removeEventListener: (name: string) => boxHandlers.delete(name),
  };
  return { box, boxHandlers, handlers, input, list, result, state };
};

export const uninitializedObserver = (records: unknown[] = []): void => {
  throw new Error(`Observer was not initialized (${records.length} records)`);
};
export const readinessFixture = (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let deliverRecords: (records: unknown[]) => void = uninitializedObserver;
  let options: MutationObserverInit = {};
  let disconnected = false;
  let active: ReturnType<typeof readinessModal> | undefined;
  const events: SearchEvent[] = [];
  const first = readinessModal(PRIVATE);
  active = first;
  const dispose = attachSearchAnalytics(
    (event, properties) => {
      events.push({ event, properties });
    },
    domFixture<Document>({
      body: {},
      querySelector: (selector: string) =>
        selector === '.VPLocalSearchBox' ? active?.box : null,
    }),
    class {
      constructor(fn: (records: unknown[]) => void) {
        deliverRecords = fn;
      }
      disconnect = () => {
        disconnected = true;
      };
      observe = (_target: unknown, config: MutationObserverInit) => {
        options = config;
      };
    } as unknown as typeof MutationObserver,
  );
  const mutate = async (type = 'childList', attributeName?: string) => {
    // MutationObserver delivery is asynchronous and respects its actual filter.
    await Promise.resolve();
    if (
      !disconnected &&
      (type === 'childList'
        ? options.childList
        : options.attributes &&
          attributeName !== undefined &&
          options.attributeFilter?.includes(attributeName))
    ) {
      deliverRecords([{ attributeName, target: active?.list, type }]);
    }
  };
  return {
    dispose,
    events,
    first,
    modal: readinessModal,
    mutate,
    get options() {
      return options;
    },
    replace: (next: ReturnType<typeof readinessModal>) => {
      active = next;
    },
  };
};
