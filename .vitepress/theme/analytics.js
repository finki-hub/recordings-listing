const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EVENTS = new Set(['catalog_search_v2', 'search_results_updated_v2', 'search_zero_results_v2', 'result_clicked_v2']);
const revision = typeof __APP_REVISION__ === 'undefined' ? undefined : __APP_REVISION__;

export function resolveBuildRevision(env) {
  const value = env.CF_PAGES_COMMIT_SHA || (env.GITHUB_ACTIONS === 'true' ? env.GITHUB_SHA : undefined);
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value) ? value : undefined;
}

// Reconstruct both levels: SDK defaults, persisted properties and caller-supplied
// nested objects must never become an accidental expansion of this contract.
export function analyticsConfig(key, host = 'https://eu.i.posthog.com') {
  return {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    capture_performance: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    logs: { captureConsoleLogs: false, beforeSend: () => null },
    metrics: { network: false, beforeSend: () => null },
    rageclick: false,
    person_profiles: 'never',
    disable_session_recording: true,
    disable_external_dependency_loading: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    advanced_disable_flags: true,
    advanced_disable_feature_flags: true,
    advanced_disable_toolbar_metrics: true,
    remote_config_refresh_interval_ms: 0,
    opt_in_site_apps: false,
    save_referrer: false,
    save_campaign_params: false,
    disable_capture_url_hashes: true,
    disable_scroll_properties: true,
    enable_recording_console_log: false,
    before_send(event) {
      if (!event || !EVENTS.has(event.event)) return null;
      const input = event.properties ?? {};
      const properties = { token: key, service: 'recordings-listing', analytics_schema_version: 2, $process_person_profile: false };
      for (const field of ['distinct_id', '$device_id', '$session_id', '$window_id', 'search_id']) {
        if (typeof input[field] === 'string' && UUID.test(input[field])) properties[field] = input[field];
      }
      for (const field of ['result_count', ...(event.event === 'result_clicked_v2' ? ['position'] : [])]) {
        if (Number.isSafeInteger(input[field]) && input[field] >= 0) properties[field] = input[field];
      }
      if (event.event === 'result_clicked_v2' && typeof input.search_pending === 'boolean') properties.search_pending = input.search_pending;
      if (typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision)) properties.app_revision = revision;
      const clean = { event: event.event, properties };
      if (typeof event.uuid === 'string' && UUID.test(event.uuid)) clean.uuid = event.uuid;
      if (event.timestamp instanceof Date && Number.isFinite(event.timestamp.getTime())) clean.timestamp = event.timestamp;
      return clean;
    },
  };
}

export function initAnalytics(sdk, key, host) {
  if (!key) return () => {};
  try {
    sdk.init(key, analyticsConfig(key, host));
    return (event, properties) => {
      try { sdk.capture(event, properties); } catch { /* Analytics must not interrupt navigation. */ }
    };
  } catch {
    return () => {};
  }
}
