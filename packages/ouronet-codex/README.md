# @stoachain/ouronet-codex

> Modular React Codex for the Ouronet ecosystem — drop-in `<CodexProvider>` + hooks + headless components giving any React consumer (OuronetUI, AncientHoldings hub, future apps) full 1:1 Codex functionality without re-implementing it.

## Status

**`0.5.0` local** (alpha track) — 2026-06-01. **Feature release — the full ZBOM (Zone-Based Operation Modal) transaction surface**, bringing the package to 1:1 functional parity with OuronetUI's "My Codex" per-account operation buttons. New `ZbomOperationModal` (`./ui`) hosts ZONE 0–3 for any of the seven `ZbomOperation` descriptors (`./zbom` → `ZBOM_OPERATIONS`): Activate Standard, Rotate Payment Key / Guard / Sovereign / Governor, Register / Release StoicTag — each with the debouncer (`useZbomInfoRead`), patron auto-select (`usePatronAutoSelect`), signing preview (`SigningZone`), and execute glue (`useZbomExecute`). `OuronetAccountsTab` wires all seven account-row buttons to the single host. Additive — every prior export keeps its signature; new public surface is `./ui` (`ZbomOperationModal`) + `./zbom` (operation registry, debouncer, execution glue). The `0.3.x`/`0.4.0` increments (drop-in `./ui` tabs, Codex Identity / CodexGuard, Spawn flow) shipped to consumers via local dist drops and were not separately published. See CHANGELOG for full details.

**`0.2.1` on public npmjs** (alpha track) — Released 2026-05-27. **Bugfix release** — fixes a packaging bug present since v0.1.0 where `dist/**/*.js` re-exported from relative paths without `.js` extensions, causing `ERR_MODULE_NOT_FOUND` under Node 22+ strict ESM (any consumer doing `await import('@stoachain/ouronet-codex/...')` would crash). Static-import consumers (Vite, Next.js bundlers) were unaffected. AncientHoldings hub's Caduceus.1 integration surfaced + diagnosed it. Tests + typecheck unchanged from v0.2.0 (161 specs pass). No API changes; consumers can `npm update` and drop workarounds. See CHANGELOG for full details.

