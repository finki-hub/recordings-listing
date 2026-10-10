import test from 'node:test';
import assert from 'node:assert/strict';
import { needsFavoritesSidebarReconciliation } from '../.vitepress/theme/favorites-sidebar.js';

test('predicate requests reconciliation when a sidebar link is missing its favorite button', () => {
  assert.equal(needsFavoritesSidebarReconciliation([
    { href: '/courses/math', hasButton: false },
    { href: '/courses/physics', hasButton: true },
  ], true, true), true);
});

test('predicate does not request reconciliation for complete links with matching section state', () => {
  assert.equal(needsFavoritesSidebarReconciliation([
    { href: '/courses/math', hasButton: true },
  ], true, true), false);
});

test('predicate requests a favorites section when favorites exist but section does not', () => {
  assert.equal(needsFavoritesSidebarReconciliation([
    { href: '/courses/math', hasButton: true },
  ], true, false), true);
});

test('predicate requests removal of a stale favorites section when favorites are empty', () => {
  assert.equal(needsFavoritesSidebarReconciliation([
    { href: '/courses/math', hasButton: true },
  ], false, true), true);
});

test('predicate does not request reconciliation for no eligible sidebar links', () => {
  assert.equal(needsFavoritesSidebarReconciliation([], true, false), false);
});
