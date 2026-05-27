/**
 * Tool version metadata.
 * - APP_VERSION: bump manually on each meaningful release.
 * - BUILD_COMMIT and BUILD_DATE are injected at build time by vite.config.js
 *   (using `define` substitution). At dev time they fall back to placeholders.
 */
export const APP_VERSION = '2.6.0';

// These globals are defined in vite.config.js via `define:` — they're literal
// strings at build/run time. The typeof guards keep this safe in test runners
// or hot-reload edge cases where the define may not have fired yet.
export const BUILD_COMMIT =
  typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev';
export const BUILD_DATE =
  typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString().slice(0, 10);

/** Human-readable label like "v2.5.0 · a1b2c3d · 2026-05-29" */
export const FULL_VERSION = `v${APP_VERSION} · ${BUILD_COMMIT} · ${BUILD_DATE}`;