**`0.2.0` on public npmjs** (alpha track) — Released 2026-05-26. Structural Prime invariants: every codex now has an unremovable Prime Codex Seed (`IKadenaSeed.isPrime`) AND CodexPrime Standard Ouronet Account (`isPrime` + `parentSeedId` linkage). New `kickstartCodex` action atomically installs both from caller-supplied derived entities; new `recoverCodexFromMnemonic` action handles the recovery path. `useCodexLifecycle()` hook is the single integration point. Backward-compatible: every v0.1.0 export keeps its signature, additive only. Pre-v0.2.0 codexes auto-migrate on next `init()` (eager seed-flag). New errors: `CodexPrimeSeedProtectedError`, `CodexKickstartError`. Test count: **161 specs pass** (added 18 in state-store.test.ts). See `docs/v0.2.0-design.md` for the full contract. Peer-deps the v4.2-line atomic triplet at `>=4.3.0` (`@stoachain/kadena-stoic-legacy`, `@stoachain/stoa-core`, `@stoachain/ouronet-core`). Single regular dep on `zustand@^5` (internal state container; invisible to consumers — consumers do NOT need Redux). v0.x ships under the npm `alpha` dist-tag — `npm install @stoachain/ouronet-codex` without an explicit version pulls only when the consumer opts in via `@alpha`. Promotion to `latest` happens at v1.0.0, after both OuronetUI and AncientHoldings have integrated cleanly. Public surface: `/provider` (`<CodexProvider>`), `/hooks` (13 React hooks — added `useCodexLifecycle` in v0.2.0), `/components` (8 headless components — 5 non-rotation + 3 rotation), `/adapters` (CodexAdapter interface + LocalStorageCodexAdapter + MemoryCodexAdapter), `/resolver` (InternalCodexResolver implementing stoa-core's KeyResolver), `/errors` (8 typed CodexError subclasses — added `CodexPrimeSeedProtectedError` + `CodexKickstartError` in v0.2.0), `/types` (entity types), `/google-drive` (opt-in cloud-backup subpath — scaffold only, full impl in a later 0.x).

## Why this exists

Before `@stoachain/ouronet-codex`, the Codex — encrypted multi-wallet store + signing + auth + key-resolution surface — existed only inside OuronetUI as ~5k LOC of React + Redux + localStorage glue. The only portable pieces in `@stoachain/ouronet-core` (`PlaintextCodex`, `serializeCodex`, `CodexSigningStrategy`, `smartEncrypt`/`smartDecrypt`) were primitives — they didn't give a consumer a working Codex out of the box.

When **AncientHoldings** needed Codex-equivalent functionality, the team attempted a from-scratch re-implementation. That attempt failed: duplicated logic, drifted out of sync, never reached UX parity. The lesson is structural — the Codex must be **one canonical package any consumer can drop in**, not a recipe each consumer reimplements.

## Architecture

```
@stoachain/ouronet-core           framework-agnostic primitives
   ├─ /codex                     PlaintextCodex, V1.2 codec
   ├─ /signing                   KeyResolver interface, CodexSigningStrategy
   ├─ /crypto                    smartEncrypt / smartDecrypt
   └─ /interactions/*            chain reads + writes

@stoachain/ouronet-codex          ← this package: React orchestration over the above
   ├─ /provider                  <CodexProvider>
   ├─ /hooks                     useCodex, useActiveWallet, useSignTransaction, ...
   ├─ /components                headless <PasswordModal>, <RotateGuardModal>, ...
   ├─ /adapters                  LocalStorageCodexAdapter, MemoryCodexAdapter
   ├─ /resolver                  InternalCodexResolver
   ├─ /errors                    typed CodexError subclasses
   └─ /google-drive              opt-in cloud sync (separate subpath)
```

`ouronet-codex` peer-deps the v4.2-line atomic triplet (ksl + stoa-core + ouronet-core) at `>=4.3.0`; consumers install both alongside React.

## Install

```bash
npm install @stoachain/ouronet-codex@alpha \
            @stoachain/ouronet-core \
            @stoachain/stoa-core \
            @stoachain/kadena-stoic-legacy \
            react react-dom
```

(if you're already consuming the triplet for non-codex purposes, only `@stoachain/ouronet-codex@alpha` is new — the `@alpha` tag is required while in v0.x)

## Quick start

```tsx
import { CodexProvider } from "@stoachain/ouronet-codex/provider";
import { LocalStorageCodexAdapter } from "@stoachain/ouronet-codex/adapters";
import { PasswordModal } from "@stoachain/ouronet-codex/components";

function App() {
  return (
    <CodexProvider adapter={new LocalStorageCodexAdapter()}>
      <YourApp />
      <PasswordModal />
    </CodexProvider>
  );
}
```

```tsx
import { useSignTransaction } from "@stoachain/ouronet-codex/hooks";
import { buildSomePactCode } from "@stoachain/ouronet-core/pact";

function YourComponent() {
  const { execute } = useSignTransaction();

  const handleClick = async () => {
    const { requestKey } = await execute({
      build: ({ gasLimit, capsKeyPub, guardPubs }) => /* build Pact transaction */,
      guards: [/* keysets to sign with */],
      paymentKey: null,
    });
    console.log("submitted:", requestKey);
  };

  return <button onClick={handleClick}>Sign + submit</button>;
}
```

Full API + integration patterns: see [the spec doc](https://github.com/StoaChain/stoa-js/blob/main/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md) until a real `INTEGRATION-GUIDE.md` lands (planned for v0.2.x).

## Version history

**v0.2.1** — Bugfix release. Fixed extensionless relative imports in emitted `dist/**/*.js` (35 source files updated, 121 imports rewritten). Resolves `ERR_MODULE_NOT_FOUND` for Node ESM dynamic-import consumers. 161 specs still pass; no API changes; backward-compatible with v0.2.0 consumers. Reported by AncientHoldings hub Caduceus.1 work. See CHANGELOG entry for the full diagnosis.

**v0.2.0** — Structural Prime invariants. Added `IKadenaSeed.isPrime` + `IOuroAccount.parentSeedId` (causal seed↔account linkage). Added `kickstartCodex` + `recoverCodexFromMnemonic` actions on the store, exposed via the new `useCodexLifecycle()` hook. Added `CodexPrimeSeedProtectedError` + `CodexKickstartError` error classes. Tightened `addKadenaSeed` (auto-prime first + id-conflict guard) + `deleteKadenaSeed` (prime protection + cascade-delete linked ouro accounts) + `addOuroAccount` (parentSeedId validation). Legacy pre-v0.2.0 codexes auto-migrate on `init()` (eager seed-flag; ouro half deferred to authentication). Two existing tests adjusted for the new auto-prime-first-seed behavior. 161 specs pass (+18). Backward-compat preserved — every v0.1.0 export keeps its signature. See `packages/ouronet-codex/docs/v0.2.0-design.md` for the design lock.

**v0.1.0** — initial alpha release. Peer-deps the v4.3.0 atomic triplet. Ships the full Phase 2-7 surface from the spec: scaffold (Phase 2), adapters (Phase 3 — `CodexAdapter` interface + `LocalStorageCodexAdapter` + `MemoryCodexAdapter`, with 36 contract tests parameterized across both implementations), Zustand state store (Phase 4 — `CodexStore` with namespaced actions, CodexPrime protection, 27 action tests), hooks + resolver + provider stub (Phase 5 — 11 hooks: `useCodex`, `useActiveWallet`, `useGetKeypair`, `useSignTransaction`, `useCodexAuth`, `useKadenaSeeds`, `usePureKeypairs`, `useOuroAccounts`, `useAddressBook`, `useWatchList`, `useCodexBackup`; `InternalCodexResolver` implementing stoa-core's `KeyResolver`; minimal provider stub), 5 non-rotation headless components (Phase 6a — `<PasswordModal>` with promise-returning prompt mechanism, `<BackupRestorePanel>`, `<AddPureKeypairForm>`, `<ActiveWalletPicker>`, `<CodexInfoPanel>`), 3 rotation modals (Phase 6b — `<RotateGuardModal>`, `<RotatePaymentKeyModal>`, `<RotateSovereignModal>`; the 4th `<RotateGovernorModal>` is deferred post-OuronetUI-migration), provider full §5.1 surface (Phase 7 — `passwordCacheMinutes` + `initialUiSettings` + `onCodexDirty` + `signingClient` override + SSR-safe shell). **143 specs pass.** Published with npm `alpha` dist-tag. Acceptance for v1.0.0 (latest tag) is OuronetUI's clean migration (Phase 9 of the spec) + AncientHoldings's clean integration (Phase 10); API gaps surface as v0.x revisions before v1.0.0.

## License

UNLICENSED — internal StoaChain ecosystem use.
