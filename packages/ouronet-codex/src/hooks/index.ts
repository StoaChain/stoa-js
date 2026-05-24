// @stoachain/ouronet-codex/hooks
//
// Public React hooks consumers use to interact with the codex.
//
// Inventory (per spec §5.2 + Phase 5 useWatchList addition):
//   - useCodex()             high-level Codex state + actions
//   - useActiveWallet()      active kadena/ouro wallet + switch
//   - useGetKeypair()        pubkey → IKadenaKeypair (throws CodexKeyMissingError)
//   - useSignTransaction()   CFM strategy wrapper (replaces useCFMStrategy)
//   - useCodexAuth()         password prompts, lock/unlock
//   - useKadenaSeeds()       CRUD
//   - usePureKeypairs()      CRUD
//   - useOuroAccounts()      CRUD (CodexPrime is protected)
//   - useAddressBook()       CRUD
//   - useWatchList()         CRUD (Phase 5 addition, not in spec §5.2)
//   - useCodexBackup()       download / import / cloud-export helpers

export { useCodex } from "./useCodex";
export type { CodexView } from "./useCodex";

export { useActiveWallet } from "./useActiveWallet";
export type { ActiveWalletView } from "./useActiveWallet";

export { useCodexAuth } from "./useCodexAuth";
export type { CodexAuthView } from "./useCodexAuth";

export { useGetKeypair } from "./useGetKeypair";
export type { GetKeypairFn } from "./useGetKeypair";

export { useSignTransaction } from "./useSignTransaction";
export type {
  SignTransactionView,
  UseSignTransactionOptions,
} from "./useSignTransaction";

export { useKadenaSeeds } from "./useKadenaSeeds";
export type { KadenaSeedsView } from "./useKadenaSeeds";

export { usePureKeypairs } from "./usePureKeypairs";
export type { PureKeypairsView } from "./usePureKeypairs";

export { useOuroAccounts } from "./useOuroAccounts";
export type { OuroAccountsView } from "./useOuroAccounts";

export { useAddressBook } from "./useAddressBook";
export type { AddressBookView } from "./useAddressBook";

export { useWatchList } from "./useWatchList";
export type { WatchListView } from "./useWatchList";

export { useCodexBackup } from "./useCodexBackup";
export type { CodexBackupView } from "./useCodexBackup";
