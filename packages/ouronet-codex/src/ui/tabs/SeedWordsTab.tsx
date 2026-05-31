/**
 * SeedWordsTab — token-styled, Redux-free port of OuronetUI's SeedWordsList.
 *
 * Lists kadena seeds from `useKadenaSeeds`, with per-seed rename + delete +
 * view-mnemonic. The mnemonic reveal is gated through `useCodexAuth`: the tab
 * pulls the cached codex password and decrypts `seed.secret` with
 * `smartDecrypt`. If the codex is locked (no cached password) the reveal
 * surfaces an error rather than exposing anything.
 *
 * The prime seed (`isPrime`) is structurally unremovable — the store throws
 * `CodexPrimeSeedProtectedError` on delete — so the tab omits its delete
 * control entirely (matching OuronetUI's prime-seed lock).
 *
 * Styled exclusively via `--codex-*` tokens; no `react-redux` / `wallet-context`.
 */

import { useState } from "react";
import { smartDecrypt } from "@stoachain/stoa-core/crypto";
import { useKadenaSeeds } from "../../hooks/useKadenaSeeds.js";
import { useCodexAuth } from "../../hooks/useCodexAuth.js";
import type { IKadenaSeed } from "../../types/entities.js";

export interface SeedWordsTabProps {
  className?: string;
}

function SeedRow({
  seed,
  onRename,
  onDelete,
}: {
  seed: IKadenaSeed;
  onRename: (seed: IKadenaSeed, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const { getCurrentPassword } = useCodexAuth();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(seed.name ?? "");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const displayName = seed.name || seed.id;

  const confirmRename = () => {
    if (editName.trim()) onRename(seed, editName.trim());
    setEditing(false);
  };

  const handleView = async () => {
    if (phrase) {
      setPhrase(null);
      return;
    }
    setRevealError(null);
    try {
      const password = getCurrentPassword();
      const plain = await smartDecrypt(seed.secret, password);
      setPhrase(plain);
    } catch {
      setRevealError("Unlock the codex to view this seed phrase.");
    }
  };

  return (
    <div
      data-seed-id={seed.id}
      style={{
        backgroundColor: "var(--codex-surface)",
        border: seed.isPrime
          ? "1px solid var(--codex-accent)"
          : "1px solid var(--codex-border)",
        borderRadius: "var(--codex-radius-lg)",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {editing ? (
          <>
            <input
              autoFocus
              aria-label="Rename seed"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--codex-accent)",
                color: "var(--codex-text)",
                outline: "none",
                fontSize: "14px",
                fontWeight: 600,
              }}
            />
            <button
              type="button"
              aria-label="Confirm rename"
              onClick={confirmRename}
              style={{
                background: "none",
                border: "none",
                color: "var(--codex-success)",
                cursor: "pointer",
              }}
            >
              ✓
            </button>
          </>
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: "14px",
              fontWeight: 600,
              color: seed.isPrime ? "var(--codex-accent)" : "var(--codex-text)",
            }}
          >
            {displayName}
          </span>
        )}
        <span style={{ fontSize: "12px", color: "var(--codex-text-dim)" }}>
          {seed.accounts.length} key{seed.accounts.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          aria-label="View seed words"
          onClick={() => void handleView()}
          style={{
            background: "none",
            border: "1px solid var(--codex-border)",
            borderRadius: "4px",
            color: "var(--codex-text)",
            cursor: "pointer",
            padding: "2px 8px",
            fontSize: "12px",
          }}
        >
          {phrase ? "Hide" : "View"}
        </button>
        {!seed.isPrime && (
          <>
            <button
              type="button"
              aria-label="Rename seed"
              onClick={() => {
                setEditName(seed.name ?? "");
                setEditing(true);
              }}
              style={{
                background: "none",
                border: "1px solid var(--codex-border)",
                borderRadius: "4px",
                color: "var(--codex-text-dim)",
                cursor: "pointer",
                padding: "2px 8px",
                fontSize: "12px",
              }}
            >
              Rename
            </button>
            <button
              type="button"
              aria-label="Delete seed"
              onClick={() => onDelete(seed.id)}
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
          </>
        )}
      </div>

      {phrase && (
        <div
          style={{
            backgroundColor: "var(--codex-bg)",
            border: "1px dashed var(--codex-border)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontFamily: "var(--codex-font-mono)",
            fontSize: "13px",
            color: "var(--codex-text)",
            wordBreak: "break-word",
          }}
        >
          {phrase}
        </div>
      )}

      {revealError && (
        <p
          role="alert"
          style={{ fontSize: "12px", color: "var(--codex-error)", margin: 0 }}
        >
          {revealError}
        </p>
      )}
    </div>
  );
}

export function SeedWordsTab({ className }: SeedWordsTabProps) {
  const { seeds, updateSeed, deleteSeed } = useKadenaSeeds();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleRename = (seed: IKadenaSeed, name: string) => {
    void updateSeed({ ...seed, name });
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    try {
      await deleteSeed(id);
    } catch {
      setDeleteError("This seed is protected and cannot be deleted.");
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
        gap: "8px",
      }}
    >
      {seeds.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 12px",
            color: "var(--codex-text-dim)",
          }}
        >
          No seeds in the codex yet.
        </div>
      ) : (
        seeds.map((seed) => (
          <SeedRow
            key={seed.id}
            seed={seed}
            onRename={handleRename}
            onDelete={(id) => void handleDelete(id)}
          />
        ))
      )}

      {deleteError && (
        <p
          role="alert"
          style={{ fontSize: "12px", color: "var(--codex-error)", margin: 0 }}
        >
          {deleteError}
        </p>
      )}
    </div>
  );
}

export default SeedWordsTab;
