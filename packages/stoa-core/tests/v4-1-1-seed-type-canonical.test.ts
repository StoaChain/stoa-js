/**
 * REQ-13: SeedType has ONE canonical declaration, and it lives here.
 *
 * `SeedType` is declared in stoa-core and re-exported by downstream packages
 * (notably @ouronet/ouronet-core's codex surface) rather than re-declared. This
 * test guards the near half of that contract: the canonical declaration exists
 * at a known path in this repo. The far half — that ouronet-core re-exports
 * rather than re-declares — is locked by the matching test in ouronet-libs,
 * since only that repo can see its own source.
 *
 * Split out of the former ouronet-core test suite in the Phase-4 reorg, where
 * this assertion had been reaching across packages/ inside the old monorepo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-13: SeedType single canonical declaration", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..");

  it("canonical SeedType lives at packages/stoa-core/src/wallet/types.ts", () => {
    const file = readFileSync(resolve(repoRoot, "packages/stoa-core/src/wallet/types.ts"), "utf8");
    expect(file).toMatch(/export type SeedType\s*=/);
  });

  it("it is exported from the wallet subpath barrel", () => {
    const barrel = readFileSync(resolve(repoRoot, "packages/stoa-core/src/wallet/index.ts"), "utf8");
    expect(barrel).toMatch(/SeedType|export \* from "\.\/types\.js"/);
  });
});
