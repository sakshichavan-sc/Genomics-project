import { describe, expect, it, vi, beforeEach } from "vitest";
import { Interface, keccak256, toUtf8Bytes } from "ethers";
import { DEFAULT_REGISTRY_ADDRESS, REGISTRY_ABI, registrationArgs, fetchRecord, getReadProvider } from "@/lib/chain";
import { validateManifest, SCHEMA_VERSION, type PassportManifest } from "@/lib/passport";

describe("deployed registry integration", () => {
  it("handles the deployed missing-passport revert as an absent record", async () => {
    const call = vi.spyOn(getReadProvider(), "call").mockRejectedValueOnce(Object.assign(new Error("Passport not found"), { code: "CALL_EXCEPTION", reason: "Passport not found" }));
    try { expect(await fetchRecord("P", "A", 1, DEFAULT_REGISTRY_ADDRESS)).toBeNull(); }
    finally { call.mockRestore(); }
  });
  it("preserves RPC failures instead of reporting missing records", async () => {
    const call = vi.spyOn(getReadProvider(), "call").mockRejectedValueOnce(new Error("RPC unavailable"));
    try { await expect(fetchRecord("P", "A", 1, DEFAULT_REGISTRY_ADDRESS)).rejects.toThrow("RPC unavailable"); }
    finally { call.mockRestore(); }
  });
  it("uses the supplied replacement address", () => {
    expect(DEFAULT_REGISTRY_ADDRESS).toBe("0xc1576223D05dCCB7888446cC7682cE0A5592EC51");
  });
  it("encodes the deployed four-argument registration with normalized IDs", () => {
    const args = registrationArgs({ projectId: "Project", analysisId: "e\u0301", version: 2, commitment: "0x" + "a".repeat(64) });
    expect(args).toEqual([keccak256(toUtf8Bytes("Project")), keccak256(toUtf8Bytes("é")), 2, "0x" + "a".repeat(64)]);
    const iface = new Interface(REGISTRY_ABI);
    const encoded = iface.encodeFunctionData("registerPassport", args);
    expect(iface.decodeFunctionData("registerPassport", encoded)[2]).toBe(2n);
  });
  it("defaults legacy passports to version 1", () => {
    expect(registrationArgs({ projectId: "P", analysisId: "A", commitment: "0x" + "a".repeat(64) })[2]).toBe(1);
  });
  it("rejects invalid uint32 versions before requesting a wallet signature", () => {
    for (const version of [0, -1, 1.5, 4294967296, NaN]) {
      expect(() => registrationArgs({ projectId: "P", analysisId: "A", commitment: "0x" + "a".repeat(64), version })).toThrow();
    }
    expect(registrationArgs({ projectId: "P", analysisId: "A", commitment: "0x" + "a".repeat(64), version: 4294967295 })[2]).toBe(4294967295);
  });
});