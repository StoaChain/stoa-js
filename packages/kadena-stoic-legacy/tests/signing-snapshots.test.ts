/**
 * REQ-25: signing snapshot fidelity test.
 * Validates 2 baseline-snapshots (single-sig + multi-sig-combination).
 *
 * Cross-snapshot invariant: keypair reuse, not signature equality.
 * The same keypair signs DIFFERENT messages in the two snapshots so
 * signatures differ — but the publicKey appears in both snapshots.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

describe("REQ-25: signing vendor-fidelity snapshots", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const snapshotDir = resolve(
    here, "..", "..", "..",
    ".bee/archive/2026-05-06-kadena-stoic-legacy-vendoring/baseline-snapshots/signing"
  );

  it("baseline directory has 2 signing snapshots", () => {
    const files = readdirSync(snapshotDir).filter(f => f.endsWith(".json"));
    expect(files.length).toBe(2);
    expect(files).toContain("single-sig.json");
    expect(files).toContain("multi-sig-combination.json");
  });

  it("each snapshot file is valid JSON with expected structure", () => {
    const files = readdirSync(snapshotDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      const content = JSON.parse(readFileSync(join(snapshotDir, file), "utf8"));
      expect(content, `${file}: missing input`).toHaveProperty("input");
      expect(content, `${file}: missing expected_output`).toHaveProperty("expected_output");
    }
  });

  it("cross-snapshot keypair-reuse invariant: same publicKey appears in both", () => {
    const single = JSON.parse(readFileSync(join(snapshotDir, "single-sig.json"), "utf8"));
    const multi = JSON.parse(readFileSync(join(snapshotDir, "multi-sig-combination.json"), "utf8"));

    // single-sig.json carries the signing keypair directly on input.keypair
    const singlePubKey = single.input?.keypair?.publicKey;
    expect(singlePubKey, "single-sig.json missing input.keypair.publicKey").toBeDefined();

    // multi-sig-combination.json lists signers in expected_output.sigs;
    // sigs[0].pubKey is the first keypair, which is the same key used in single-sig
    const multiFirstPubKey = multi.expected_output?.sigs?.[0]?.pubKey;
    expect(multiFirstPubKey, "multi-sig-combination.json missing expected_output.sigs[0].pubKey").toBeDefined();

    // Same keypair must appear in both snapshots (reuse invariant)
    expect(multiFirstPubKey).toBe(singlePubKey);
  });
});
