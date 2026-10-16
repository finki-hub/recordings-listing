import assert from 'node:assert/strict';
import test from 'node:test';

import { needsFavoritesSidebarReconciliation } from '../.vitepress/theme/favorites-sidebar.ts';

test('predicate requests reconciliation when a sidebar link is missing its favorite button', () => {
  assert.equal(
    needsFavoritesSidebarReconciliation(
      [
        { hasButton: false, href: '/courses/math' },
        { hasButton: true, href: '/courses/physics' },
      ],
      true,
      true,
    ),
    true,
  );
});

test('predicate does not request reconciliation for complete links with matching section state', () => {
  assert.equal(
    needsFavoritesSidebarReconciliation(
      [{ hasButton: true, href: '/courses/math' }],
      true,
      true,
    ),
    false,
  );
});

test('predicate requests a favorites section when favorites exist but section does not', () => {
  assert.equal(
    needsFavoritesSidebarReconciliation(
      [{ hasButton: true, href: '/courses/math' }],
      true,
      false,
    ),
    true,
  );
});

test('predicate requests removal of a stale favorites section when favorites are empty', () => {
  assert.equal(
    needsFavoritesSidebarReconciliation(
      [{ hasButton: true, href: '/courses/math' }],
      false,
      true,
    ),
    true,
  );
});

test('predicate does not request reconciliation for no eligible sidebar links', () => {
  assert.equal(needsFavoritesSidebarReconciliation([], true, false), false);
});
