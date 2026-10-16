import assert from 'node:assert/strict';

import type { WireEvent, WirePayload } from './wire-types.ts';

export const at = <Value>(values: readonly Value[], index: number): Value => {
  const value = values[index];
  assert.ok(value !== undefined, `Expected an item at index ${index}`);
  return value;
};
export const get = <Key, Value>(
  values: ReadonlyMap<Key, Value>,
  key: Key,
): Value => {
  const value = values.get(key);
  assert.ok(value !== undefined, `Expected a map entry for ${String(key)}`);
  return value;
};

// These unit fixtures model only the DOM surface exercised by each test.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- The caller supplies the DOM type modeled by a partial unit fixture.
export const domFixture = <ElementType>(value: object): ElementType =>
  value as ElementType;

export const required = <Value>(value: null | undefined | Value): Value => {
  assert.ok(value !== undefined && value !== null);
  return value;
};

export const wireEvents = (payload: WirePayload): WireEvent[] => {
  if (Array.isArray(payload)) return payload;
  return 'batch' in payload ? payload.batch : [payload];
};
