import structuredClone from "@ungap/structured-clone";

// Hermes lacks this web API, which Meriyah uses while parsing YouTube's player.
// Preserve native implementations on runtimes that already provide it.
if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = structuredClone;
}
