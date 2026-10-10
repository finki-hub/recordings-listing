import assert from 'node:assert/strict';
import test from 'node:test';
import { learnifyCoursePages, shouldShowLearnifyCallout } from '../.vitepress/theme/learnify-callout.js';

test('Learnify callout is opt-in per matching course path and normalizes separators', () => {
  assert.equal(learnifyCoursePages.size, 15);
  assert.equal(shouldShowLearnifyCallout('courses/semester-1/strukturno-programiranje.md'), true);
  assert.equal(shouldShowLearnifyCallout('\\courses\\semester-1\\strukturno-programiranje.md'), true);
  assert.equal(shouldShowLearnifyCallout('./courses/semester-1/strukturno-programiranje.md'), true);
  assert.equal(shouldShowLearnifyCallout('courses/semester-1/unmatched.md'), false);
  assert.equal(shouldShowLearnifyCallout('introduction.md'), false);
  assert.equal(shouldShowLearnifyCallout('courses/semester-1/strukturno-programiranje.md', false), false);
  assert.equal(shouldShowLearnifyCallout(undefined), false);
});
