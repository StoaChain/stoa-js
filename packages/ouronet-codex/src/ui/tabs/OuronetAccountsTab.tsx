/**
 * OuronetAccountsTab — token-styled, Redux-free port of OuronetUI's
 * OuroAccountList. Renders an account card per `useOuroAccounts()` entry with:
 *   - rotation flows reusing the package `./components` Rotate*Modal
 *     (RotateGuard for every account; RotatePaymentKey + RotateSovereign for
 *     smart accounts). RotateGovernor is deferred upstream, so it's not wired.
 *   - CodexPrime delete protection: the prime account exposes no delete control
 *     (the store throws `CodexPrimeProtectedError` on delete).
 *   - the StoicTag pillar.
 *
 * StoicTag is chain state, NOT codex storage. The tab takes the StoicTag read +
 * claim + release as INJECTED props (`stoicTagFor`, `onClaimStoicTag`,
 * `onReleaseStoicTag`), so the package imports no `@stoachain/ouronet-core`
 * chain readers and stays portable. The codex store remains tag-agnostic.
 *
 * Styled exclusively via `--codex-*` tokens; no `react-redux` / `wallet-context`.
 */

import * as React from "react";
import { useState } from "react";
import { useOuroAccounts } from "../../hooks/useOuroAccounts.js";
import {
  RotateGuardModal,
  RotatePaymentKeyModal,
  RotateSovereignModal,
} from "../../components/index.js";
import { StoicTagDisplay } from "../StoicTagDisplay.js";
import type { IOuroAccount } from "../../types/entities.js";

/** A StoicTag view as resolved from chain by the consumer. Injected — the
 *  package never reads chain state for tags. */
export interface StoicTagView {
  /** Bare tag name (no § sigil). */
  tag: string;
  /** Chain-side status of the tag binding. */
  status: "active" | "released" | "unregistered";
}

type RotateKind = "guard" | "paymentKey" | "sovereign";

export interface OuronetAccountsTabProps {
  className?: string;
  /** Resolve the StoicTag bound to an account (chain state). Return null when
   *  the account has no tag. Injected so the package stays chain-IO-light. */
  stoicTagFor?: (account: IOuroAccount) => StoicTagView | null;
  /** Claim a StoicTag for an account. Receives the account + the bare tag. */
  onClaimStoicTag?: (account: IOuroAccount, tag: string) => void;
  /** Release the account's active StoicTag. */
  onReleaseStoicTag?: (account: IOuroAccount) => void;
}

