// @stoachain/ouronet-codex/hooks
//
// Public React hooks consumers use to interact with the codex.
//
// Inventory (per spec §5.2):
//   - useCodex()             high-level Codex state + actions
//   - useActiveWallet()      active kadena/ouro wallet + switch
//   - useGetKeypair()        the function that throws CodexKeyMissingError
//   - useSignTransaction()   CFM strategy wrapper
//   - useCodexAuth()         password prompts, lock/unlock, change-password
//   - useKadenaSeeds()       CRUD
//   - usePureKeypairs()      CRUD
//   - useOuroAccounts()      CRUD (CodexPrime is protected)
//   - useAddressBook()       CRUD
//   - useCodexBackup()       download / import / cloud-export helpers
//
// Implementation lands in Phase 5 of the modular-codex spec.
// See: stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md §5.2
export {};
