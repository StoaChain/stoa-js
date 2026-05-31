// @stoachain/ouronet-codex/ui — themeable UI shell for assembled components.
//
// Phase 13 ships the foundation: the `<CodexUiRoot>` token-scope wrapper plus
// the `--codex-*` token contract in `tokens.css` (emitted as
// `@stoachain/ouronet-codex/ui.css`). Phases 14/15 add the visual components
// (tabs, account list, etc.) that style against these tokens via inline
// `style={{ ... var(--codex-*) }}`.
//
// The CSS sheet is a build artifact, not a JS import — consumers load it once
// via `import "@stoachain/ouronet-codex/ui.css"`.

export { CodexUiRoot } from "./CodexUiRoot.js";
export type { CodexUiRootProps } from "./CodexUiRoot.js";

// Phase 14 — assembled, token-styled account tabs.
export { AddressBookTab } from "./tabs/AddressBookTab.js";
export type { AddressBookTabProps } from "./tabs/AddressBookTab.js";
export { PureKeypairsTab } from "./tabs/PureKeypairsTab.js";
export type { PureKeypairsTabProps } from "./tabs/PureKeypairsTab.js";
export { SeedWordsTab } from "./tabs/SeedWordsTab.js";
export type { SeedWordsTabProps } from "./tabs/SeedWordsTab.js";
export { StoaAccountsTab } from "./tabs/StoaAccountsTab.js";
export type { StoaAccountsTabProps } from "./tabs/StoaAccountsTab.js";
export { OuronetAccountsTab } from "./tabs/OuronetAccountsTab.js";
export type {
  OuronetAccountsTabProps,
  StoicTagView,
} from "./tabs/OuronetAccountsTab.js";
export { StoicTagDisplay } from "./StoicTagDisplay.js";
export type { StoicTagDisplayProps } from "./StoicTagDisplay.js";

// Phase 14 — the assembled shell composing all five tabs.
export { CodexTabs } from "./CodexTabs.js";
export type { CodexTabsProps, CodexTabKey } from "./CodexTabs.js";
