/**
 * CodexTabs — the assembled shell composing the five account tabs into a single
 * switcher. Drop it inside a <CodexProvider> (and, for theming, a <CodexUiRoot>)
 * and it renders the whole Codex management surface.
 *
 * The tab strip mirrors My Codex's big bordered icon tiles (rounded-xl, border-2,
 * h-10 icons, gold active fill — violet for Pure Key Pairs), inline-styled so the
 * package needs no Tailwind. OURO/WSTOA image icons are substituted with lucide
 * equivalents to keep the package asset-free.
 */

import { useState } from "react";
import { Atom, BookKey, KeyRound, Gem, BookOpen } from "lucide-react";
import { OuronetAccountsTab } from "./tabs/OuronetAccountsTab.js";
import { SeedWordsTab } from "./tabs/SeedWordsTab.js";
import { PureKeypairsTab } from "./tabs/PureKeypairsTab.js";
import { StoaAccountsTab } from "./tabs/StoaAccountsTab.js";
import { AddressBookTab } from "./tabs/AddressBookTab.js";

export type CodexTabKey =
  | "ouronet-accounts"
  | "seed-words"
  | "pure-keypairs"
  | "stoa-accounts"
  | "address-book";

interface TabDef {
  key: CodexTabKey;
  label: string;
  Icon: typeof Atom;
  accent: string;
}

const TAB_ORDER: TabDef[] = [
  { key: "ouronet-accounts", label: "Ouronet Accounts", Icon: Atom, accent: "#ceac5f" },
  { key: "seed-words", label: "Seed Words", Icon: BookKey, accent: "#ceac5f" },
  { key: "pure-keypairs", label: "Pure Key Pairs", Icon: KeyRound, accent: "#a78bfa" },
  { key: "stoa-accounts", label: "Stoa Accounts", Icon: Gem, accent: "#ceac5f" },
  { key: "address-book", label: "Address Book", Icon: BookOpen, accent: "#ceac5f" },
];

export interface CodexTabsProps {
  className?: string;
  /** Tab shown on first render. Defaults to "ouronet-accounts". */
  defaultTab?: CodexTabKey;
}

export function CodexTabs({ className, defaultTab = "ouronet-accounts" }: CodexTabsProps) {
  const [active, setActive] = useState<CodexTabKey>(defaultTab);

  return (
    <div
      className={className}
      style={{
        fontFamily: "var(--codex-font, inherit)",
        color: "var(--codex-text)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Big bordered icon tabs */}
      <div
        role="tablist"
        aria-label="Codex sections"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
        }}
      >
        {TAB_ORDER.map(({ key, label, Icon, accent }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "12px",
                border: `2px solid ${selected ? accent : "#262626"}`,
                backgroundColor: selected ? accent : "#0a0a0a",
                color: selected ? "#0a0a0a" : "#d2d3d4",
                cursor: "pointer",
                transition: "all 0.2s",
                fontWeight: 600,
              }}
            >
              <Icon style={{ width: 40, height: 40, flexShrink: 0 }} strokeWidth={1.5} />
              <span style={{ fontWeight: 600 }}>{label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active === "ouronet-accounts" && <OuronetAccountsTab />}
        {active === "seed-words" && <SeedWordsTab />}
        {active === "pure-keypairs" && <PureKeypairsTab />}
        {active === "stoa-accounts" && <StoaAccountsTab />}
        {active === "address-book" && <AddressBookTab />}
      </div>
    </div>
  );
}

export default CodexTabs;
