/**
 * StoicTagDisplay — inscription-style §StoicTag display, token-styled port of
 * OuronetUI's StoicTagDisplay. Renders the bare tag glyphs in the Cinzel
 * display face with the § sigil riding the upper-left.
 *
 * This is display-only: the StoicTag itself is chain state (NOT codex
 * storage), so the OuronetAccountsTab feeds this component the tag string via
 * injected props. The component imports no chain readers.
 *
 * Styled exclusively via `--codex-*` tokens; the green inscription accent uses
 * `--codex-success`.
 */

export interface StoicTagDisplayProps {
  /** Bare tag name (no § sigil). */
  tag: string;
}

export function StoicTagDisplay({ tag }: StoicTagDisplayProps) {
  return (
    <div style={{ position: "relative", width: "100%", paddingTop: "8px" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-6px",
          left: "-2px",
          fontFamily: "var(--codex-font-display)",
          fontWeight: 700,
          fontSize: "32px",
          lineHeight: 1,
          color: "var(--codex-success)",
        }}
      >
        §
      </div>
      <div
        style={{
          width: "100%",
          minHeight: "56px",
          borderRadius: "12px",
          border: "1px solid var(--codex-success)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 12px",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontFamily: "var(--codex-font-display)",
            color: "var(--codex-success)",
            textAlign: "center",
            fontSize: "24px",
            wordBreak: "break-word",
          }}
        >
          {tag}
        </span>
      </div>
    </div>
  );
}

export default StoicTagDisplay;
