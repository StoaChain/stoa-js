import { describe, it, expect } from "vitest";
import {
  SigningError,
  createSigningError,
  createSimulationError,
  createTimeoutError,
} from "../src/errors/transactionErrors";

describe("REQ-14: SigningError ES2022 Error.cause", () => {
  it("direct constructor — passing cause via 4th arg propagates via Error.cause", () => {
    const inner = new Error("inner cause");
    // SigningError constructor: (message, code, context, originalError?, suggestions?)
    const err = new SigningError("outer message", "TEST_CODE", "test-context", inner);
    expect(err.cause).toBe(inner);
  });

  it("createSigningError factory propagates originalError as Error.cause", () => {
    // createSigningError: (operation, originalError, additionalContext?)
    // Any unrecognised message falls through to GENERIC_SIGNING_ERROR branch
    const inner = new Error("totally unrecognised rpc failure");
    const err = createSigningError("rpc-op", inner);
    expect(err.cause).toBe(inner);
  });

  it("createSimulationError factory wraps simulationResult as Error.cause", () => {
    // createSimulationError: (operation, simulationResult, additionalContext?)
    // Unrecognised message → SIMULATION_FAILED branch; simulationResult stored as originalError
    const sim = { error: { message: "totally unknown sim failure" } };
    const err = createSimulationError("preflight-op", sim);
    expect(err.cause).toBe(sim);
  });

  it("createTimeoutError: when no originalError provided, cause is undefined", () => {
    // createTimeoutError: (operation, timeoutMs, originalError?, additionalContext?)
    // When called without originalError the 3rd arg is absent — cause should be absent/undefined
    const err = createTimeoutError("dirtyRead", 5000);
    expect(err.cause).toBeUndefined();
  });

  it("err instanceof Error AND instanceof SigningError both hold", () => {
    const err = new SigningError("msg", "CODE", "ctx");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SigningError);
  });
});
