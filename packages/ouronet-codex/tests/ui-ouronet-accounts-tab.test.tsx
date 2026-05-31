/**
 * OuronetAccountsTab specs (Phase 14, T14.5).
 *
 * The richest tab: account cards from `useOuroAccounts`, the rotation flows
 * (reusing the package `./components` Rotate*Modal), CodexPrime delete
 * protection, and the StoicTag pillar.
 *
 * StoicTag is chain state, NOT codex storage — so the tab takes the StoicTag
 * read + claim + release as INJECTED props/callbacks (`stoicTagFor`,
 * `onClaimStoicTag`, `onReleaseStoicTag`). The codex store stays tag-agnostic;
 * the package imports no ouronet-core chain readers here. These specs pin that
 * injection contract.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import { CodexProvider } from "@stoachain/ouronet-codex/provider";
import { MemoryCodexAdapter } from "@stoachain/ouronet-codex/adapters";
import { useCodex, useOuroAccounts } from "@stoachain/ouronet-codex/hooks";
import { OuronetAccountsTab } from "@stoachain/ouronet-codex/ui";
import type { IOuroAccount } from "@stoachain/ouronet-codex/types";

const ouroFx = (over: Partial<IOuroAccount> = {}): IOuroAccount => ({
  id: over.id ?? "o1",
  name: over.name ?? "My Account",
  version: "1.0.0",
  isSmart: over.isSmart ?? false,
  address: over.address ?? "Ѻ.my-account",
  guard: over.guard ?? null,
  kadenaLedger: null,
  publicKey: over.publicKey ?? "p".repeat(64),
  secret: "s",
  backup: "b",
  ...over,
});

function Seeder({ accounts }: { accounts: IOuroAccount[] }) {
  const { addAccount } = useOuroAccounts();
  const { isReady } = useCodex();
  React.useEffect(() => {
    if (isReady) accounts.forEach((a) => void addAccount(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return null;
}

async function renderTab(
  accounts: IOuroAccount[] = [],
  props: React.ComponentProps<typeof OuronetAccountsTab> = {},
) {
  const adapter = new MemoryCodexAdapter("dev");
  const utils = render(
    <CodexProvider adapter={adapter}>
      <Seeder accounts={accounts} />
      <OuronetAccountsTab {...props} />
    </CodexProvider>,
  );
  if (accounts.length > 0) {
    await screen.findByText(accounts[0].name as string);
  } else {
    await waitFor(() => expect(screen.getByText(/No Ouronet accounts/i)).toBeTruthy());
  }
  return utils;
}

describe("<OuronetAccountsTab>", () => {
  it("renders the empty state when the codex holds no ouro accounts", async () => {
    await renderTab([]);
    expect(screen.getByText(/No Ouronet accounts/i)).toBeTruthy();
  });

  it("renders an account card with name and address from useOuroAccounts", async () => {
    await renderTab([ouroFx({ id: "o1", name: "Main", address: "Ѻ.main-acct" })]);
    expect(screen.getByText("Main")).toBeTruthy();
    expect(screen.getByText("Ѻ.main-acct")).toBeTruthy();
  });

  it("opens the rotate-guard modal for an account from its card action", async () => {
    await renderTab([ouroFx({ id: "o1", name: "Rotatable" })]);
    const card = (await screen.findByText("Rotatable")).closest("[data-account-id]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /rotate guard/i }));
    // The RotateGuardModal renders its dialog once opened.
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("blocks deleting the CodexPrime account and surfaces the protection", async () => {
    // First-added account auto-becomes CodexPrime (store invariant).
    await renderTab([ouroFx({ id: "prime", name: "Prime Acct" })]);
    const card = (await screen.findByText("Prime Acct")).closest("[data-account-id]") as HTMLElement;
    // The prime account exposes no delete control.
    expect(within(card).queryByRole("button", { name: /^delete/i })).toBeNull();
  });

  it("offers the claim flow for an untagged account and fires onClaimStoicTag with the account + tag", async () => {
    const onClaimStoicTag = vi.fn();
    await renderTab(
      [
        ouroFx({ id: "prime", name: "Prime Acct" }),
        ouroFx({ id: "o2", name: "Untagged", address: "Ѻ.untagged" }),
      ],
      {
        // No active tag → the claim affordance shows.
        stoicTagFor: (acct) =>
          acct.id === "o2" ? { tag: "", status: "unregistered" } : null,
        onClaimStoicTag,
      },
    );
    const card = (await screen.findByText("Untagged")).closest("[data-account-id]") as HTMLElement;
    fireEvent.change(within(card).getByLabelText(/stoictag name/i), {
      target: { value: "NewTag" },
    });
    fireEvent.click(within(card).getByRole("button", { name: /claim/i }));
    expect(onClaimStoicTag).toHaveBeenCalledWith(
      expect.objectContaining({ id: "o2" }),
      "NewTag",
    );
  });

  it("renders the injected StoicTag display and fires onReleaseStoicTag for an active tag", async () => {
    const onReleaseStoicTag = vi.fn();
    await renderTab(
      [
        ouroFx({ id: "prime", name: "Prime Acct" }),
        ouroFx({ id: "o2", name: "Tagged", address: "Ѻ.tagged" }),
      ],
      {
        stoicTagFor: (acct) =>
          acct.id === "o2" ? { tag: "Hodler", status: "active" } : null,
        onReleaseStoicTag,
      },
    );
    const card = (await screen.findByText("Tagged")).closest("[data-account-id]") as HTMLElement;
    // The injected active tag is displayed via StoicTagDisplay.
    expect(within(card).getByText("Hodler")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: /release/i }));
    expect(onReleaseStoicTag).toHaveBeenCalledWith(
      expect.objectContaining({ id: "o2" }),
    );
  });
});
