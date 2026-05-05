/**
 * Pluggable logger seam — getLogger + setLogger.
 *
 * Problem it solves: `@stoachain/ouronet-core` historically called
 * `console.warn` / `console.error` directly across `src/network`,
 * `src/errors`, and `src/interactions/*`. Consumers (OuronetUI in the
 * browser, AncientHolder HUB on the server) have no way to redirect that
 * output to their own structured-logging pipelines without monkey-patching
 * `globalThis.console`. This seam gives them one explicit injection point.
 *
 * Contract: consumers call `setLogger(logger)` once at boot to plug in their
 * preferred logger. Core's call sites (catch blocks, failover warnings, the
 * tier-cache miss notes) call `getLogger().warn(...)` / `.error(...)`, which
 * routes to whatever the consumer configured (or falls back to the default
 * console-routing logger if nothing was configured).
 *
 *   OuronetUI (browser): `setLogger(reduxLogger)` at boot →
 *                        warn/error rendered into the dev panel + Sentry
 *   HUB (server):         `setLogger(pinoAdapter)` at boot →
 *                         structured JSON to stdout, no console noise
 *   No call:              warn/error route to `console.warn`/`console.error`
 *                         for parity with pre-seam behavior
 *
 * This is a narrow, deliberate injection seam — NOT a full DI framework.
 * Mirrors the `setPactReader` pattern in `src/reads/pactReader.ts`; the
 * Phase 3 SigningStrategy / KeyResolver refactor generalises the same idea
 * for signing.
 */

/**
 * Logger shape — three methods covering every core call site:
 *
 *   - `warn` / `error`: surfaced from the v2.3.0 catch-routing sweep. Used
 *     for failure paths in `interactions/*`, `network/*`, `errors/*`.
 *   - `info` (added v3.3.0 — closes the consolidated `F-LOGGER-SEAM-001`
 *     finding flagged by 8 audit agents): operational events that aren't
 *     errors but consumers may still want to capture (node-recovery
 *     announcements, error-suggestions callouts, signature-pruning
 *     diagnostics). Pre-v3.3.0 the seam exposed only `warn`/`error`, so
 *     these events fell through to raw `console.info` calls that bypassed
 *     consumer-supplied loggers. v3.3.0 routes them through the seam.
 *
 * `unknown[]` (NOT `any[]`) for the rest args keeps consumers honest about
 * what they pass.
 */
export type Logger = {
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
};

/**
 * Default logger. Routes through arrow-form wrappers (NOT
 * `console.warn.bind(console)`) so `vi.spyOn(console, "warn")` in tests
 * catches the calls — `bind` would capture the original reference at module
 * load and bypass the spy.
 */
const defaultLogger: Logger = {
  warn: (msg: string, ...args: unknown[]) => console.warn(msg, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(msg, ...args),
  info: (msg: string, ...args: unknown[]) => console.info(msg, ...args),
};

let _logger: Logger = defaultLogger;

/**
 * Configure the logger that all core call sites route through. Call once at
 * boot; later calls replace the previous logger. Throws `TypeError` if
 * `logger` is `null` or `undefined` — the seam refuses to install a missing
 * dependency rather than silently swallow warn/error output downstream.
 *
 * v3.3.0 backwards-compatibility: consumers that wired
 * `setLogger({ warn, error })` against the v3.2.x Logger shape continue to
 * work. The `info` method is filled in from the default `console.info`
 * routing if the input object lacks one. New consumers that want full
 * control of all three channels pass `{ warn, error, info }`.
 */
export function setLogger(logger: Logger | { warn: Logger["warn"]; error: Logger["error"] }): void {
  if (logger === null || logger === undefined) {
    throw new TypeError("setLogger requires a non-null Logger");
  }
  // Fill in `info` from the default if the consumer's logger predates the
  // v3.3.0 surface extension. Cast is safe because we've validated the
  // narrower input shape and we're synthesising the missing method.
  const filled: Logger = "info" in logger && typeof logger.info === "function"
    ? (logger as Logger)
    : {
        warn: logger.warn,
        error: logger.error,
        info: defaultLogger.info,
      };
  _logger = filled;
}

/**
 * Get the currently-installed logger. Core call sites invoke this per use
 * (NOT cached at module load) so a `setLogger` call after first use takes
 * effect immediately.
 */
export function getLogger(): Logger {
  return _logger;
}
