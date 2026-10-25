/**
 * Tiny compatibility layer for the current PDF.js engine.
 *
 * pdfjs-dist v6 ships ES2026 `Map` / `WeakMap` helpers (`getOrInsert`,
 * `getOrInsertComputed`) and uses `Promise.withResolvers` at render time.
 * Those APIs are missing in Safari < 26, older Chromium builds, Firefox ESR
 * and several in-app browsers. Without them every PDF preview, conversion,
 * compression, thumbnail and visual editor throws
 * "getOrInsertComputed is not a function" before a single page is drawn.
 *
 * The polyfills are idempotent and only installed when the native method is
 * missing, so modern engines keep their optimised built-ins.
 */

function install(target, name, implementation) {
  if (!target || typeof target[name] === "function") return;
  try {
    Object.defineProperty(target, name, {
      value: implementation,
      configurable: true,
      writable: true
    });
  } catch {
    /* A locked-down prototype is extremely rare; native code can still run. */
  }
}

install(Map.prototype, "getOrInsert", function getOrInsert(key, fallback) {
  if (this.has(key)) return this.get(key);
  this.set(key, fallback);
  return fallback;
});

install(Map.prototype, "getOrInsertComputed", function getOrInsertComputed(key, callback) {
  if (this.has(key)) return this.get(key);
  const value = callback(key);
  this.set(key, value);
  return value;
});

install(WeakMap.prototype, "getOrInsert", function getOrInsert(key, fallback) {
  if (this.has(key)) return this.get(key);
  this.set(key, fallback);
  return fallback;
});

install(WeakMap.prototype, "getOrInsertComputed", function getOrInsertComputed(key, callback) {
  if (this.has(key)) return this.get(key);
  const value = callback(key);
  this.set(key, value);
  return value;
});

if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export const polyfillsReady = true;
