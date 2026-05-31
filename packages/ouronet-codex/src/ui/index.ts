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
