/**
 * CodexSigningStrategy — the canonical SigningStrategy implementation.
 *
 * Reproduces the A–F pipeline that every CFM modal's `handleExecute`
 * currently duplicates (see OuronetUI commit history — 23 identical copies
 * with ~43 lines each). When a CFM modal calls `strategy.execute({...})`
 * with a build closure + guards, this class runs the full simulate →
 * calibrate gas → sign → submit dance and returns the request key.
 *
 * Not tied to browser or server. Consumers supply:
 *   - a `KeyResolver` (OuronetUI: ReduxCodexResolver; HUB: FileCodexResolver)
 *   - a `PactClient` (browser: cf-worker URL; server: direct Stoa URL)
 * and the strategy does the rest.
 *
 * The `sign(...)` method is a lower-level primitive for callers that need
 * to control their own simulation flow — it just takes a pre-built tx +
 * specific keypairs and produces a signed result.
 */

import type { ICommand, IUnsignedCommand } from "@stoachain/kadena-stoic-legacy/types";
import { analyzeGuard, selectCapsSigningKey } from "../guard";
import type { IKeyset } from "../guard";
import { calculateAutoGasLimit } from "../gas";
import { runWithTimeout } from "../network";
import { createTimeoutError } from "../errors";
import { fromKeypair, universalSignTransaction } from "./universalSign";
import { SmartAccountAuthError } from "./errors";
import type {
  IKadenaKeypair,
  KeyResolver,
  PactClient,
  SigningStrategy,
} from "./types";

export class CodexSigningStrategy implements SigningStrategy {
  constructor(
    public readonly resolver: KeyResolver,
    public readonly client:   PactClient,
  ) {}

