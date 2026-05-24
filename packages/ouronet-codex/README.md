# @stoachain/ouronet-codex

> Modular React Codex for the Ouronet ecosystem — drop-in `<CodexProvider>` + hooks + headless components giving any React consumer (OuronetUI, AncientHoldings hub, future apps) full 1:1 Codex functionality without re-implementing it.

## Status

**`0.1.0` — IN DEVELOPMENT.** Scaffold landed 2026-05-24; implementation tracked under [`stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md`](https://github.com/StoaChain/stoa-js/blob/main/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md). First publish to npm with the `alpha` tag once Phases 2–7 (scaffold → adapters → state → hooks → components → provider) are complete. Promoted to `latest` at v1.0.0 only after OuronetUI + AncientHoldings have both successfully migrated.

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

`ouronet-codex` peer-deps the v4.2 atomic triplet (ksl + stoa-core + ouronet-core); consumers install both alongside React.

## Install

```bash
npm install @stoachain/ouronet-codex \
            @stoachain/ouronet-core \
            @stoachain/stoa-core \
            @stoachain/kadena-stoic-legacy \
            react react-dom
```

(if you're already consuming the triplet for non-codex purposes, only `@stoachain/ouronet-codex` is new)

## Quick start

```tsx
import { CodexProvider } from "@stoachain/ouronet-codex/provider";
import { LocalStorageCodexAdapter } from "@stoachain/ouronet-codex/adapters";

function App() {
  return (
    <CodexProvider adapter={new LocalStorageCodexAdapter()}>
      <YourApp />
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

Full API + integration patterns: see [the spec doc](https://github.com/StoaChain/stoa-js/blob/main/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md) until v0.1.0 ships and a real `INTEGRATION-GUIDE.md` lands.

## License

UNLICENSED — internal StoaChain ecosystem use.
