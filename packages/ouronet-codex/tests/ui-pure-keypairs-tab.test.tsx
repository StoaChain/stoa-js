/**
 * PureKeypairsTab specs — updated for the v0.5.x upgraded interface:
 *   • 3 subtabs (List / Generate / Import)
 *   • List rows are EXPANDABLE (Ouronet-Accounts style): a collapsed header
 *     (icon + label + badge) expands to reveal the public key, a password-gated
 *     "View Private Key" reveal, and the delete control.
 *   • Protected keys (CodexGuard / Duo) have their delete DISABLED at the UI.
 *   • Import validates a pasted pair by re-deriving the public key.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import { CodexProvider } from "@stoachain/ouronet-codex/provider";
import { MemoryCodexAdapter } from "@stoachain/ouronet-codex/adapters";
import { useCodex, usePureKeypairs } from "@stoachain/ouronet-codex/hooks";
import { PureKeypairsTab } from "@stoachain/ouronet-codex/ui";
import type { IPureKeypair } from "@stoachain/ouronet-codex/types";

const kpFx = (over: Partial<IPureKeypair> = {}): IPureKeypair => ({
  id: over.id ?? "kp-1",
  label: over.label,
  publicKey: over.publicKey ?? "a".repeat(64),
  encryptedPrivateKey: "enc",
  createdAt: "2026-05-25T10:00:00.000Z",
  ...over,
});

function Seeder({ pairs }: { pairs: IPureKeypair[] }) {
  const { addKeypair } = usePureKeypairs();
  const { isReady } = useCodex();
  React.useEffect(() => {
    if (isReady) pairs.forEach((p) => void addKeypair(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return null;
}

async function renderTab(pairs: IPureKeypair[] = []) {
  const adapter = new MemoryCodexAdapter("dev");
  const utils = render(
    <CodexProvider adapter={adapter}>
      <Seeder pairs={pairs} />
      <PureKeypairsTab />
    </CodexProvider>,
  );
  if (pairs.length > 0) {
    await waitFor(() => expect(document.querySelectorAll("[data-keypair-id]").length).toBe(pairs.length));
  } else {
    await waitFor(() => expect(screen.getByText(/No pure keypairs/i)).toBeTruthy());
  }
  return utils;
}

/** Expand a collapsed keypair row by clicking its header. */
const expandRow = (card: HTMLElement) => fireEvent.click(card.querySelector("div") as HTMLElement);

describe("<PureKeypairsTab>", () => {
  it("renders the empty state + the 3 subtab pills when the codex holds no keypairs", async () => {
    await renderTab([]);
    expect(screen.getByText(/No pure keypairs/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^generate$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^import$/i })).toBeTruthy();
  });

  it("shows a collapsed row by label, expanding to reveal the public key + private-key control", async () => {
    await renderTab([kpFx({ id: "kp-1", label: "Trading", publicKey: "b".repeat(64) })]);
    expect(screen.getByText("Trading")).toBeTruthy();
    // Public key is hidden until expanded.
    expect(screen.queryByText("b".repeat(64))).toBeNull();
    const card = screen.getByText("Trading").closest("[data-keypair-id]") as HTMLElement;
    expandRow(card);
    expect(await within(card).findByText("b".repeat(64))).toBeTruthy();
    expect(within(card).getByRole("button", { name: /show private key/i })).toBeTruthy();
  });

  it("exposes the public+private import inputs under the Import subtab", async () => {
    await renderTab([]);
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    expect(screen.getByPlaceholderText(/private \(secret\) key/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/public key/i)).toBeTruthy();
  });

  it("mints a keypair under the Generate subtab", async () => {
    await renderTab([]);
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    fireEvent.click(screen.getByRole("button", { name: /generate keypair/i }));
    expect(await screen.findByText(/save this private key/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /save to codex/i })).toBeTruthy();
  });

  it("deletes an unprotected keypair from the expanded row", async () => {
    await renderTab([kpFx({ id: "kp-del", publicKey: "c".repeat(64) })]);
    const card = screen.getByText("Pure Key #1").closest("[data-keypair-id]") as HTMLElement;
    expandRow(card);
    fireEvent.click(within(card).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(document.querySelectorAll("[data-keypair-id]").length).toBe(0));
  });

  it("disables deletion for a protected CodexGuard key (UI-level protection)", async () => {
    await renderTab([
      kpFx({ id: "kp-guard", publicKey: "d".repeat(64), isCodexGuard: true, label: "GuardianKey" }),
    ]);
    const card = screen.getByText("GuardianKey").closest("[data-keypair-id]") as HTMLElement;
    expandRow(card);
    expect(within(card).getByRole("button", { name: /cannot be removed/i })).toBeTruthy();
    expect(within(card).queryByRole("button", { name: /^delete$/i })).toBeNull();
    expect(screen.getByText("GuardianKey")).toBeTruthy();
  });
});