  /**
   * Full execute pipeline. Mirrors the A–F shape from CFM handleExecute:
   *   A. Read guards (caller provides)
   *   B. Build codex pub set (resolver)
   *   C. Analyze each guard → codexKeys / foreignKeys / threshold
   *   D. Collect keypairs for every required signer (resolver)
   *   E. Select GAS_PAYER caps key, avoiding pure-signer overlap
   *   F. Build tx → simulate → calibrate gas → rebuild → sign → submit
   *
   * **Consumer-level retry contract (load-bearing):** If `execute` rejects
   * with `SigningError { code: "TIMEOUT" }` from the submit step, the
   * underlying chain RPC may have ALREADY reached chainweb — the abort only
   * cancels the response read, not the server-side mempool insertion.
   * Naively re-invoking `execute` will rebuild the transaction with a fresh
   * `creationTime`, producing a DIFFERENT request-key hash; chainweb cannot
   * dedup the orphan against the retry, and both transactions can land —
   * the user pays gas twice for the same logical operation. Unlike
   * `getFailoverClient.submit` (which captures the same signed-tx reference
   * across primary+fallback attempts to preserve mempool dedup), this seam
   * deliberately runs without failover (REQ-04) and therefore has NO
   * built-in dedup safety on retry.
   *
   * If you need to retry after TIMEOUT, the consumer MUST first poll the
   * mempool/listen for the orphan submission's request-key (extractable from
   * `signed.hash` if you intercept at the lower level) and only retry once
   * the orphan is confirmed lost. Better: use `getFailoverClient` directly
   * for non-codex submit flows so the dedup contract handles this for you.
   */
  async execute(args: {
    build: (ctx: {
      gasLimit: number;
      capsKeyPub: string;
      guardPubs: string[];
    }) => IUnsignedCommand;
    guards: IKeyset[];
    paymentKey?: string | null;
    resolvedForeignKeys?: Record<string, string>;
    extraSigners?: IKadenaKeypair[];
  }): Promise<{ requestKey: string; raw: any }> {
    const {
      build,
      guards,
      paymentKey = null,
      resolvedForeignKeys = {},
      extraSigners = [],
    } = args;

    // ── B. Codex pub set ─────────────────────────────────────────────
    // Lifted ahead of the canonical "B" position to power the pre-flight
    // below. The pre-flight needs codex-set membership data; calling
    // `listCodexPubs()` once here and reusing it downstream avoids a
    // duplicate resolver hop.
    const codexPubs = await this.resolver.listCodexPubs();

    // ── B½. Σ-prefix smart-account guard detection ───────────────────
    // Best-effort detection at the strategy boundary. Smart-account
    // synthesis emits Σ. in either the keysetRef name or the keys[]
    // entries. When that pattern is present AND the codex cannot satisfy
    // the guard (no signable codex paths), the strategy throws
    // SmartAccountAuthError so the caller can surface a meaningful
    // "switch to smart-account auth flow" error instead of failing deep
    // in the signing pipeline with an opaque message.
    //
    // REQ-11 closure is best-effort detection at the strategy boundary.
    // Smart-account address-level enforcement is upstream in
    // `smartAccountAuth.analyzeSmartAccountAuthPaths`. v4.2 architectural
    // review may consolidate the two detection points.
    for (const guard of guards) {
      const keysetRefHasSigma =
        guard.keysetRef !== undefined && guard.keysetRef.includes("Σ.");
      const keysHaveSigma =
        Array.isArray(guard.keys) && guard.keys.some((k) => k.includes("Σ."));
      const isSmartAccountGuard = keysetRefHasSigma || keysHaveSigma;

      if (isSmartAccountGuard) {
        const analysis = analyzeGuard(guard, codexPubs);
        // Fire when codex holds no signable keys for this guard. The empty-keys
        // case (keys: []) satisfies analyzeGuard trivially (threshold 0) but a
        // Σ.-keyed guard with no inline keys is a keyset-ref pointing at a
        // smart-account keyset the codex cannot resolve — treat as unsatisfiable.
        const noCodexPath =
          analysis.codexKeys.length === 0 &&
          (guard.keys.length === 0 || !analysis.satisfied);
        if (noCodexPath) {
          const matchedSurface =
            keysetRefHasSigma && keysHaveSigma
              ? "keysetRef + keys"
              : keysetRefHasSigma
                ? "keysetRef"
                : "keys";
          throw new SmartAccountAuthError(
            `Smart account guard not satisfiable by codex keys (Σ-prefix detected on ${matchedSurface}, no signable codex paths). ` +
              `Smart-account address-level enforcement is upstream in smartAccountAuth.analyzeSmartAccountAuthPaths; ` +
              `this is a best-effort strategy-boundary check.`,
          );
        }
      }
    }

    // ── B'. Foreign-key resolver pre-flight (REQ-03 / F-CORE-014) ────
    // If the resolver omits `requestForeignKey`, any guard pub that is
    // neither in the codex set nor pre-resolved via `resolvedForeignKeys`
    // would otherwise reach `universalSignTransaction` with no way to be
    // resolved. Fail fast at the entry point — before any chain I/O —
    // with a precise, named error so the consumer can wire the resolver
    // method (or pre-resolve the key) rather than chase a deep-stack
    // failure later in the pipeline.
    if (this.resolver.requestForeignKey === undefined) {
      for (const guard of guards) {
        for (const pub of guard.keys) {
          if (codexPubs.has(pub)) continue;
          if (Object.prototype.hasOwnProperty.call(resolvedForeignKeys, pub)) {
            continue;
          }
          throw new Error(
            `[CodexSigningStrategy] Configured resolver does not implement requestForeignKey, but at least one guard requires a foreign-key signer (pub ${pub.slice(0, 8)}...). Implement KeyResolver.requestForeignKey on the resolver, or pre-resolve the key via resolvedForeignKeys.`,
          );
        }
      }
    }

    // ── C + D. Analyze each guard and collect pure-signer keypairs ───
    const guardKeypairs: IKadenaKeypair[] = [];
    const seenGuardPub = new Set<string>();
    const pureSigningPubs = new Set<string>();

    for (const guard of guards) {
      const analysis = analyzeGuard(guard, codexPubs, resolvedForeignKeys);
      // Iterate codex-signable keys then resolved-foreign keys, stopping
      // at the threshold (analyzeGuard already deduped them).
      const available = [
        ...analysis.codexKeys,
        ...analysis.resolvedForeignKeys,
      ];
      const needed = available.slice(0, analysis.threshold);

      for (const pub of needed) {
        if (seenGuardPub.has(pub)) continue;
        seenGuardPub.add(pub);
        pureSigningPubs.add(pub);

        // Resolved-foreign keys came in via resolvedForeignKeys (a raw
        // 64-char private key the user pasted into ForeignKeySignModal
        // or similar). The resolver doesn't know them — synthesize the
        // keypair inline. Codex keys go through the resolver which
        // handles password prompts + HD derivation.
        let kp: IKadenaKeypair;
        if (analysis.resolvedForeignKeys.includes(pub)) {
          const privateKey = resolvedForeignKeys[pub];
          kp = { publicKey: pub, privateKey, seedType: "foreign" };
        } else {
          kp = await this.resolver.getKeyPairByPublicKey(pub);
        }
        guardKeypairs.push(kp);
      }
    }

    // ── E. Select the GAS_PAYER caps key ─────────────────────────────
    const caps = selectCapsSigningKey(paymentKey, codexPubs, pureSigningPubs);
    if (caps.impossible) {
      throw new Error(
        "[CodexSigningStrategy] No GAS_PAYER key available — the payment " +
          "key is the only Codex key and it's already required for guard signing. " +
          "Rotate the guard to include another Codex key, or switch payment key.",
      );
    }
    if (!caps.key) {
      throw new Error(
        "[CodexSigningStrategy] No Codex key available for GAS_PAYER. " +
          "At least one Codex key must be free of guard-signing duty.",
      );
    }
    const capsKeypair = await this.resolver.getKeyPairByPublicKey(caps.key);

    // ── F. Build → simulate → calibrate gas → rebuild → sign → submit
    const guardPubs = guardKeypairs.map((k) => k.publicKey);
    const buildCtx = (gasLimit: number) => ({
      gasLimit,
      capsKeyPub: capsKeypair.publicKey,
      guardPubs,
    });

    const sim = build(buildCtx(500_000));
    // Failover is intentionally NOT applied at this seam: adding a base-URL
    // accessor to the public PactClient interface would be a breaking change.
    // The consumer's PactClient implementation owns its own failover. Here we
    // enforce only a deadline — the timeout fires via Promise.race, and the
    // AbortController is constructed but its signal is NOT forwarded because
    // PactClient.dirtyRead does not accept a signal argument.
    let simResult: any;
    try {
      simResult = await runWithTimeout(
        "dirtyRead",
        (_controller) => this.client.dirtyRead(sim),
        15_000,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw createTimeoutError("dirtyRead", 15_000, err);
      }
      throw err;
    }
    if (simResult?.result?.status === "failure") {
      const msg =
        simResult.result?.error?.message ||
        "[CodexSigningStrategy] Simulation failed";
      throw new Error(msg);
    }
    const gasLimit = await calculateAutoGasLimit(simResult?.gas ?? 500_000);

    const tx = build(buildCtx(gasLimit));

    // Dedup all signers by pubkey (caps might overlap with a guard pub in
    // edge cases where selectCapsSigningKey fell through; we still safely
    // collapse duplicates before handing them to universalSignTransaction).
    // extraSigners (e.g. Firestarter's paymentSignerKey with coin.TRANSFER
    // cap) flow through the guard-keypair slot — sign() dedups by pub.
    const signed = await this.sign({
      tx,
      capsKey: capsKeypair,
      guardKeypairs: [...guardKeypairs, ...extraSigners],
    });

    // Same trade-off as dirtyRead above: timeout-only enforcement at this
    // seam, no failover. Controller is constructed by runWithTimeout but its
    // signal is NOT forwarded — PactClient.submit does not accept a signal.
    let raw: any;
    try {
      raw = await runWithTimeout(
        "submit",
        (_controller) => this.client.submit(signed),
        60_000,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw createTimeoutError("submit", 60_000, err);
      }
      throw err;
    }
    const requestKey: string = (raw as any)?.requestKey ?? "";
    return { requestKey, raw };
  }

  /**
   * Sign a pre-built tx with the supplied keypairs. Pure — doesn't touch
   * the resolver or the client. Useful for callers that simulate via
   * their own path or batch-build multiple txs before signing.
   */
  async sign(args: {
    tx:            IUnsignedCommand;
    capsKey:       IKadenaKeypair;
    guardKeypairs: IKadenaKeypair[];
  }): Promise<ICommand> {
    const { tx, capsKey, guardKeypairs } = args;

    const seen = new Set<string>();
    const deduped: IKadenaKeypair[] = [];
    for (const kp of [capsKey, ...guardKeypairs]) {
      if (seen.has(kp.publicKey)) continue;
      seen.add(kp.publicKey);
      deduped.push(kp);
    }

    // Forward requestForeignKey if the resolver supports it — universalSign
    // calls it when a signer pubkey in the tx isn't in the supplied pairs.
    const onMissingKey = this.resolver.requestForeignKey
      ? (pub: string) => this.resolver.requestForeignKey!(pub)
      : undefined;

    const universalKeypairs = deduped.map((kp) => fromKeypair(kp));
    const signed = await universalSignTransaction(
      tx,
      universalKeypairs,
      onMissingKey,
    );
    return signed as ICommand;
  }
}
