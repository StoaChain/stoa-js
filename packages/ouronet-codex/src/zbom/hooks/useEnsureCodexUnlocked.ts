/**
 * useEnsureCodexUnlocked — cloned from OuronetUI `hooks/useEnsureCodexUnlocked.ts`.
 *
 * Returns a stable `() => Promise<boolean>` gate the ZBOM modals call before
 * signing: it ensures the codex password is available (prompting if locked) and
 * refreshes the cache TTL, returning false when the user cancels.
 *
 * Data-seam swaps (T2, blueprint §7.2):
 *   - `useWallet().getCurrentPassword` → `useRequestPassword()` (package's
 *     Promise-returning prompt: resolves cached pw or shows <PasswordModal>).
 *   - `useCodex().uiSettings` stays (package's own Zustand-backed useCodex).
 *   - `useCodexAuth().authenticate` stays (refreshes the package's TTL cache).
 */

import { useCallback } from "react";
import { useRequestPassword } from "../../hooks/useRequestPassword.js";
import { useCodexAuth } from "../../hooks/useCodexAuth.js";
import { useCodex } from "../../hooks/useCodex.js";

export function useEnsureCodexUnlocked(): () => Promise<boolean> {
  const requestPassword = useRequestPassword();
  const { authenticate } = useCodexAuth();
  const { uiSettings } = useCodex();

  return useCallback(async () => {
    let pw: string;
    try {
      pw = await requestPassword();
    } catch {
      return false;
    }
    if (!pw) return false;
    authenticate(pw, uiSettings?.passwordCacheMinutes ?? 1);
    return true;
  }, [requestPassword, authenticate, uiSettings?.passwordCacheMinutes]);
}
