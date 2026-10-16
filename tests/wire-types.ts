import type { SearchProperties } from '../.vitepress/theme/analytics.ts';

export type Transport = { compressed: boolean; url: string };
export type WireEvent = {
  event: string;
  offset?: number;
  properties: SearchProperties & {
    $process_person_profile?: boolean;
    [key: string]: unknown;
    analytics_schema_version?: number;
    app_revision?: string;
    distinct_id?: string;
    service?: string;
    token?: string;
  };
  timestamp?: string;
  uuid?: string;
};
export type WirePayload =
  | WireEvent
  | WireEvent[]
  | { api_key: string; batch: WireEvent[]; sent_at: string };
