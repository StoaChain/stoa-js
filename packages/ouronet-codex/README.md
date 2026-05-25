# @stoachain/ouronet-codex

> Modular React Codex for the Ouronet ecosystem — drop-in `<CodexProvider>` + hooks + headless components giving any React consumer (OuronetUI, AncientHoldings hub, future apps) full 1:1 Codex functionality without re-implementing it.

## Status

**`0.1.0` on public npmjs** (alpha track) — **INITIAL RELEASE.** Released 2026-05-25. Ships the modular React Codex package extracted from OuronetUI as a portable surface any React consumer can drop in. Peer-deps the v4.2-line atomic triplet at `>=4.3.0` (`@stoachain/kadena-stoic-legacy`, `@stoachain/stoa-core`, `@stoachain/ouronet-core` — the latter adds the two `buildRotateGuardPactCode` + `buildRotateKadenaPactCode` Pact builders this package consumes for its headless rotation modals). Single regular dep on `zustand@^5` (internal state container; invisible to consumers — consumers do NOT need Redux). v0.x ships under the npm `alpha` dist-tag — `npm install @stoachain/ouronet-codex` without an explicit version pulls 0.1.0 only when the consumer opts in via `@alpha`, otherwise nothing resolves. Promotion to `latest` happens at v1.0.0, after both OuronetUI and AncientHoldings have integrated cleanly. Test count: **143 specs pass** across the package (adapters contract: 36; state-store actions: 27; resolver-internal: 14; provider: 15; hooks: 25; components: 13; rotation modals: 13). Public surface: `/provider` (`<CodexProvider>`), `/hooks` (12 React hooks), `/components` (8 headless components — 5 non-rotation + 3 rotation), `/adapters` (CodexAdapter interface + LocalStorageCodexAdapter + MemoryCodexAdapter), `/resolver` (InternalCodexResolver implementing stoa-core's KeyResolver), `/errors` (6 typed CodexError subclasses), `/types` (entity types), `/google-drive` (opt-in cloud-backup subpath — scaffold only at v0.1.0, full impl in v0.2.x).

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

**v0.1.0** — initial alpha release. Peer-deps the v4.3.0 atomic triplet. Ships the full Phase 2-7 surface from the spec: scaffold (Phase 2), adapters (Phase 3 — `CodexAdapter` interface + `LocalStorageCodexAdapter` + `MemoryCodexAdapter`, with 36 contract tests parameterized across both implementations), Zustand state store (Phase 4 — `CodexStore` with namespaced actions, CodexPrime protection, 27 action tests), hooks + resolver + provider stub (Phase 5 — 11 hooks: `useCodex`, `useActiveWallet`, `useGetKeypair`, `useSignTransaction`, `useCodexAuth`, `useKadenaSeeds`, `usePureKeypairs`, `useOuroAccounts`, `useAddressBook`, `useWatchList`, `useCodexBackup`; `InternalCodexResolver` implementing stoa-core's `KeyResolver`; minimal provider stub), 5 non-rotation headless components (Phase 6a — `<PasswordModal>` with promise-returning prompt mechanism, `<BackupRestorePanel>`, `<AddPureKeypairForm>`, `<ActiveWalletPicker>`, `<CodexInfoPanel>`), 3 rotation modals (Phase 6b — `<RotateGuardModal>`, `<RotatePaymentKeyModal>`, `<RotateSovereignModal>`; the 4th `<RotateGovernorModal>` is deferred post-OuronetUI-migration), provider full §5.1 surface (Phase 7 — `passwordCacheMinutes` + `initialUiSettings` + `onCodexDirty` + `signingClient` override + SSR-safe shell). **143 specs pass.** Published with npm `alpha` dist-tag. Acceptance for v1.0.0 (latest tag) is OuronetUI's clean migration (Phase 9 of the spec) + AncientHoldings's clean integration (Phase 10); API gaps surface as v0.x revisions before v1.0.0.

## License

UNLICENSED — internal StoaChain ecosystem use.
