/**
 * AddressBookTab — token-styled, Redux-free port of OuronetUI's
 * AddressBookPage. Full address-book CRUD over `useAddressBook`; no
 * `react-redux` / `wallet-context`. Styled exclusively via `--codex-*`
 * tokens (inline `style`), so a consumer reskins by overriding the tokens.
 *
 * The package address book is tag-agnostic (the codex store does not hold
 * StoicTags — those are chain state), so this tab ships the two persisted
 * entry types: `ouronet` and `stoa`. The StoicTag sub-tab from OuronetUI is
 * intentionally omitted here.
 */

import { useMemo, useState } from "react";
import { useAddressBook } from "../../hooks/useAddressBook.js";
import type { AddressBookEntry } from "../../types/entities.js";

type TabType = AddressBookEntry["type"];

interface TabConfig {
  label: string;
  placeholder: string;
  hint: string;
  emptyTitle: string;
  emptyAction: string;
}

const TAB_CONFIG: Record<TabType, TabConfig> = {
  ouronet: {
    label: "Ouronet",
    placeholder: "Ѻ.recipient-address…",
    hint: "Must start with Ѻ.",
    emptyTitle: "No Ouronet Accounts",
    emptyAction: "Ouronet Account",
  },
  stoa: {
    label: "StoaChain™",
    placeholder: "k:, c:, w: or u: address…",
    hint: "Must start with k:, c:, w: or u:",
    emptyTitle: "No StoaChain™ Addresses",
    emptyAction: "StoaChain™ Address",
  },
};

const TAB_ORDER: TabType[] = ["ouronet", "stoa"];

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface AddressBookTabProps {
  /** Consumer class merged onto the tab root. */
  className?: string;
}

