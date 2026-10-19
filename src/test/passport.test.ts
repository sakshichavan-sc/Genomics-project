import { describe, expect, it } from "vitest";
import { canonicalize, computeCommitment, createPassport, loadPassports, validateManifest, SCHEMA_VERSION, type PassportManifest } from "@/lib/passport";

const m: PassportManifest = {
  schemaVersion: SCHEMA_VERSION, analysisId: "A", projectId: "P",
  dataset: { id: "d", version: "1", sha256: "a".repeat(64) }, reference: { id: "GRCh38", build: "p14" },
  pipeline: { name: "x", version: "1", source: "s" }, parameters: { b: "2", a: "1" }, environment: {},
  output: { sha256: "b".repeat(64) }, createdAt: "2026-01-01T00:00:00Z", creator: "0x0000000000000000000000000000000000000001",
};

describe("passport", () => {
  it("persists a newly created passport immediately for dashboard reads", async () => {
    localStorage.clear();
    const commitment = await computeCommitment(m);
    createPassport(m, commitment);
    expect(loadPassports()).toEqual([{ manifest: m, commitment, status: "created" }]);
  });
  it("rejects duplicate normalized project-analysis-version identities", async () => {
    localStorage.clear();
    const first = { ...m, analysisId: "e\u0301", version: 1 };
    createPassport(first, await computeCommitment(first));
    expect(() => createPassport({ ...first, analysisId: "é" }, "0xduplicate")).toThrow("already exists");
    expect(loadPassports()).toHaveLength(1);
  });
  it("canonicalizes with sorted keys", () => {
    expect(canonicalize({ b: 1, a: [true, null] })).toBe('{"a":[true,null],"b":1}');
  });
  it("commitment is independent of key order", async () => {
    const reordered = { ...m, parameters: { a: "1", b: "2" } };
    expect(await computeCommitment(reordered)).toBe(await computeCommitment(m));
  });
  it("commitment changes when output fingerprint changes", async () => {
    expect(await computeCommitment({ ...m, output: { sha256: "c".repeat(64) } })).not.toBe(await computeCommitment(m));
  });
  it("validates the manifest schema and required fingerprints", () => {
    expect(validateManifest(m)).toEqual([]);
  });
});
