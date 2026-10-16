import type { CaptureResult, PostHogConfig } from 'posthog-js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const buildRevisionPattern = /^[0-9a-f]{40}$/u;

const UUID = uuidPattern;
const EVENTS = new Set([
  'catalog_search_v2',
  'result_clicked_v2',
  'search_results_updated_v2',
  'search_zero_results_v2',
]);
const revision =
  typeof __APP_REVISION__ === 'undefined' ? undefined : __APP_REVISION__;

export type CaptureSearchEvent = (
  event: SearchEventName,
  properties: SearchProperties,
) => void;

export type SearchEventName =
  | 'catalog_search_v2'
  | 'result_clicked_v2'
  | 'search_results_updated_v2'
  | 'search_zero_results_v2';

export type SearchProperties = {
  position?: number;
  result_count?: number;
  search_id?: string;
  search_pending?: boolean;
};

type AnalyticsInput = {
  [key: string]: unknown;
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: unknown;
  uuid?: unknown;
};
type AnalyticsSdk = {
  capture: (event: string, properties: SearchProperties) => unknown;
  init: (key: string, config: Partial<PostHogConfig>) => unknown;
};
const copyIdentifiers = (
  input: Record<string, unknown>,
  properties: Record<string, unknown>,
) => {
  for (const field of [
    'distinct_id',
    '$device_id',
    '$session_id',
    '$window_id',
    'search_id',
  ]) {
    if (typeof input[field] === 'string' && UUID.test(input[field]))
      properties[field] = input[field];
  }
};

const ignoreCapture: CaptureSearchEvent = () => {};

// Reconstruct both levels: SDK defaults, persisted properties and caller-supplied
// nested objects must never become an accidental expansion of this contract.
export const analyticsConfig = (
  key: string,
  host = 'https://eu.i.posthog.com',
) => ({
  advanced_disable_feature_flags: true,
  advanced_disable_flags: true,
  advanced_disable_toolbar_metrics: true,
  api_host: host,
  autocapture: false,
  before_send(event: AnalyticsInput | null) {
    if (!event || !EVENTS.has(event.event)) return null;
    const input = event.properties ?? {};
    const properties: Record<string, unknown> = {
      $process_person_profile: false,
      analytics_schema_version: 2,
      service: 'recordings-listing',
      token: key,
    };
    copyIdentifiers(input, properties);
    for (const field of [
      'result_count',
      ...(event.event === 'result_clicked_v2' ? ['position'] : []),
    ]) {
      const value = input[field];
      if (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
      )
        properties[field] = value;
    }
    if (
      event.event === 'result_clicked_v2' &&
      typeof input['search_pending'] === 'boolean'
    )
      properties['search_pending'] = input['search_pending'];
    if (typeof revision === 'string' && buildRevisionPattern.test(revision))
      properties['app_revision'] = revision;
    const clean: {
      event: string;
      properties: Record<string, unknown>;
      timestamp?: Date;
      uuid?: string;
    } = { event: event.event, properties };
    if (typeof event.uuid === 'string' && UUID.test(event.uuid))
      clean.uuid = event.uuid;
    if (
      event.timestamp instanceof Date &&
      Number.isFinite(event.timestamp.getTime())
    )
      clean.timestamp = event.timestamp;
    return clean;
  },
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_heatmaps: false,
  capture_pageleave: false,
  capture_pageview: false,
  capture_performance: false,
  disable_capture_url_hashes: true,
  disable_conversations: true,
  disable_external_dependency_loading: true,
  disable_product_tours: true,
  disable_scroll_properties: true,
  disable_session_recording: true,
  disable_surveys: true,
  disable_web_experiments: true,
  enable_recording_console_log: false,
  logs: { beforeSend: () => null, captureConsoleLogs: false },
  metrics: { beforeSend: () => null, network: false },
  opt_in_site_apps: false,
  person_profiles: 'never' as const,
  rageclick: false,
  remote_config_refresh_interval_ms: 0,
  save_campaign_params: false,
  save_referrer: false,
});
export const initAnalytics = (
  sdk: AnalyticsSdk,
  key: string,
  host?: string,
): CaptureSearchEvent => {
  if (!key) return ignoreCapture;
  try {
    const config = analyticsConfig(key, host);
    sdk.init(key, {
      ...config,
      before_send(event) {
        const clean = config.before_send({ ...event });
        // The SDK supplies a generated UUID. Discard malformed envelopes rather
        // than returning a value that violates its required UUID contract.
        return clean?.uuid
          ? ({ ...clean, uuid: clean.uuid } satisfies CaptureResult)
          : null;
      },
    });
    return (event, properties) => {
      try {
        sdk.capture(event, properties);
      } catch {
        /* Analytics must not interrupt navigation. */
      }
    };
  } catch {
    return ignoreCapture;
  }
};
export const resolveBuildRevision = (
  env: Record<string, string | undefined>,
) => {
  const pagesRevision = env['CF_PAGES_COMMIT_SHA'];
  const githubRevision =
    env['GITHUB_ACTIONS'] === 'true' ? env['GITHUB_SHA'] : undefined;
  const value =
    typeof pagesRevision === 'string' && pagesRevision.length > 0
      ? pagesRevision
      : githubRevision;
  return typeof value === 'string' && buildRevisionPattern.test(value)
    ? value
    : undefined;
};
