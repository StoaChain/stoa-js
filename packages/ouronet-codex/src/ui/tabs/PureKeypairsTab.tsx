/**
 * PureKeypairsTab — token-styled, Redux-free port of OuronetUI's
 * PureKeypairsTab. Lists pure keypairs from `usePureKeypairs`, embeds the
 * package `<AddPureKeypairForm>` for import, and deletes via the hook.
 *
 * Delete-protection: the store rejects deleting a CodexGuard / former-guard /
 * DuoPurePrime key (throws `CodexGuardError("delete-rejected")`). The tab
 * catches that rejection and surfaces it inline instead of silently failing —
 * mirroring the OuronetUI source's protected-key handling.
 *
 * Styled exclusively via `--codex-*` tokens; no `react-redux` / `wallet-context`.
 */

import * as React from "react";
import { useMemo, useState } from "react";
import { usePureKeypairs } from "../../hooks/usePureKeypairs.js";
import { AddPureKeypairForm } from "../../components/AddPureKeypairForm.js";
import type { IPureKeypair } from "../../types/entities.js";

const FIELD_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  backgroundColor: "var(--codex-bg)",
  border: "1px dashed var(--codex-border)",
  borderRadius: "6px",
  padding: "6px 8px",
};

const FIELD_LABEL: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--codex-text-dim)",
  flexShrink: 0,
};

function isProtected(kp: IPureKeypair): boolean {
  return (
    kp.isCodexGuard === true ||
    kp.wasCodexGuard === true ||
    kp.isDuoPurePrime === true
  );
}

export interface PureKeypairsTabProps {
  className?: string;
}

export function PureKeypairsTab({ className }: PureKeypairsTabProps) {
  const { keypairs, deleteKeypair } = usePureKeypairs();
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () =>
      [...keypairs].sort((a, b) => {
        const la = (a.label || "").toLowerCase();
        const lb = (b.label || "").toLowerCase();
        if (!la && !lb) return 0;
        if (!la) return 1;
        if (!lb) return -1;
        return la.localeCompare(lb);
      }),
    [keypairs],
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteKeypair(id);
      setErrorById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      setErrorById((prev) => ({
        ...prev,
        [id]:
          e instanceof Error
            ? "This key is protected and cannot be deleted."
            : "Delete failed.",
      }));
    }
  };

  return (
    <div
      className={className}
      style={{
        fontFamily: "var(--codex-font)",
        color: "var(--codex-text)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--codex-text-dim)",
            }}
          >
            Stored Key Pairs ({sorted.length})
          </p>
          {sorted.map((pair, i) => (
            <div
              key={pair.id}
              data-keypair-id={pair.id}
              style={{
                backgroundColor: "var(--codex-surface)",
                border: "1px solid var(--codex-border)",
                borderRadius: "var(--codex-radius)",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--codex-text)",
                  }}
                >
                  Pair #{i}
                </span>
                {pair.label && (
                  <span
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      color: "var(--codex-accent)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {pair.label}
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  aria-label="Delete keypair"
                  onClick={() => void handleDelete(pair.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: isProtected(pair)
                      ? "var(--codex-text-dim)"
                      : "var(--codex-error)",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>

              <div style={FIELD_STYLE}>
                <span style={FIELD_LABEL}>Public Key</span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--codex-font-mono)",
                    fontSize: "12px",
                    color: "var(--codex-accent)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {pair.publicKey}
                </span>
              </div>

              <div style={FIELD_STYLE}>
                <span style={FIELD_LABEL}>k: Account</span>
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
                  k:{pair.publicKey}
                </span>
              </div>

              {errorById[pair.id] && (
                <p
                  role="alert"
                  style={{
                    fontSize: "11px",
                    color: "var(--codex-error)",
                    margin: 0,
                  }}
                >
                  {errorById[pair.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Import a raw private key — reuse the headless package form. */}
      <div
        style={{
          backgroundColor: "var(--codex-surface)",
          border: "1px solid var(--codex-border)",
          borderRadius: "var(--codex-radius)",
          padding: "16px",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--codex-text)",
            marginTop: 0,
          }}
        >
          Add Pure Key Pair
        </p>
        <AddPureKeypairForm />
      </div>

      {sorted.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 12px",
            color: "var(--codex-text-dim)",
          }}
        >
          <p style={{ fontSize: "13px" }}>No pure key pairs yet.</p>
          <p style={{ fontSize: "11px", color: "var(--codex-border)" }}>
            Add keys generated with <code>pact -g</code> above.
          </p>
        </div>
      )}
    </div>
  );
}

export default PureKeypairsTab;