function StoicTagPillar({
  account,
  view,
  onClaim,
  onRelease,
}: {
  account: IOuroAccount;
  view: StoicTagView | null;
  onClaim?: (account: IOuroAccount, tag: string) => void;
  onRelease?: (account: IOuroAccount) => void;
}) {
  const [draft, setDraft] = useState("");
  const isActive = view?.status === "active";

  return (
    <div
      style={{
        marginTop: "10px",
        paddingTop: "10px",
        borderTop: "1px solid var(--codex-border)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {view && isActive ? (
        <>
          <StoicTagDisplay tag={view.tag} />
          {onRelease && (
            <button
              type="button"
              onClick={() => onRelease(account)}
              style={{
                alignSelf: "flex-start",
                padding: "4px 12px",
                borderRadius: "var(--codex-radius)",
                border: "1px solid var(--codex-error)",
                background: "transparent",
                color: "var(--codex-error)",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Release StoicTag
            </button>
          )}
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            aria-label="StoicTag name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="tag name…"
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "var(--codex-radius)",
              backgroundColor: "var(--codex-surface-2)",
              border: "1px solid var(--codex-border)",
              color: "var(--codex-text)",
              fontFamily: "var(--codex-font-mono)",
              fontSize: "13px",
            }}
          />
          {onClaim && (
            <button
              type="button"
              onClick={() => onClaim(account, draft)}
              disabled={!draft.trim()}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--codex-radius)",
                border: "none",
                background: "var(--codex-success)",
                color: "var(--codex-bg)",
                cursor: draft.trim() ? "pointer" : "not-allowed",
                opacity: draft.trim() ? 1 : 0.5,
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Claim StoicTag
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AccountCard({
  account,
  onRotate,
  onDelete,
  stoicTagFor,
  onClaimStoicTag,
  onReleaseStoicTag,
}: {
  account: IOuroAccount;
  onRotate: (account: IOuroAccount, kind: RotateKind) => void;
  onDelete: (id: string) => void;
  stoicTagFor?: (account: IOuroAccount) => StoicTagView | null;
  onClaimStoicTag?: (account: IOuroAccount, tag: string) => void;
  onReleaseStoicTag?: (account: IOuroAccount) => void;
}) {
  const view = stoicTagFor ? stoicTagFor(account) : null;

  return (
    <div
      data-account-id={account.id}
      style={{
        backgroundColor: "var(--codex-surface)",
        border: account.isPrime
          ? "1px solid var(--codex-accent)"
          : "1px solid var(--codex-border)",
        borderRadius: "var(--codex-radius-lg)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            flex: 1,
            fontSize: "14px",
            fontWeight: 600,
            color: account.isPrime ? "var(--codex-accent)" : "var(--codex-text)",
          }}
        >
          {account.name || account.id}
        </span>
        {!account.isPrime && (
          <button
            type="button"
            aria-label="Delete account"
            onClick={() => onDelete(account.id)}
            style={{
              background: "none",
              border: "none",
              color: "var(--codex-error)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Delete
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "var(--codex-bg)",
          border: "1px dashed var(--codex-border)",
          borderRadius: "6px",
          padding: "6px 8px",
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: "var(--codex-font-mono)",
            fontSize: "13px",
            color: "var(--codex-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {account.address}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button
          type="button"
          onClick={() => onRotate(account, "guard")}
          style={rotateBtnStyle}
        >
          Rotate Guard
        </button>
        {account.isSmart && (
          <>
            <button
              type="button"
              onClick={() => onRotate(account, "paymentKey")}
              style={rotateBtnStyle}
            >
              Rotate Payment Key
            </button>
            <button
              type="button"
              onClick={() => onRotate(account, "sovereign")}
              style={rotateBtnStyle}
            >
              Rotate Sovereign
            </button>
          </>
        )}
      </div>

      <StoicTagPillar
        account={account}
        view={view}
        onClaim={onClaimStoicTag}
        onRelease={onReleaseStoicTag}
      />
    </div>
  );
}

const rotateBtnStyle: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: "var(--codex-radius)",
  border: "1px solid var(--codex-border)",
  background: "transparent",
  color: "var(--codex-accent)",
  cursor: "pointer",
  fontSize: "12px",
};

export function OuronetAccountsTab({
  className,
  stoicTagFor,
  onClaimStoicTag,
  onReleaseStoicTag,
}: OuronetAccountsTabProps) {
  const { accounts, deleteAccount } = useOuroAccounts();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rotating, setRotating] = useState<{
    account: IOuroAccount;
    kind: RotateKind;
  } | null>(null);

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    try {
      await deleteAccount(id);
    } catch {
      setDeleteError("This account is protected and cannot be deleted.");
    }
  };

  const closeRotate = () => setRotating(null);

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
      {accounts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 12px",
            border: "1px dashed var(--codex-border)",
            borderRadius: "var(--codex-radius-lg)",
            color: "var(--codex-text-dim)",
          }}
        >
          No Ouronet accounts in the codex yet.
        </div>
      ) : (
        accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onRotate={(acct, kind) => setRotating({ account: acct, kind })}
            onDelete={(id) => void handleDelete(id)}
            stoicTagFor={stoicTagFor}
            onClaimStoicTag={onClaimStoicTag}
            onReleaseStoicTag={onReleaseStoicTag}
          />
        ))
      )}

      {deleteError && (
        <p role="alert" style={{ fontSize: "12px", color: "var(--codex-error)", margin: 0 }}>
          {deleteError}
        </p>
      )}

      <RotateGuardModal
        isOpen={rotating?.kind === "guard"}
        onClose={closeRotate}
        account={rotating?.account}
      />
      <RotatePaymentKeyModal
        isOpen={rotating?.kind === "paymentKey"}
        onClose={closeRotate}
        account={rotating?.account}
      />
      <RotateSovereignModal
        isOpen={rotating?.kind === "sovereign"}
        onClose={closeRotate}
        account={rotating?.account}
      />
    </div>
  );
}

export default OuronetAccountsTab;
