/**
 * PureKeypairsTab specs (Phase 14, T14.2).
 *
 * Token-styled, Redux-free port of OuronetUI's PureKeypairsTab. Lists pure
 * keypairs from `usePureKeypairs`, embeds the package `<AddPureKeypairForm>`
 * for import, and deletes via the hook. A protected key (CodexGuard /
 * DuoPurePrime) surfaces the store's `delete-rejected` rejection instead of
 * vanishing — pinning the protection path the OuronetUI source enforced.
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
  // Wait for hydration + any seeded pairs to land.
  if (pairs.length > 0) {
    await screen.findByText(pairs[0].publicKey);
  } else {
    await waitFor(() => expect(screen.getByText(/No pure key pairs/i)).toBeTruthy());
  }
  return utils;
}

describe("<PureKeypairsTab>", () => {
  it("renders the empty state when the codex holds no pure keypairs", async () => {
    await renderTab([]);
    expect(screen.getByText(/No pure key pairs/i)).toBeTruthy();
  });

  it("lists a stored keypair's public key so usePureKeypairs feeds the list", async () => {
    await renderTab([kpFx({ id: "kp-1", label: "Trading", publicKey: "b".repeat(64) })]);
    // The bare 64-hex public key renders verbatim (k: field is a separate node).
    expect(screen.getByText("b".repeat(64))).toBeTruthy();
    expect(screen.getByText("Trading")).toBeTruthy();
  });

  it("embeds the AddPureKeypairForm so a consumer can import a raw private key", async () => {
    await renderTab([]);
    // The form's private-key input is the integration signal.
    expect(screen.getByLabelText(/private key/i)).toBeTruthy();
  });

  it("deletes an unprotected keypair, dropping it from the list", async () => {
    await renderTab([kpFx({ id: "kp-del", publicKey: "c".repeat(64) })]);
    const card = (await screen.findByText("c".repeat(64))).closest(
      "[data-keypair-id]",
    ) as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /delete/i }));
    await waitFor(() =>
      expect(screen.queryByText("c".repeat(64))).toBeNull(),
    );
  });

  it("surfaces the delete-rejected protection for a CodexGuard key instead of removing it", async () => {
    await renderTab([
      kpFx({ id: "kp-guard", publicKey: "d".repeat(64), isCodexGuard: true, label: "CodexGuard" }),
    ]);
    const card = (await screen.findByText("d".repeat(64))).closest(
      "[data-keypair-id]",
    ) as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /delete/i }));
    // The protection message surfaces and the key stays in the list.
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("d".repeat(64))).toBeTruthy();
  });
});
