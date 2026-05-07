// Barrel for the vendored @kadena/client@1.18.3 surface.
// Avoids loading the upstream signing/index.cjs walletconnect re-exports
// (those have been pruned in T2.6 per the Phase 2 T2.7 DROP decision).
// Mirrors upstream lib/index.d.ts via granular .cjs paths so that consumers
// only pay for what they import. Type-only imports from @kadena/types and
// @kadena/chainweb-node-client are retained as Phase 2 peer-deps; Phase 3
// will retarget them to vendored siblings via the import-rewrite sweep.

// Value re-exports — Pact wrapper
export { Pact } from "./pact.cjs";

// Value re-exports — client factory + host URL helper
export { createClient } from "./client/client.cjs";
export { getHostUrl } from "./client/utils/utils.cjs";

// Value re-exports — transaction builder + creator
export { createTransactionBuilder } from "./createTransactionBuilder/createTransactionBuilder.cjs";
export { createTransaction } from "./utils/createTransaction.cjs";

// Value re-exports — Pact error code helper
export { getPactErrorCode } from "./utils/getPactErrorCode.cjs";

// Value re-exports — Pact value helpers (mirrors upstream `export * from './utils/pact-helpers'`)
export { Literal, literal, readKeyset, unpackLiterals } from "./utils/pact-helpers.cjs";
export { parseAsPactValue } from "./utils/parseAsPactValue.cjs";

// Value re-exports — signing helpers (mirrors upstream `export * from './signing'` minus walletconnect)
export { addSignatures } from "./signing/utils/addSignatures.cjs";
export { isSignedTransaction } from "./signing/utils/isSignedTransaction.cjs";
export { createSignWithKeypair } from "./signing/keypair/createSignWithKeypair.cjs";
export {
  signWithChainweaver,
  createSignWithChainweaver,
} from "./signing/chainweaver/signWithChainweaver.cjs";
export {
  createSignWithEckoWallet,
  createEckoWalletSign,
} from "./signing/eckoWallet/signWithEckoWallet.cjs";
export {
  createQuicksignWithEckoWallet,
  createEckoWalletQuicksign,
} from "./signing/eckoWallet/quicksignWithEckoWallet.cjs";

// Type-only re-exports — Pact / builder
export type { IPact, IPactModules } from "./pact.cjs";
export type { ITransactionBuilder, IBuilder } from "./createTransactionBuilder/createTransactionBuilder.cjs";

// Type-only re-exports — client interfaces
export type {
  ITransactionDescriptor,
  IClient,
  IBaseClient,
  ICreateClient,
  ISubmit,
} from "./client/client.cjs";
export type * from "./client/interfaces/interfaces.cjs";

// Type-only re-exports — pact command + signing-request shapes
export type * from "./interfaces/IPactCommand.cjs";
export type * from "./interfaces/ISigningRequest.cjs";
export type { WithCapability } from "./interfaces/type-utilities.cjs";

// Type-only re-exports — sign function interfaces + ecko types
export type { ISignFunction, ISingleSignFunction } from "./signing/ISignFunction.cjs";
export type {
  EckoStatus,
  ICommonEckoFunctions,
  IEckoConnectOrStatusResponse,
  IEckoSignFunction,
  IEckoSignSingleFunction,
} from "./signing/eckoWallet/eckoTypes.cjs";

// Type-only re-exports — pact-helpers reference types
export type { PactReference, PactReturnType } from "./utils/pact-helpers.cjs";

// Type-only re-exports — Pact error codes
export type { PactErrorCode } from "./utils/getPactErrorCode.cjs";

// Type-only re-exports — signing-api v1 wire shapes
export type {
  IQuickSignRequestBody,
  IUnsignedQuicksignTransaction,
  IQuicksignSigner,
  IQuicksignSig,
  IQuicksignResponse,
  IQuicksignResponseOutcomes,
  IQuicksignResponseError,
  IQuicksignResponseCommand,
} from "./signing-api/v1/quicksign.cjs";
export type { ISignBody } from "./signing-api/v1/sign.cjs";

// Type-only re-exports from peer-deps (Phase 2; retargeted to vendored siblings in Phase 3 sweep)
export type { ChainId, ICap, ICommand, IKeyPair, IUnsignedCommand } from "@kadena/types";
export type {
  ClientRequestInit,
  ICommandResult,
  IPollResponse,
  IPreflightResult,
} from "@kadena/chainweb-node-client";
