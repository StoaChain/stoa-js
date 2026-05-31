/**
 * CodexSettingsSection specs (Phase 15, T15.4).
 *
 * The assembled section composes all eight cards (Info, ChangePassword,
 * Download, Encryption, ExperimentalCurves, CodexIdentity, CodexGuard,
 * ConsumerSettings) under one root. Pins: every card renders, the
 * change-password / upgrade seams thread through to the section's props, and
 * NO Google Drive sync card is present (it stays in OuronetUI). Phase-14 harness.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { CodexProvider } from "@stoachain/ouronet-codex/provider";
import { MemoryCodexAdapter } from "@stoachain/ouronet-codex/adapters";
import { useCodex } from "@stoachain/ouronet-codex/hooks";
import { CodexSettingsSection } from "@stoachain/ouronet-codex/ui";

function ReadyGate() {
  const { isReady } = useCodex();
  return <span data-testid="ready">{isReady ? "yes" : "no"}</span>;
}

async function renderSection(
  props: React.ComponentProps<typeof CodexSettingsSection> = {},
) {
  const adapter = new MemoryCodexAdapter("dev");
  const utils = render(
    <CodexProvider adapter={adapter}>
      <ReadyGate />
      <CodexSettingsSection {...props} />
    </CodexProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("ready").textContent).toBe("yes"),
  );
  return utils;
}

describe("<CodexSettingsSection>", () => {
  it("renders all the codex settings cards under one section", async () => {
    await renderSection();
    expect(screen.getByText("Codex Info")).toBeTruthy();
    // "Change Password" appears as both heading + collapsed-trigger button —
    // assert the trigger (the affordance the user actually clicks).
    expect(
      screen.getByRole("button", { name: /change password/i }),
    ).toBeTruthy();
    expect(screen.getByText("Download Codex")).toBeTruthy();
    // "Encryption" also appears as a CodexInfo row label, so assert the
    // EncryptionCard's unique sub-copy instead.
    expect(screen.getByText("Manage encryption level")).toBeTruthy();
    expect(screen.getByText("Codex Identity")).toBeTruthy();
    expect(screen.getByText("CodexGuard")).toBeTruthy();
    // Experimental section + consumer card present too.
    expect(
      screen.getByRole("button", { name: /enable experimental curves/i }),
    ).toBeTruthy();
  });

  it("does NOT render any Google Drive sync card (that stays redux-bound in OuronetUI)", async () => {
    await renderSection();
    expect(screen.queryByText(/google drive/i)).toBeNull();
    expect(screen.queryByText(/link google/i)).toBeNull();
    expect(screen.queryByText(/save to google/i)).toBeNull();
  });

  it("threads onChangePassword through to the embedded ChangePasswordCard seam", async () => {
    const onChangePassword = vi.fn().mockResolvedValue(undefined);
    await renderSection({ onChangePassword });

    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "old-pass" },
    });
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: "fresh-pass-1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm/i), {
      target: { value: "fresh-pass-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^submit/i }));

    await waitFor(() =>
      expect(onChangePassword).toHaveBeenCalledWith({
        currentPassword: "old-pass",
        newPassword: "fresh-pass-1",
      }),
    );
  });

  it("uses the provided consumerName for the embedded ConsumerSettingsCard", async () => {
    await renderSection({ consumerName: "Mnemosyne" });
    expect(screen.getByText(/Consumer Settings — Mnemosyne/)).toBeTruthy();
  });
});
