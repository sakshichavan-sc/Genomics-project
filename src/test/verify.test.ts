import { describe, expect, it, vi } from "vitest";
import { computeCommitment, SCHEMA_VERSION, PACKAGE_VERSION, type PassportManifest } from "@/lib/passport";
import { DEFAULT_REGISTRY_ADDRESS } from "@/lib/chain";
import { verifyPackage } from "@/lib/verify";

vi.mock("@/lib/chain", async (original) => {
  const actual = await original<typeof import("@/lib/chain")>();
  return { ...actual, contractDeployed: vi.fn(async () => true), fetchRecord: vi.fn(async () => ({ commitment: await computeCommitment(manifest), registrant: manifest.creator, registeredAt: 1792300000 })), readContract: () => ({ hasRole: async () => true }) };
});
const manifest: PassportManifest = {
  schemaVersion: SCHEMA_VERSION, projectId: "P", analysisId: "A", version: 2,
  dataset: { id: "d", version: "1", sha256: "a".repeat(64) }, output: { sha256: "b".repeat(64) },
  reference: { id: "GRCh38", build: "p14" }, pipeline: { name: "x", version: "1", source: "s" },
  parameters: {}, environment: {}, createdAt: "2026-10-18T07:42:00Z", creator: "0x0000000000000000000000000000000000000001",
};
describe("verification", () => {
  it("verifies a versioned package and supplied fingerprints against the registry", async () => {
    const pkg = { packageVersion: PACKAGE_VERSION, manifest, commitment: await computeCommitment(manifest), network: { chainId: 11155111, contract: DEFAULT_REGISTRY_ADDRESS } };
    expect((await verifyPackage(JSON.stringify(pkg), "b".repeat(64), "a".repeat(64))).result).toBe("VERIFIED");
    const { fetchRecord } = await import("@/lib/chain");
    expect(fetchRecord).toHaveBeenCalledWith("P", "A", 2, DEFAULT_REGISTRY_ADDRESS);
  });
  it("rejects changed artifacts", async () => {
    expect((await verifyPackage(JSON.stringify(manifest), "c".repeat(64))).result).toBe("TAMPERED");
  });
  it("rejects null JSON without crashing", async () => {
    expect((await verifyPackage("null")).result).toBe("INVALID_PACKAGE");
  });
  it("reports an absent passport as unregistered rather than verified", async () => {
    const { fetchRecord } = await import("@/lib/chain");
    vi.mocked(fetchRecord).mockResolvedValueOnce(null);
    expect((await verifyPackage(JSON.stringify(manifest))).result).toBe("UNREGISTERED");
  });
  it("reports network failures as inconclusive", async () => {
    const { fetchRecord } = await import("@/lib/chain");
    vi.mocked(fetchRecord).mockRejectedValueOnce(new Error("RPC unavailable"));
    expect((await verifyPackage(JSON.stringify(manifest))).result).toBe("INCONCLUSIVE");
  });
});