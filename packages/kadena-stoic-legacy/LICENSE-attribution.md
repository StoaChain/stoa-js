# License Attribution

This package, `@stoachain/kadena-stoic-legacy`, vendors the source of four upstream `@kadena/*` packages under StoaChain stewardship:

- `@kadena/client@1.18.3`
- `@kadena/cryptography-utils@0.4.4`
- `@kadena/types@0.7.0`
- `@kadena/hd-wallet@0.6.2`

The fork was created on **2026-05-06** by StoaChain to provide a sovereign supply-chain replacement that preserves the upstream code byte-identically while allowing controlled, auditable evolution of the vendored surface. The original copyright statement from Kadena LLC (preserved verbatim below) is **NOT removed or modified**. The StoaChain derivative-work continues under the **BSD-3-Clause** license — the same license Kadena LLC chose for the upstream packages.

## Single canonical LICENSE — covers all four packages

All four upstream `@kadena/*` LICENSE files are **byte-identical**:

- SHA256: `b94a46d74ac7bae9859458a6413af74a87303a5b52b45904215a36644648dae1`
- Size: 1524 bytes each

Shipping four byte-identical copies would be redundant. The single canonical LICENSE text below covers all four vendored packages with explicit attribution preserved.

## Modifications from upstream

- **2026-05-06** — `src/client/signing/chainweaver/signWithChainweaver.cjs`: replaced `cross-fetch` (~3.1.5) import with native `globalThis.fetch` (Node 22+ stable). Reason: avoid bundling third-party MIT package when the language platform now provides a stable native equivalent. Diff: removed `const cross_fetch_1 = __importDefault(require("cross-fetch"))` import + replaced `cross_fetch_1.default` call site with `globalThis.fetch`. Behavioral preservation under Node 22+.
- **2026-05-06** — `src/client/signing/index.cjs` + `signing/index.d.cts`: removed dead walletconnect re-exports (`./walletconnect/{quicksignWithWalletConnect,signWithWalletConnect}`). Reason: walletconnect/ subtree dropped per Phase 2 T2.7 decision (zero usage in stoa-core/ouronet-core; upstream walletconnect imports are TYPE-ONLY). Diff: removed 2 `__exportStar(require(...))` lines (`signing/index.js:23-24` upstream) and 3 type re-export lines (`TWalletConnectChainId` named export + 2 `export *` lines for walletconnect submodules in `signing/index.d.ts`).
- **2026-05-06** — `dist/client/**/*.cjs`: bare `require("./X")` calls rewritten at copy time to `require("./X.cjs")` to fix Node CJS resolver auto-resolution after the `.js → .cjs` rebrand. Reason: Node's CJS resolver auto-resolves only `.js`, `.json`, `.node` extensions for relative bare requires. Source files in `src/client/` remain byte-identical to upstream; the rewrite happens only at the dist boundary. Implementation: `scripts/copy-vendor-files.cjs` walks each `.cjs` file, applies regex `/require\("(\.\.?\/[^"]+?)"\)/g`, and appends `.cjs` (or `/index.cjs` for directory targets) when the target file exists.

## Upstream LICENSE (BSD-3-Clause, byte-identical canonical copy)

```
BSD 3-Clause License

Copyright (c) 2018 - 2024 Kadena LLC
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
