/**
 * CodexTabs — the assembled shell composing the five token-styled account
 * tabs into a single tab switcher. Drop it inside a <CodexProvider> (and,
 * for theming, a <CodexUiRoot>) and it renders the whole Codex management
 * surface: Ouronet accounts, seed words, pure key pairs, Stoa accounts, and
 * the address book.
 *
 * State is local (the active tab); all data flows through the provider hooks
 * each tab consumes. The StoicTag injection props pass straight through to
 * OuronetAccountsTab, keeping the package chain-IO-light.
 *
 * Styled exclusively via `--codex-*` tokens; no `react-redux` / `wallet-context`.
 */

import { useState } from "react";
import { OuronetAccountsTab } from "./tabs/OuronetAccountsTab.js";
import { SeedWordsTab } from "./tabs/SeedWordsTab.js";
import { PureKeypairsTab } from "./tabs/PureKeypairsTab.js";
import { StoaAccountsTab } from "./tabs/StoaAccountsTab.js";
import { AddressBookTab } from "./tabs/AddressBookTab.js";
import type {
  OuronetAccountsTabProps,
  StoicTagView,
} from "./tabs/OuronetAccountsTab.js";
import type { IOuroAccount } from "../types/entities.js";

export type CodexTabKey =
  | "ouronet-accounts"
  | "seed-words"
  | "pure-keypairs"
  | "stoa-accounts"
  | "address-book";

const TAB_ORDER: { key: CodexTabKey; label: string }[] = [
  { key: "ouronet-accounts", label: "Ouronet Accounts" },
  { key: "seed-words", label: "Seed Words" },
  { key: "pure-keypairs", label: "Pure Key Pairs" },
  { key: "stoa-accounts", label: "Stoa Accounts" },
  { key: "address-book", label: "Address Book" },
];

export interface CodexTabsProps {
  className?: string;
  /** Tab shown on first render. Defaults to "ouronet-accounts". */
  defaultTab?: CodexTabKey;
  /** Injected StoicTag resolver — passed through to OuronetAccountsTab. */
  stoicTagFor?: (account: IOuroAccount) => StoicTagView | null;
  /** Injected StoicTag claim callback — passed through. */
  onClaimStoicTag?: OuronetAccountsTabProps["onClaimStoicTag"];
  /** Injected StoicTag release callback — passed through. */
  onReleaseStoicTag?: OuronetAccountsTabProps["onReleaseStoicTag"];
}

export function CodexTabs({
  className,
  defaultTab = "ouronet-accounts",
  stoicTagFor,
  onClaimStoicTag,
  onReleaseStoicTag,
}: CodexTabsProps) {
  const [active, setActive] = useState<CodexTabKey>(defaultTab);

  return (
    <div
      className={className}
      style={{
        fontFamily: "var(--codex-font)",
        color: "var(--codex-text)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        role="tablist"
        aria-label="Codex sections"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          padding: "4px",
          borderRadius: "var(--codex-radius)",
          backgroundColor: "var(--codex-surface-2)",
          border: "1px solid var(--codex-border)",
        }}
      >
        {TAB_ORDER.map(({ key, label }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              style={{
                flex: "1 1 auto",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                backgroundColor: selected ? "var(--codex-border)" : "transparent",
                color: selected ? "var(--codex-accent)" : "var(--codex-text-dim)",
                border: selected
                  ? "1px solid var(--codex-accent)"
                  : "1px solid transparent",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active === "ouronet-accounts" && (
          <OuronetAccountsTab
            stoicTagFor={stoicTagFor}
            onClaimStoicTag={onClaimStoicTag}
            onReleaseStoicTag={onReleaseStoicTag}
          />
        )}
        {active === "seed-words" && <SeedWordsTab />}
        {active === "pure-keypairs" && <PureKeypairsTab />}
        {active === "stoa-accounts" && <StoaAccountsTab />}
        {active === "address-book" && <AddressBookTab />}
      </div>
    </div>
  );
}

export default CodexTabs;
