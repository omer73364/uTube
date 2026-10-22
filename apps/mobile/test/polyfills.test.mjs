import test from "node:test";
import assert from "node:assert/strict";
import { parseModule } from "meriyah";

const original = globalThis.structuredClone;
test.after(() => {
  globalThis.structuredClone = original;
});

test("player parser works when the runtime has no structuredClone", async () => {
  delete globalThis.structuredClone;
  const source =
    'import {item} from "example"; const object = {item}; export {item};';
  assert.throws(() => parseModule(source), /structuredClone/);
  await import("../src/polyfills.js");
  const ast = parseModule(source);
  assert.equal(ast.body[0].specifiers[0].local.name, "item");
  assert.notEqual(
    ast.body[0].specifiers[0].local,
    ast.body[0].specifiers[0].imported,
  );
  assert.equal(
    ast.body[1].declarations[0].init.properties[0].value.name,
    "item",
  );
  assert.equal(ast.body[2].specifiers[0].exported.name, "item");
});

test("clone preserves values a JSON round trip would corrupt", () => {
  const source = {
    missing: undefined,
    pattern: /player/gi,
    bytes: new Uint8Array([1, 2]),
    large: 42n,
  };
  source.self = source;
  const copy = globalThis.structuredClone(source);
  assert.equal(copy.self, copy);
  assert.ok(Object.hasOwn(copy, "missing"));
  assert.equal(copy.pattern.source, "player");
  assert.equal(copy.pattern.flags, "gi");
  assert.deepEqual(copy.bytes, source.bytes);
  assert.notEqual(copy.bytes.buffer, source.bytes.buffer);
  assert.equal(copy.large, 42n);
  assert.throws(() => globalThis.structuredClone({ fn() {} }));
});

test("startup preserves an existing native structuredClone", async () => {
  const native = (value) => value;
  globalThis.structuredClone = native;
  await import("../src/polyfills.js?native");
  assert.equal(globalThis.structuredClone, native);
});
