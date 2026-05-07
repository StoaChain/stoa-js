# Baseline Snapshots — Phase 0 of `kadena-stoic-legacy-vendoring`

This directory holds the **frozen byte-identity oracle** for the
`@stoachain/kadena-stoic-legacy@4.1.0` migration. Every JSON file under
`pact-builder/`, `cryptography-utils/`, `hd-wallet/`, and `signing/` was
captured BEFORE any vendoring touched the source tree, by running the original
upstream `@kadena/*` packages against fixed inputs and recording the bytes
they produced. Phase 7's verification gate re-runs each snapshot's `input`
through the migrated `@stoachain/kadena-stoic-legacy/*` code and asserts
byte-equality against `expected_output`. If the migration changes ANY observable
behavior, this catches it.

## Snapshot file shape

Every JSON file in this tree has exactly the following shape, with top-level
keys appearing in this order (enforced by `scripts/shared.ts:writeSnapshot`):

```json
{
  "input":           <input-as-json>,
  "expected_output": <output-as-json>,
  "captured_at":     "<ISO-8601 timestamp; set when shared.ts wrote the file>",
  "captured_from":   "@kadena/<pkg>@<version>"
}
```

Notes:

- `input` is whatever the capture script fed to the upstream `@kadena/*`
  function under test. For Pact-builder snapshots it includes the canonical
  builder-chain parameters (Pact code, signer pubkey, meta, networkId,
  nonce). For cryptography-utils it's the raw byte-input fed to the helper.
- `expected_output` is exactly what the upstream `@kadena/*` function
  returned, after any necessary serialisation to JSON (Buffers → hex,
  IUnsignedCommand → its three-field record, etc.).
- `captured_at` is honest: it records the actual capture moment.
  Re-running a script DELIBERATELY produces a fresh `captured_at`. Idempotency
  is verified on `input` + `expected_output` + `captured_from` only.
- `captured_from` names the upstream package + the EXACT version resolved at
  capture time from `node_modules/@kadena/*/package.json`. Never hardcoded
  in the capture scripts -- always read from disk via
  `KADENA_VERSIONS` in `scripts/shared.ts`.

Multi-vector files (e.g. `cryptography-utils/hash-vectors.json`) put an
ARRAY of `{input, expected_output}` records inside the top-level `input`
slot, with a single `expected_output` mirroring the array shape. The
top-level keys remain the same; the per-vector inputs/outputs are nested
inside.

## Regeneration

Capture scripts under `scripts/` import from `scripts/shared.ts` and from
the upstream `@kadena/*` packages (resolved through the repo-root
`node_modules/`). To regenerate every snapshot:

```bash
# From this baseline-snapshots/ directory:
npx tsx scripts/pact-builder-group1.ts
npx tsx scripts/pact-builder-group2.ts
npx tsx scripts/cryptography-utils.ts
npx tsx scripts/hd-wallet.ts
npx tsx scripts/signing.ts
```

Each script writes deterministic JSON into the matching domain folder
(`scripts/pact-builder-group1.ts` writes into `pact-builder/`, etc.).
Re-running a script is idempotent on `input` + `expected_output` +
`captured_from`; only `captured_at` updates.

The `tsx` runner is pinned to an exact version in the root `package.json`
`devDependencies` (no `^` prefix). If you bump it, document the swap in
the spec's task notes.

> **Important:** regeneration is a Phase 0 operation. Once Phase 1+ has
> vendored the `@kadena/*` source into `packages/kadena-stoic-legacy/`,
> running these scripts against the migrated code is no longer "regenerate
> the oracle" -- it is the verification gate itself, and any byte-difference
> is a migration regression, NOT a snapshot to overwrite. Phase 7's
> `verify.ts` script encodes this distinction.

## Why these files are committed to git

These snapshots are the load-bearing oracle for REQ-29's byte-identity
verifiability claim. If they live only on a developer's laptop, no PR
review and no CI run can verify that the migration preserved upstream
behavior. They MUST be committed alongside the spec so that:

1. Phase 7's verification gate has something to compare against in CI.
2. Future audits can reproduce the byte-identity claim without re-running
   the Phase 0 capture (which would require reverting the migration).
3. The commit history records the EXACT upstream bytes we forked from.

The root `.gitignore` excludes `.bee/` by default; T0.1 appended a
multi-line negation block to re-include `.bee/specs/*/baseline-snapshots/**`
specifically. Deleting these files would invalidate the migration's
preservation claim and require either reverting Phase 1+ to re-capture
or accepting unverified migration behavior. **Do not delete.**

## Upstream versions captured (resolved at T0.1)

The `KADENA_VERSIONS` constant in `scripts/shared.ts` resolves these
values at script-run time from `node_modules/@kadena/*/package.json`. The
versions captured during Phase 0 are:

| Package                       | Version |
| ----------------------------- | ------- |
| `@kadena/client`              | 1.18.3  |
| `@kadena/cryptography-utils`  | 0.4.4   |
| `@kadena/types`               | 0.7.0   |
| `@kadena/hd-wallet`           | 0.6.2   |

These match the exact-pinning convention introduced in v4.0.0 of stoa-js
(no `^` prefix on `@kadena/*` peer/dev deps). If `node_modules/` ever
holds a different set of versions when a script runs, the resulting
`captured_from` strings will surface the drift immediately.

## File count vs. vector count

The phase plan describes "~30-50 snapshots". That figure is a count of
**vectors** (individual input/output pairs) -- NOT files. The directory
layout is:

| Domain               | Files | Approx. vectors                                    |
| -------------------- | ----- | -------------------------------------------------- |
| `pact-builder/`      | 10    | 10 (one tx-cmd per file)                           |
| `cryptography-utils/`| 4     | ~18 (multi-vector files: hash-vectors has 5, etc.) |
| `hd-wallet/`         | 4     | ~5                                                 |
| `signing/`           | 2     | ~5 (multi-sig file has 3 keypairs)                 |
| **Total**            | **20**| **~38**                                            |

Multi-vector files like `cryptography-utils/hash-vectors.json` and
`bin-to-hex-vectors.json` each contain ~5 vectors internally, packed into
a single file because the upstream API surface they exercise is uniform
across the inputs. So the on-disk file count (20) is smaller than the
total vector count (~38). Both are correct -- the files are what git
tracks and what Phase 7's verify.ts iterates over; the vectors are what
Phase 7 actually byte-compares.

## Directory layout

```
baseline-snapshots/
├── README.md                  ← this file
├── scripts/
│   ├── shared.ts              ← writeSnapshot + KADENA_VERSIONS + fixtures
│   ├── pact-builder-group1.ts (T0.2)
│   ├── pact-builder-group2.ts (T0.3)
│   ├── cryptography-utils.ts  (T0.4)
│   ├── hd-wallet.ts           (T0.5)
│   └── signing.ts             (T0.6)
├── pact-builder/              ← 10 JSON files (T0.2 + T0.3)
├── cryptography-utils/        ← 4 JSON files (T0.4)
├── hd-wallet/                 ← 4 JSON files (T0.5)
└── signing/                   ← 2 JSON files (T0.6)
```

T0.1 (this task) created the directory tree, `shared.ts`, and this README;
it did not emit any `*.json` files. T0.2 through T0.6 (Wave 2) emit the
20 snapshot files. T0.7 (Wave 3) verifies the integrated post-state.