export function AddressBookTab({ className }: AddressBookTabProps) {
  const { entries, addEntry, updateEntry, deleteEntry } = useAddressBook();

  const [activeTab, setActiveTab] = useState<TabType>("ouronet");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const cfg = TAB_CONFIG[activeTab];

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries
      .filter((e) => e.type === activeTab)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q),
      );
  }, [entries, activeTab, searchQuery]);

  const resetForm = () => {
    setFormName("");
    setFormAddress("");
    setFormNotes("");
  };

  const cancelAdd = () => {
    setIsAddingNew(false);
    resetForm();
  };

  const handleSave = () => {
    if (!formName.trim() || !formAddress.trim()) return;
    const now = new Date().toISOString();
    void addEntry({
      id: newId(),
      name: formName.trim(),
      address: formAddress.trim(),
      notes: formNotes.trim() || undefined,
      type: activeTab,
      createdAt: now,
      updatedAt: now,
    });
    cancelAdd();
  };

  const startRename = (entry: AddressBookEntry) => {
    setRenamingId(entry.id);
    setRenameValue(entry.name);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      void updateEntry(renamingId, { name: renameValue.trim() });
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div
      className={className}
      style={{ fontFamily: "var(--codex-font)", color: "var(--codex-text)" }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "4px",
          borderRadius: "var(--codex-radius)",
          backgroundColor: "var(--codex-surface-2)",
          border: "1px solid var(--codex-border)",
          marginBottom: "16px",
        }}
      >
        {TAB_ORDER.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setSearchQuery("");
                cancelAdd();
              }}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: active ? "var(--codex-border)" : "transparent",
                color: active ? "var(--codex-accent)" : "var(--codex-text-dim)",
                border: active
                  ? "1px solid var(--codex-accent)"
                  : "1px solid transparent",
              }}
            >
              {TAB_CONFIG[tab].label}
            </button>
          );
        })}
      </div>

      {/* Search + add */}
      {!isAddingNew && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <input
            aria-label="Search addresses"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, address, or notes…"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "var(--codex-radius)",
              backgroundColor: "var(--codex-surface)",
              border: "1px solid var(--codex-border)",
              color: "var(--codex-text)",
            }}
          />
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--codex-radius)",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: "var(--codex-accent)",
              color: "var(--codex-bg)",
              border: "none",
            }}
          >
            Add Address
          </button>
        </div>
      )}

      {/* Add form */}
      {isAddingNew && (
        <div
          style={{
            backgroundColor: "var(--codex-surface)",
            border: "1px solid var(--codex-border)",
            borderRadius: "var(--codex-radius-lg)",
            padding: "16px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <label
            style={{ fontSize: "12px", color: "var(--codex-text-dim)" }}
          >
            Name
            <input
              aria-label="Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., John's Wallet"
              style={{
                display: "block",
                width: "100%",
                marginTop: "4px",
                padding: "8px 12px",
                borderRadius: "var(--codex-radius)",
                backgroundColor: "var(--codex-surface-2)",
                border: "1px solid var(--codex-border)",
                color: "var(--codex-text)",
              }}
            />
          </label>

          <label
            style={{ fontSize: "12px", color: "var(--codex-text-dim)" }}
          >
            Address
            <input
              aria-label="Address"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder={cfg.placeholder}
              style={{
                display: "block",
                width: "100%",
                marginTop: "4px",
                padding: "8px 12px",
                borderRadius: "var(--codex-radius)",
                backgroundColor: "var(--codex-surface-2)",
                border: "1px solid var(--codex-border)",
                color: "var(--codex-text)",
                fontFamily: "var(--codex-font-mono)",
                fontSize: "13px",
              }}
            />
            <span
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "11px",
                color: "var(--codex-text-dim)",
              }}
            >
              {cfg.hint}
            </span>
          </label>

          <label
            style={{ fontSize: "12px", color: "var(--codex-text-dim)" }}
          >
            Notes (Optional)
            <textarea
              aria-label="Notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              style={{
                display: "block",
                width: "100%",
                marginTop: "4px",
                padding: "8px 12px",
                borderRadius: "var(--codex-radius)",
                backgroundColor: "var(--codex-surface-2)",
                border: "1px solid var(--codex-border)",
                color: "var(--codex-text)",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={!formName.trim() || !formAddress.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--codex-radius)",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: "var(--codex-accent)",
                color: "var(--codex-bg)",
                border: "none",
                opacity: !formName.trim() || !formAddress.trim() ? 0.5 : 1,
              }}
            >
              Save Address
            </button>
            <button
              type="button"
              onClick={cancelAdd}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--codex-radius)",
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "var(--codex-text)",
                border: "1px solid var(--codex-border)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List / empty state */}
      {!isAddingNew &&
        (visible.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 12px",
              backgroundColor: "var(--codex-surface)",
              border: "1px solid var(--codex-border)",
              borderRadius: "var(--codex-radius-lg)",
            }}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--codex-text)",
              }}
            >
              {searchQuery ? "No Results Found" : cfg.emptyTitle}
            </h3>
            <p style={{ color: "var(--codex-text-dim)" }}>
              {searchQuery
                ? "No addresses match your search criteria."
                : `Add your first ${cfg.emptyAction} to get started.`}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {visible.map((entry) => (
              <div
                key={entry.id}
                data-entry-id={entry.id}
                style={{
                  backgroundColor: "var(--codex-surface)",
                  border: "1px solid var(--codex-border)",
                  borderRadius: "var(--codex-radius)",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  {renamingId === entry.id ? (
                    <>
                      <input
                        autoFocus
                        aria-label="Rename entry"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename();
                          if (e.key === "Escape") cancelRename();
                        }}
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--codex-accent)",
                          color: "var(--codex-text)",
                          outline: "none",
                          fontSize: "13px",
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
                      <button
                        type="button"
                        aria-label="Cancel rename"
                        onClick={cancelRename}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--codex-text-dim)",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label="Rename entry"
                        onClick={() => startRename(entry)}
                        style={{
                          background: "none",
                          border: "1px solid var(--codex-border)",
                          borderRadius: "4px",
                          color: "var(--codex-text-dim)",
                          cursor: "pointer",
                          padding: "2px 6px",
                          fontSize: "11px",
                        }}
                      >
                        Rename
                      </button>
                      <span
                        style={{
                          flex: 1,
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--codex-text)",
                        }}
                      >
                        {entry.name}
                      </span>
                    </>
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
                    {entry.address}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={() => void deleteEntry(entry.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--codex-error)",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export default AddressBookTab;
