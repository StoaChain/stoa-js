/**
 * CodexProvider stub tests — verify the Phase 5 minimal provider gives
 * hooks a working store via context, initialises the adapter on mount,
 * and isolates state between separate provider mounts.
 *
 * Phase 7 will add tests for the full provider surface (password modal
 * auto-render, onCodexDirty callback, signingClient override, etc.).
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  CodexProvider,
  useCodexStore,
} from "@stoachain/ouronet-codex/provider";
import { MemoryCodexAdapter } from "@stoachain/ouronet-codex/adapters";

describe("CodexProvider stub (Phase 5)", () => {
  it("provides a store to children via context", async () => {
    const adapter = new MemoryCodexAdapter("dev");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CodexProvider adapter={adapter}>{children}</CodexProvider>
    );
    const { result } = renderHook(() => useCodexStore(), { wrapper });

    expect(result.current).toBeDefined();
    expect(typeof result.current.getState).toBe("function");
  });

  it("auto-initialises the store with the supplied adapter on mount", async () => {
    const adapter = new MemoryCodexAdapter("main");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CodexProvider adapter={adapter} deviceVariant="main">{children}</CodexProvider>
    );
    const { result } = renderHook(() => useCodexStore(), { wrapper });

    await waitFor(() => {
      expect(result.current.getState().ready).toBe(true);
    });
    expect(result.current.getState().adapter).toBe(adapter);
    expect(result.current.getState().deviceVariant).toBe("main");
  });

  it("isolates state between separate provider mounts", async () => {
    const adapterA = new MemoryCodexAdapter("dev");
    const adapterB = new MemoryCodexAdapter("dev");

    const wrapperA = ({ children }: { children: React.ReactNode }) => (
      <CodexProvider adapter={adapterA}>{children}</CodexProvider>
    );
    const wrapperB = ({ children }: { children: React.ReactNode }) => (
      <CodexProvider adapter={adapterB}>{children}</CodexProvider>
    );

    const { result: a } = renderHook(() => useCodexStore(), {
      wrapper: wrapperA,
    });
    const { result: b } = renderHook(() => useCodexStore(), {
      wrapper: wrapperB,
    });

    await waitFor(() => {
      expect(a.current.getState().ready).toBe(true);
      expect(b.current.getState().ready).toBe(true);
    });

    // Two distinct stores, with two distinct adapters.
    expect(a.current).not.toBe(b.current);
    expect(a.current.getState().adapter).toBe(adapterA);
    expect(b.current.getState().adapter).toBe(adapterB);

    // Mutating one doesn't leak into the other.
    act(() => {
      a.current.getState().actions.authenticate("password-A", 60);
    });
    expect(a.current.getState().locked).toBe(false);
    expect(b.current.getState().locked).toBe(true);
  });

  it("useCodexStore throws when called outside a CodexProvider", () => {
    expect(() => renderHook(() => useCodexStore())).toThrow(
      /missing <CodexProvider>/
    );
  });
});
