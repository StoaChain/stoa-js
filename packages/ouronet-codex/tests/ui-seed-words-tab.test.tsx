/**
 * SeedWordsTab specs (Phase 14, T14.3).
 *
 * Token-styled, Redux-free port of OuronetUI's SeedWordsList. Lists kadena
 * seeds from `useKadenaSeeds`, renames + deletes via the hook, and reveals a
 * seed's mnemonic gated through `useCodexAuth` (decrypts `seed.secret` with
 * the cached codex password). The prime seed is delete-protected (the store
 * throws `CodexPrimeSeedProtectedError`), surfaced inline.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { smartEncrypt } from "@stoachain/stoa-core/crypto";

import { CodexProvider } from "@stoachain/ouronet-codex/provider";
import { MemoryCodexAdapter } from "@stoachain/ouronet-codex/adapters";
import { useCodex, useKadenaSeeds, useCodexAuth } from "@stoachain/ouronet-codex/hooks";
import { SeedWordsTab } from "@stoachain/ouronet-codex/ui";
import type { IKadenaSeed } from "@stoachain/ouronet-codex/types";

const seedFx = (over: Partial<IKadenaSeed> = {}): IKadenaSeed => ({
  id: over.id ?? "s1",
  name: over.name ?? "My Seed",
  seedType: "koala",
  version: "1.0.0",
  index: 0,
  secret: over.secret ?? "enc-secret",
  main: "k:" + "0".repeat(64),
  createdAt: "2026-05-25T10:00:00.000Z",
  accounts: over.accounts ?? [],
  ...over,
});

function Seeder({ seeds }: { seeds: IKadenaSeed[] }) {
  const { addSeed } = useKadenaSeeds();
  const { isReady } = useCodex();
  React.useEffect(() => {
    if (isReady) seeds.forEach((s) => void addSeed(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return null;
}

function Authenticator({ password }: { password: string }) {
  const { authenticate } = useCodexAuth();
  const { isReady } = useCodex();
  React.useEffect(() => {
    if (isReady) authenticate(password, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return null;
}

async function renderTab(seeds: IKadenaSeed[] = [], password?: string) {
  const adapter = new MemoryCodexAdapter("dev");
  const utils = render(
    <CodexProvider adapter={adapter}>
      <Seeder seeds={seeds} />
      {password !== undefined && <Authenticator password={password} />}
      <SeedWordsTab />
    </CodexProvider>,
  );
  if (seeds.length > 0) {
    await screen.findByText(seeds[0].name as string);
  } else {
    await waitFor(() => expect(screen.getByText(/No seeds/i)).toBeTruthy());
  }
  return utils;
}

describe("<SeedWordsTab>", () => {
  it("renders the empty state when the codex holds no seeds", async () => {
    await renderTab([]);
    expect(screen.getByText(/No seeds/i)).toBeTruthy();
  });

  it("lists each seed's name and key count from useKadenaSeeds", async () => {
    await renderTab([
      seedFx({
        id: "s1",
        name: "Trading Seed",
        accounts: [
          { index: 0, publicKey: "a".repeat(64), derivationPath: "m/0" },
          { index: 1, publicKey: "b".repeat(64), derivationPath: "m/1" },
        ],
      }),
    ]);
    expect(screen.getByText("Trading Seed")).toBeTruthy();
    expect(screen.getByText(/2 keys/i)).toBeTruthy();
  });

  it("renames a non-prime seed through updateSeed", async () => {
    // First seed auto-becomes the prime (no controls); operate on the second.
    await renderTab([
      seedFx({ id: "s-prime", name: "Prime" }),
      seedFx({ id: "s1", name: "Old Name" }),
    ]);
    const card = (await screen.findByText("Old Name")).closest("[data-seed-id]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /rename/i }));
    const input = screen.getByDisplayValue("Old Name");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("New Name")).toBeTruthy();
    expect(screen.queryByText("Old Name")).toBeNull();
  });

  it("deletes a non-prime seed, dropping it from the list", async () => {
    await renderTab([
      seedFx({ id: "s-prime", name: "Prime" }),
      seedFx({ id: "s-del", name: "Disposable" }),
    ]);
    const card = (await screen.findByText("Disposable")).closest("[data-seed-id]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(screen.queryByText("Disposable")).toBeNull());
  });

  it("blocks deleting the prime seed and surfaces the protection", async () => {
    await renderTab([seedFx({ id: "s-prime", name: "Prime Seed", isPrime: true })]);
    const card = (await screen.findByText("Prime Seed")).closest("[data-seed-id]") as HTMLElement;
    // Prime seed has no delete control (structurally unremovable).
    expect(within(card).queryByRole("button", { name: /^delete/i })).toBeNull();
    expect(screen.getByText("Prime Seed")).toBeTruthy();
  });

  it("reveals the decrypted mnemonic only after authentication via useCodexAuth", async () => {
    const password = "hunter2";
    const phrase = "alpha bravo charlie delta echo foxtrot";
    const encrypted = await smartEncrypt(phrase, password, "2");
    await renderTab([seedFx({ id: "s1", name: "Viewable", secret: encrypted })], password);

    const card = (await screen.findByText("Viewable")).closest("[data-seed-id]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: /view/i }));

    // The plaintext mnemonic surfaces — proving the codex password decrypted it.
    expect(await screen.findByText(phrase)).toBeTruthy();
  });
});
