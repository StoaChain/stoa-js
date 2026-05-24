// @stoachain/ouronet-codex/components
//
// Headless React components consumers theme with their own design tokens.
// Each accepts className + render-prop slots; no CSS dependencies.
//
// Inventory (per spec §5.3 + §2.5 F1-F4):
//   - <PasswordModal>             auto-renders when getCurrentPassword()
//                                 needs input; opt-out via provider prop
//   - <BackupRestorePanel>        download codex JSON / restore from file
//   - <AddPureKeypairForm>        import a raw private key as a foreign key
//   - <ActiveWalletPicker>        switch between kadena seeds / accounts
//   - <CodexInfoPanel>            read-only stats (counts of each entity)
//   - <RotateGuardModal>          CFM modal for ouro-account guard rotation
//   - <RotatePaymentKeyModal>     CFM modal for payment-key rotation
//   - <RotateSovereignModal>      CFM modal for smart-account sovereign
//   - <RotateGovernorModal>       CFM modal for smart-account governor
//
// The rotate-* modals are the on-chain operations that make this package
// depend on ouronet-core's Pact builders and signing strategy.
//
// Implementation lands in Phase 6 of the modular-codex spec.
// See: stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md §5.3 + §2.5
export {};
