/**
 * CodexSettingsSection — the assembled, token-styled Codex Settings panel.
 *
 * Composes the eight Phase-15 cards (Info, ChangePassword, Download,
 * Encryption, ExperimentalCurves, CodexIdentity, CodexGuard,
 * ConsumerSettings) into one section, mirroring OuronetUI's Codex Settings
 * layout MINUS the Google Drive sync card (which stays redux/localStorage-bound
 * in OuronetUI and is intentionally excluded here).
 *
 * The card-owned consumer seams (`onChangePassword`, `onUpgradeEncryption`)
 * thread through as section props — the package never re-encrypts or rotates
 * passwords itself; it delegates to the host app. All visual structure uses
 * `--codex-*` tokens. No Redux, no wallet-context.
 */

import { CodexInfoCard } from "./CodexInfoCard.js";
import {
  ChangePasswordCard,
  type ChangePasswordPayload,
} from "./ChangePasswordCard.js";
import { DownloadCodexCard } from "./DownloadCodexCard.js";
import { EncryptionCard } from "./EncryptionCard.js";
import { ExperimentalCurvesCard } from "./ExperimentalCurvesCard.js";
import { CodexIdentityCard } from "./CodexIdentityCard.js";
import { CodexGuardCard } from "./CodexGuardCard.js";
import { ConsumerSettingsCard } from "./ConsumerSettingsCard.js";

export interface CodexSettingsSectionProps {
  /** Re-encryption seam forwarded to <ChangePasswordCard>. The package hands
   *  over a validated {currentPassword,newPassword} pair; the host owns the
   *  crypto + persistence. */
  onChangePassword?: (payload: ChangePasswordPayload) => Promise<void> | void;
  /** V1→V2 upgrade seam forwarded to <EncryptionCard>. */
  onUpgradeEncryption?: () => Promise<void> | void;
  /** Consumer registry key for the embedded <ConsumerSettingsCard>. Defaults
   *  to "OuronetUI". */
  consumerName?: string;
  /** Consumer class merged onto the section root. */
  className?: string;
}

export function CodexSettingsSection({
  onChangePassword,
  onUpgradeEncryption,
  consumerName = "OuronetUI",
  className,
}: CodexSettingsSectionProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        fontFamily: "var(--codex-font)",
        color: "var(--codex-text)",
      }}
    >
      {/* Action cards row. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        <ChangePasswordCard onChangePassword={onChangePassword} />
        <DownloadCodexCard />
        <EncryptionCard onUpgradeEncryption={onUpgradeEncryption} />
      </div>

      {/* v0.3.0 surfaces — gate gracefully when their slices are empty. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "12px",
        }}
      >
        <CodexIdentityCard />
        <CodexGuardCard />
        <ConsumerSettingsCard consumerName={consumerName} />
      </div>

      {/* Experimental curves — isolated below the day-to-day actions. */}
      <div
        style={{
          borderRadius: "var(--codex-radius)",
          border: "1px solid var(--codex-warning)",
          padding: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--codex-warning)",
            }}
          >
            Experimental Curves
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "1px 8px",
              borderRadius: "999px",
              color: "var(--codex-warning)",
              border: "1px solid var(--codex-warning)",
            }}
          >
            observational
          </span>
        </div>
        <ExperimentalCurvesCard />
      </div>

      <CodexInfoCard />
    </div>
  );
}

export default CodexSettingsSection;
