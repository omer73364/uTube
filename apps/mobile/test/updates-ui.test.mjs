import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { updateCopy } from '../../../packages/core/update-copy.js';
const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = fs.readFileSync(new URL('../src/ui/Updates.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const themeSource = fs.readFileSync(new URL('../src/ui/theme.ts', import.meta.url), 'utf8');
const themeModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(themeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: themeModule.exports });
function screen(language, colors, jobs, parentActive) {
  let hook = 0, alert;
  const native = { Alert: { alert: (...args) => { alert = args; } }, AppState: {}, StyleSheet: { create: x => x }, View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator' };
  const state = { phase: 'ready', loaded: 1, total: 1, services: [], statusVerified: true, release: { version: '2.5.1', notes: { en: 'Fixes', ar: 'إصلاحات' } } };
  const module = { exports: {} };
  const mocks = { react: { ...React, useEffect: () => {}, useState: () => [hook++ === 0 ? state : undefined, () => {}] }, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native, '../native': { downloads: { list: async () => jobs } }, '../../../../packages/core/update-copy.js': { updateCopy }, './Icon': { Icon: 'Icon' } };
  vm.runInNewContext(code, { exports: module.exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  const tree = module.exports.default({ language, full: true, colors, hasCurrentDownload: parentActive, placement: 'settings' });
  const nodes = [];
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; nodes.push(node); visit(node.props.children); }
  visit(tree);
  const button = nodes.find(node => node.type === 'Pressable' && node.props.children.some(child => child?.type === 'Text' && child.props.children === updateCopy[language].install));
  assert.ok(button);
  return { tree, nodes, async open() { button.props.onPress(); await new Promise(setImmediate); return alert[2]; } };
}
for (const language of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  test(`mobile updater follows ${theme} theme and uses current download state (${language})`, async () => {
    const colors = themeModule.exports[theme];
    const idle = screen(language, colors, [{status:'queued'}], true);
    const choices = await idle.open();
    assert.deepEqual(Array.from(choices, x => x.text), [updateCopy[language].later, updateCopy[language].install]);
    assert.ok(idle.nodes.some(node => Array.isArray(node.props.style) && node.props.style.some(style => style?.backgroundColor === colors.surface && style.borderColor === colors.line)));
    assert.equal(idle.tree.props.style.direction, language === 'ar' ? 'rtl' : 'ltr');
    const running = screen(language, colors, [{status:'running'}], false);
    assert.ok((await running.open()).some(choice => choice.text === updateCopy[language].interrupt));
  });
}
