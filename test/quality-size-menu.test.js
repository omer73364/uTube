import test from 'node:test';
import assert from 'node:assert/strict';
import inquirer from '../apps/cli/functions/prompts.js';
import { askForQuality, qualityChoices } from '../apps/cli/functions/readInput.js';
import { qualitySizeLabel } from '../packages/core/file-size.js';
const items = [{ sizeEstimates: { video: { '360p': 1000000, '720p': 3000000, '1080p': 6000000, best: 6000000 } } }];

test('every CLI quality contains its size before any quality is selected', () => {
  const choices = qualityChoices(['360p', '720p', '1080p'], items);
  assert.deepEqual(choices.map(choice => choice.value), ['1080p', '720p', '360p']);
  for (const [index, size] of ['6 MB', '3 MB', '1 MB'].entries()) assert.ok(choices[index].name.includes(size));
  assert.match(choices[0].name, /Best available/);
});
test('the actual CLI quality prompt receives annotated choices and returns raw quality values', async t => {
  const descriptors = [process.stdin, process.stdout].map(stream => Object.getOwnPropertyDescriptor(stream, 'isTTY'));
  [process.stdin, process.stdout].forEach(stream => Object.defineProperty(stream, 'isTTY', { value: true, configurable: true }));
  const original = inquirer.prompt;
  t.after(() => {
    inquirer.prompt = original;
    [process.stdin, process.stdout].forEach((stream, i) => descriptors[i] ? Object.defineProperty(stream, 'isTTY', descriptors[i]) : delete stream.isTTY);
  });
  inquirer.prompt = async questions => {
    assert.match(questions[0].message, /estimated file size/);
    assert.match(questions[0].choices[0].name, /1080p.*6 MB/);
    assert.match(questions[0].choices[1].name, /360p.*1 MB/);
    return { quality: '360p' };
  };
  assert.equal(await askForQuality(['360p', '1080p'], items), '360p');
});
test('every quality distinguishes unavailable sizes from partial selected-video totals', () => {
  assert.match(qualityChoices(['360p'], [{}])[0].name, /Size unavailable/);
  assert.match(qualitySizeLabel([...items, {}], '720p'), /3 MB \+ \?/);
  assert.match(qualitySizeLabel(items, '720p', 'ar'), /MB/);
  assert.equal(qualitySizeLabel([], '720p'), '—');
});
