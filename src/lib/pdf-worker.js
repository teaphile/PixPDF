/**
 * PDF.js worker bootstrap.
 *
 * The parser/decryptor runs inside a dedicated worker, which is a *separate*
 * JavaScript realm: polyfills installed on the page do not reach it. PDF.js 6
 * uses the newest Math/Map helpers in its crypto and layout code, so older
 * browsers fail with "Math.sumPrecise is not a function" the moment a
 * password-protected PDF is opened. We bootstrap the worker ourselves and
 * install the helpers before PDF.js starts.
 */
function install(target, name, implementation) {
  if (!target || typeof target[name] === "function") return;
  try {
    Object.defineProperty(target, name, { value: implementation, configurable: true, writable: true });
  } catch {
    /* ignore locked prototypes */
  }
}

function installWorkerPolyfills() {
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
  if (typeof Math.sumPrecise !== "function") {
    // Neumaier compensated summation — the spec-compliant result for the
    // "sum without losing precision" use case PDF.js relies on.
    Math.sumPrecise = function sumPrecise(values) {
      let sum = 0;
      let compensation = 0;
      for (const value of values) {
        if (typeof value !== "number") {
          throw new TypeError("Math.sumPrecise only accepts numbers");
        }
        const next = sum + value;
        compensation +=
          Math.abs(sum) >= Math.abs(value) ? sum - next + value : value - next + sum;
        sum = next;
      }
      if (Number.isFinite(sum) && Number.isFinite(compensation)) return sum + compensation;
      return Number.isNaN(sum) ? NaN : sum;
    };
  }
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
}

installWorkerPolyfills();

// Boot PDF.js inside this worker only after the globals above exist.
// A plain module import (not a dynamic one) keeps the bundler happy while
// still running *after* the polyfills above.
import("pdfjs-dist/build/pdf.worker.min.mjs").catch((error) => {
  console.error("PDF worker failed to start", error);
});
