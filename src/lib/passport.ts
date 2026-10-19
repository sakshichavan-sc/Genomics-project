// GenomeProof Analysis Passport: canonical serialization, hashing, local registry.
// On-chain registration lives in src/lib/chain.ts; localStorage is only a convenience cache.
import type { Registration } from "./chain";

export const SCHEMA_VERSION = "genomeproof.passport.v1";
export const DOMAIN_PREFIX = "GENOMEPROOF:ANALYSIS_PASSPORT:V1:";

export interface PassportManifest {
  schemaVersion: string;
  analysisId: string;
  version?: number;
  projectId: string;
  dataset: { id: string; version: string; sha256: string };
  reference: { id: string; build: string };
  pipeline: { name: string; version: string; source: string };
  parameters: Record<string, string>;
  environment: Record<string, string>;
  output: { sha256: string };
  createdAt: string;
  creator: string;
}

export interface StoredPassport {
  manifest: PassportManifest;
  commitment: string;
  registration?: Registration;
  status: "created" | "registered";
}

export type VerificationResult = "VERIFIED" | "TAMPERED" | "UNREGISTERED" | "UNAUTHORIZED" | "INVALID_PACKAGE" | "INCONCLUSIVE";

export interface VerificationRecord {
  id: string;
  analysisId: string;
  result: VerificationResult;
  at: string;
  checks: { label: string; ok: boolean | null; detail: string }[];
}

// Deterministic canonical JSON: sorted object keys, no whitespace, NFC strings.
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numbers are not allowed");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
  }
  throw new Error("Unsupported value type");
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256File(file: File) {
  return sha256Hex(await file.arrayBuffer());
}

export async function computeCommitment(m: PassportManifest) {
  return "0x" + (await sha256Hex(DOMAIN_PREFIX + canonicalize(m)));
}

const HEX64 = /^[0-9a-f]{64}$/;
export function validateManifest(m: PassportManifest): string[] {
  const errs: string[] = [];
  if (!m || typeof m !== "object") return ["Manifest must be an object"];
  if (m.schemaVersion !== SCHEMA_VERSION) errs.push("Unsupported schema version");
  if (typeof m.analysisId !== "string" || typeof m.projectId !== "string" || !m.dataset || !m.output || !m.pipeline || !m.reference) return ["Missing required fields"];
  if (m.version !== undefined && (!Number.isInteger(m.version) || m.version < 1 || m.version > 4294967295)) errs.push("Passport version must be an integer between 1 and 4294967295");
  if (!m.analysisId.trim()) errs.push("Analysis ID is required");
  if (!m.projectId.trim()) errs.push("Project ID is required");
  if (!HEX64.test(m.dataset.sha256)) errs.push("Dataset fingerprint must be 64 hex chars");
  if (!HEX64.test(m.output.sha256)) errs.push("Output fingerprint must be 64 hex chars");
  if (!m.pipeline.name || !m.pipeline.version) errs.push("Pipeline name and version required");
  if (!m.reference.build) errs.push("Reference build required");
  if (!/^0x[0-9a-fA-F]{40}$/.test(m.creator ?? "")) errs.push("Creator must be an Ethereum address");
  return errs;
}

// ---------- Local cache (not authoritative) ----------
const KEY = "genomeproof.passports.v1";
const VKEY = "genomeproof.verifications.v1";

const isBrowser = () => typeof window !== "undefined";

export function loadPassports(): StoredPassport[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function savePassports(list: StoredPassport[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("genomeproof:update"));
}
export function createPassport(manifest: PassportManifest, commitment: string) {
  const list = loadPassports();
  if (list.some((p) => p.manifest.projectId.normalize("NFC") === manifest.projectId.normalize("NFC") && p.manifest.analysisId.normalize("NFC") === manifest.analysisId.normalize("NFC") && (p.manifest.version ?? 1) === (manifest.version ?? 1))) {
    throw new Error("This project, analysis and version already exists");
  }
  const passport: StoredPassport = { manifest, commitment, status: "created" };
  savePassports([passport, ...list]);
  return passport;
}
export function loadVerifications(): VerificationRecord[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(VKEY) || "[]"); } catch { return []; }
}
export function addVerification(v: VerificationRecord) {
  localStorage.setItem(VKEY, JSON.stringify([v, ...loadVerifications()].slice(0, 200)));
  window.dispatchEvent(new Event("genomeproof:update"));
}

export function updatePassport(commitment: string, patch: Partial<StoredPassport>) {
  const list = loadPassports();
  const p = list.find((x) => x.commitment === commitment);
  if (!p) throw new Error("Passport not found");
  Object.assign(p, patch);
  savePassports(list);
  return p;
}

export const PACKAGE_VERSION = "genomeproof.package.v1";
export interface VerificationPackage {
  packageVersion: string;
  manifest: PassportManifest;
  commitment: string;
  network: { chainId: number; contract: string };
  passportKey: string;
  registration?: { txHash: string; block: number; registrar: string };
  instructions: string;
}
export function buildPackage(p: StoredPassport): VerificationPackage {
  if (!p.registration) throw new Error("Register the passport before exporting a verification package");
  return {
    packageVersion: PACKAGE_VERSION, manifest: p.manifest, commitment: p.commitment,
    network: { chainId: p.registration.chainId, contract: p.registration.contract }, passportKey: p.registration.passportKey,
    registration: { txHash: p.registration.txHash, block: p.registration.block, registrar: p.registration.registrar },
    instructions: "Open GenomeProof > Verify Passport, upload this file and the output artifact. The verifier recomputes SHA-256 fingerprints and the domain-separated commitment, then compares them with AnalysisPassportRegistry.getPassport(projectIdHash, analysisIdHash, version) on Sepolia.",
  };
}

export function downloadJson(name: string, data: unknown) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = name; a.click();
}

export function shortHex(h: string, a = 6, b = 4) {
  return h.length > a + b + 3 ? `${h.slice(0, a)}...${h.slice(-b)}` : h;
}
