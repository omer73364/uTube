import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressFilter } from '../packages/core/progress.js';

test('a fallback keeps the existing bar until both bytes and percentage catch up', () => {
  const show = createProgressFilter();
  assert.equal(show({ type: 'stage', stage: 'video', total: 100 }), true);
  assert.equal(show({ type: 'progress', loaded: 60, total: 100 }), true);
  show({ type: 'retry' });
  assert.equal(show({ type: 'stage', stage: 'video', total: 200 }), false);
  assert.equal(show({ type: 'progress', loaded: 20, total: 200 }), false);
  assert.equal(show({ type: 'progress', loaded: 80, total: 200 }), false);
  assert.equal(show({ type: 'progress', loaded: 140, total: 200 }), true);
  assert.equal(show({ type: 'progress', loaded: 200, total: 200 }), true);
});

test('retrying video after audio has begun does not rewind to the video stage', () => {
  const show = createProgressFilter();
  show({ type: 'stage', stage: 'video' });
  show({ type: 'stage', stage: 'audio' });
  show({ type: 'progress', loaded: 60, total: 100 });
  show({ type: 'retry' });
  assert.equal(show({ type: 'stage', stage: 'video' }), false);
  assert.equal(show({ type: 'progress', loaded: 1000, total: 1000 }), false);
  assert.equal(show({ type: 'stage', stage: 'audio' }), false);
  assert.equal(show({ type: 'progress', loaded: 20, total: 100 }), false);
  assert.equal(show({ type: 'progress', loaded: 80, total: 100 }), true);
  assert.equal(show({ type: 'stage', stage: 'merging' }), true);
  assert.equal(show({ type: 'saved' }), true);
});

test('unknown sizes hold their byte count and manual retries start fresh', () => {
  const show = createProgressFilter();
  show({ type: 'stage', stage: 'audio' });
  show({ type: 'progress', loaded: 50 });
  show({ type: 'retry' });
  assert.equal(show({ type: 'stage', stage: 'audio' }), false);
  assert.equal(show({ type: 'progress', loaded: 10 }), false);
  assert.equal(show({ type: 'progress', loaded: 70 }), true);
  const manual = createProgressFilter();
  assert.equal(manual({ type: 'stage', stage: 'audio' }), true);
  assert.equal(manual({ type: 'progress', loaded: 10 }), true);
});
