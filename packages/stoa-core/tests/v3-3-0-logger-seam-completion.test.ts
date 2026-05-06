/**
 * v3.3.0 — Logger seam completion regression lock.
 *
 * The 2026-05-05 audit's consolidated `F-LOGGER-SEAM-001` finding (flagged
 * by 8 of 8 audit agents at 9 distinct source sites) was closed across two
 * waves:
 *
 *   v3.2.2 — `executeAddLiquidityMultiStepComplete` deletion removed two
 *   of the nine sites by removal (addLiquidityFunctions.ts:642 + :660).
 *
 *   v3.3.0 (this commit) — extends the `Logger` interface with `info(...)`
 *   and routes the seven remaining sites through the seam:
 *     - transactionErrors.ts:252 (console.group → folded into getLogger().error header)
 *     - transactionErrors.ts:259 (console.info → getLogger().info)
 *     - transactionErrors.ts:261 (console.groupEnd → dropped; seam doesn't model grouping)
 *     - nodeFailover.ts:61 (console.info → getLogger().info)
 *     - infoOneFunctions.ts:599 + :600 (console.log debug-leak → DELETED)
 *     - ouroFunctions.ts:1590 (console.log failure → getLogger().warn)
 *     - ouroFunctions.ts:1595 (console.log success-debug-dump → DELETED)
 *     - urStoaFunctions.ts:348 (console.info → getLogger().warn,
 *       promoted to warn-level because signature pruning is an
 *       unusual operational event worth structured-log capture)
 *
 * The regression-lock here greps src/ for raw `console.*` call patterns
 * outside of: (a) JSDoc/comment lines, and (b) the seam's own default-
 * logger implementation in observability/logger.ts. Any future
 * regression that introduces a raw console call in src/ fails this test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listTsFiles(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Returns the line indices that are inside a multi-line `/** ... *\/` JSDoc
 * block, plus single-line `// ...` comments and `*` continuation lines.
 * Used to filter the regression-lock so JSDoc examples / explanatory
 * comments mentioning `console.log` don't trip the alarm.
 */
function commentLineSet(source: string): Set<number> {
  const inComment = new Set<number>();
  const lines = source.split(/\r?\n/);
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (inBlock) {
      inComment.add(i);
      if (trimmed.includes("*/")) inBlock = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      inComment.add(i);
      if (!trimmed.includes("*/")) inBlock = true;
      continue;
    }
    if (trimmed.startsWith("//")) {
      inComment.add(i);
      continue;
    }
    if (trimmed.startsWith("*")) {
      // Continuation line inside a JSDoc that started on a previous line
      // and didn't get caught above — defensive coverage.
      inComment.add(i);
      continue;
    }
  }
  return inComment;
}

describe("v3.3.0 logger-seam completion — regression lock", () => {
  it("no raw console.{log,info,group,groupEnd,debug,warn,error} call sites in src/", () => {
    const srcDir = join(process.cwd(), "src");
    const files = listTsFiles(srcDir);

    // The seam's own default-logger implementation is allowed to call
    // console.* directly — that's how the default routing works.
    const SEAM_FILE = join(srcDir, "observability", "logger.ts").replace(/\\/g, "/");

    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const file of files) {
      const normalised = file.replace(/\\/g, "/");
      if (normalised === SEAM_FILE) continue;

      const source = readFileSync(file, "utf-8");
      const comments = commentLineSet(source);
      const lines = source.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        if (comments.has(i)) continue;
        // Match `console.X(` patterns where X is one of the methods we
        // care about. Allow within string literals to be a problem too —
        // that's vanishingly rare in src/ and we'd want to surface it.
        if (/\bconsole\.(log|info|group|groupEnd|debug|warn|error)\s*\(/.test(lines[i])) {
          violations.push({
            file: relative(process.cwd(), file).replace(/\\/g, "/"),
            line: i + 1,
            text: lines[i].trim(),
          });
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line}  ${v.text}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} raw console.* call site(s) in src/. ` +
          `All diagnostic output must route through getLogger() (warn/error/info). ` +
          `Add to observability/logger.ts's seam if a new channel is needed.\n${report}`,
      );
    }

    // Sanity check: this test is only meaningful if it actually scanned files.
    expect(files.length).toBeGreaterThan(20);
  });
});
