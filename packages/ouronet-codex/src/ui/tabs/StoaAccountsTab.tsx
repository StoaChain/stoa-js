/**
 * StoaAccountsTab — token-styled, Redux-free, read-only derived Stoa-address
 * list. Every kadena-seed account and every pure keypair maps to its
 * `k:<publicKey>` Stoa address, grouped by source.
 *
 * Intentionally chain-IO-light: unlike OuronetUI's StoaAccountsTab (which
 * batch-reads on-chain balances), this package tab is a pure projection of the
 * codex's `useKadenaSeeds` + `usePureKeypairs`. A consumer that wants live
 * balances composes its own balance reader around the derived addresses,
 * keeping the package free of `@stoachain/ouronet-core` chain readers.
 *
 * Styled exclusively via `--codex-*` tokens; no `react-redux` / `wallet-context`.
 */

import { useMemo } from "react";
import { useKadenaSeeds } from "../../hooks/useKadenaSeeds.js";
import { usePureKeypairs } from "../../hooks/usePureKeypairs.js";

export interface StoaAccountsTabProps {
  className?: string;
}

interface DerivedAddress {
  address: string;
  sublabel: string;
}

interface AddressGroup {
  id: string;
  label: string;
  addresses: DerivedAddress[];
}

export function StoaAccountsTab({ className }: StoaAccountsTabProps) {
  const { seeds } = useKadenaSeeds();
  const { keypairs } = usePureKeypairs();

  const groups = useMemo<AddressGroup[]>(() => {
    const out: AddressGroup[] = [];
    for (const seed of seeds) {
      out.push({
        id: seed.id,
        label: seed.name || seed.id,
        addresses: [...seed.accounts]
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map((acc) => ({
            address: `k:${acc.publicKey}`,
            sublabel: `Key #${acc.index}`,
          })),
      });
    }
    if (keypairs.length > 0) {
      out.push({
        id: "pure",
        label: "Pure Key Pairs",
        addresses: [...keypairs]
          .sort((a, b) => {
            const la = (a.label || "").toLowerCase();
            const lb = (b.label || "").toLowerCase();
            if (!la && !lb) return 0;
            if (!la) return 1;
            if (!lb) return -1;
            return la.localeCompare(lb);
          })
          .map((kp, i) => ({
            address: `k:${kp.publicKey}`,
            sublabel: kp.label ? kp.label : `Pair #${i}`,
          })),
      });
    }
    return out;
  }, [seeds, keypairs]);

  return (
    <div
      className={className}
      style={{
        fontFamily: "var(--codex-font)",
        color: "var(--codex-text)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {groups.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 12px",
            border: "1px dashed var(--codex-border)",
            borderRadius: "var(--codex-radius-lg)",
            color: "var(--codex-text-dim)",
          }}
        >
          No seeds or keys in Codex
        </div>
      ) : (
        groups.map((group) => (
          <div
            key={group.id}
            data-group-id={group.id}
            style={{
              border: "1px solid var(--codex-border)",
              borderRadius: "var(--codex-radius-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                backgroundColor: "var(--codex-surface-2)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--codex-text)",
                }}
              >
                {group.label}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--codex-text-dim)",
                }}
              >
                {group.addresses.length}
              </span>
            </div>

            {group.addresses.length === 0 ? (
              <div
                style={{
                  padding: "12px 16px",
                  fontSize: "12px",
                  color: "var(--codex-text-dim)",
                  backgroundColor: "var(--codex-surface)",
                }}
              >
                No keys in this group
              </div>
            ) : (
              group.addresses.map(({ address, sublabel }) => (
                <div
                  key={address}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    backgroundColor: "var(--codex-surface)",
                    borderTop: "1px solid var(--codex-border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--codex-text-dim)",
                      flexShrink: 0,
                      minWidth: "60px",
                    }}
                  >
                    {sublabel}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "var(--codex-font-mono)",
                      fontSize: "12px",
                      color: "var(--codex-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {address}
                  </span>
                </div>
              ))
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default StoaAccountsTab;
