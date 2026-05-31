/**
 * CodexIdentityCard — token-styled view of the codex's double-Apollo identity
 * (v0.3.0+) via `useCodexIdentity`.
 *
 * Gates gracefully: a fresh/legacy codex has no identity (`identity === null`),
 * so the card renders a "claim / migrate to unlock" hint instead of dereferencing
 * a null. When an identity exists, it shows the formatted `₱.…:Π.…` address.
 * Pure delegation — no new logic. Styled via `--codex-*` tokens.
 */

import { useCodexIdentity } from "../../hooks/useCodexIdentity.js";

export interface CodexIdentityCardProps {
  className?: string;
}

export function CodexIdentityCard({ className }: CodexIdentityCardProps) {
  const { identity } = useCodexIdentity();

  return (
    <div
      className={className}
      style={{
        borderRadius: "var(--codex-radius)",
        border: "1px solid var(--codex-border)",
        backgroundColor: "var(--codex-surface-2)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: "var(--codex-font)",
        color: "var(--codex-text)",
      }}
    >
      <p style={{ fontSize: "14px", fontWeight: 600 }}>Codex Identity</p>

      {identity === null ? (
        <p style={{ fontSize: "12px", color: "var(--codex-text-dim)" }}>
          No Codex Identity yet. Migrate this codex to v0.3.0 to claim its
          double-Apollo identity.
        </p>
      ) : (
        <code
          data-testid="identity-formatted"
          style={{
            display: "block",
            wordBreak: "break-all",
            fontSize: "12px",
            fontFamily: "var(--codex-font-mono)",
            color: "var(--codex-accent)",
            backgroundColor: "var(--codex-bg)",
            border: "1px dashed var(--codex-border)",
            borderRadius: "6px",
            padding: "8px",
          }}
        >
          {identity.formatted}
        </code>
      )}
    </div>
  );
}

export default CodexIdentityCard;
