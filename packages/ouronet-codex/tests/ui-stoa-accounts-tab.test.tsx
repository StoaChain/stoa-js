/**
 * StoaAccountsTab specs (Phase 14, T14.4).
 *
 * Token-styled, Redux-free, read-only derived list. Each seed's accounts and
 * each pure keypair map to a `k:<publicKey>` Stoa address, grouped by their
 * source. No chain balance IO (kept chain-IO-light per the phase constraint) —
 * the tab is a pure projection of `useKadenaSeeds` + `usePureKeypairs`.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { CodexProvider } from "@stoachain/ouronet-codex/provider";
import { MemoryCodexAdapter } from "@stoachain/ouronet-codex/adapters";
import { useCodex, useKadenaSeeds, usePureKeypairs } from "@stoachain/ouronet-codex/hooks";
import { StoaAccountsTab } from "@stoachain/ouronet-codex/ui";
import type { IKadenaSeed, IPureKeypair } from "@stoachain/ouronet-codex/types";

const seedFx = (over: Partial<IKadenaSeed> = {}): IKadenaSeed => ({
  id: over.id ?? "s1",
  name: over.name ?? "My Seed",
  seedType: "koala",
  version: "1.0.0",
  index: 0,
  secret: "enc",
  main: "k:" + "0".repeat(64),
  createdAt: "2026-05-25T10:00:00.000Z",
  accounts: over.accounts ?? [],
  ...over,
});

const kpFx = (over: Partial<IPureKeypair> = {}): IPureKeypair => ({
  id: over.id ?? "kp1",
  label: over.label,
  publicKey: over.publicKey ?? "f".repeat(64),
  encryptedPrivateKey: "enc",
  createdAt: "2026-05-25T10:00:00.000Z",
  ...over,
});

function Seeder({ seeds, pairs }: { seeds: IKadenaSeed[]; pairs: IPureKeypair[] }) {
  const { addSeed } = useKadenaSeeds();
  const { addKeypair } = usePureKeypairs();
  const { isReady } = useCodex();
  React.useEffect(() => {
    if (!isReady) return;
    seeds.forEach((s) => void addSeed(s));
    pairs.forEach((p) => void addKeypair(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return null;
}

async function renderTab(seeds: IKadenaSeed[] = [], pairs: IPureKeypair[] = []) {
  const adapter = new MemoryCodexAdapter("dev");
  const utils = render(
    <CodexProvider adapter={adapter}>
      <Seeder seeds={seeds} pairs={pairs} />
      <StoaAccountsTab />
    </CodexProvider>,
  );
  if (seeds.length === 0 && pairs.length === 0) {
    await waitFor(() =>
      expect(screen.getByText(/No seeds or keys/i)).toBeTruthy(),
    );
  }
  return utils;
}

describe("<StoaAccountsTab>", () => {
  it("renders the empty state when the codex has no seeds or keys", async () => {
    await renderTab([], []);
    expect(screen.getByText(/No seeds or keys/i)).toBeTruthy();
  });

  it("derives a k: address per seed account so the list mirrors useKadenaSeeds", async () => {
    await renderTab([
      seedFx({
        id: "s1",
        name: "Trading",
        accounts: [
          { index: 0, publicKey: "a".repeat(64), derivationPath: "m/0" },
          { index: 1, publicKey: "b".repeat(64), derivationPath: "m/1" },
        ],
      }),
    ]);
    expect(await screen.findByText("Trading")).toBeTruthy();
    expect(screen.getByText("k:" + "a".repeat(64))).toBeTruthy();
    expect(screen.getByText("k:" + "b".repeat(64))).toBeTruthy();
  });

  it("derives a k: address per pure keypair under a Pure Key Pairs group", async () => {
    await renderTab([], [kpFx({ id: "kp1", publicKey: "f".repeat(64) })]);
    expect(await screen.findByText(/Pure Key Pairs/i)).toBeTruthy();
    expect(screen.getByText("k:" + "f".repeat(64))).toBeTruthy();
  });
});
