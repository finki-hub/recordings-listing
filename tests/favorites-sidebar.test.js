import test from 'node:test';
import assert from 'node:assert/strict';
import { needsFavoritesSidebarReconciliation } from '../.vitepress/theme/favorites-sidebar.js';

test('reconciles missing favorite buttons after the sidebar is replaced', () => {
  assert.equal(needsFavoritesSidebarReconciliation([
    { href: '/courses/math', hasButton: false },
    { href: '/courses/physics', hasButton: true },
  ], true, false), true);
});

test('does not reconcile an already complete sidebar or an empty one', () => {
  assert.equal(needsFavoritesSidebarReconciliation([
    { href: '/courses/math', hasButton: true },
  ], true, true), false);
  assert.equal(needsFavoritesSidebarReconciliation([], false, false), false);
});

test('removes a stale favorites section when no favorites remain', () => {
  assert.equal(needsFavoritesSidebarReconciliation([
    { href: '/courses/math', hasButton: true },
  ], false, true), true);
});
