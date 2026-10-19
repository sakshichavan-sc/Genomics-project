import { isAddress, getAddress } from "ethers";
import { computeCommitment, validateManifest, type PassportManifest, type VerificationRecord, type VerificationResult, PACKAGE_VERSION } from "./passport";
import { SEPOLIA_CHAIN_ID, contractDeployed, fetchRecord, getContractAddress, passportKey, readContract, REGISTRAR_ROLE } from "./chain";

type Check = VerificationRecord["checks"][number];

/** Single authoritative verification procedure. Does not use the local cache. */
export async function verifyPackage(raw: string, outputHash?: string, datasetHash?: string): Promise<VerificationRecord> {
  const checks: Check[] = [];
  const done = (result: VerificationResult, analysisId = "unknown"): VerificationRecord =>
    ({ id: crypto.randomUUID(), analysisId, result, at: new Date().toISOString(), checks });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try { parsed = JSON.parse(raw); if (!parsed || typeof parsed !== "object") throw new Error("Expected an object"); } catch { checks.push({ label: "Package is valid JSON", ok: false, detail: "Could not parse JSON" }); return done("INVALID_PACKAGE"); }
  const isPkg = parsed.packageVersion === PACKAGE_VERSION;
  const m = (isPkg ? parsed.manifest : parsed) as PassportManifest;
  const errs = validateManifest(m);
  checks.push({ label: "Passport schema valid", ok: errs.length === 0, detail: errs.join("; ") || m.schemaVersion });
  if (errs.length) return done("INVALID_PACKAGE", (m as PassportManifest)?.analysisId);

  const commitment = await computeCommitment(m);
  const key = passportKey(m.projectId, m.analysisId, m.version ?? 1);
  if (isPkg && parsed.commitment !== commitment) {
    checks.push({ label: "Declared commitment matches manifest", ok: false, detail: `computed ${commitment}` });
    return done("TAMPERED", m.analysisId);
  }

  const local = getContractAddress();
  const net = (parsed.network ?? {}) as { chainId?: number; contract?: string };
  let contract = local;
  if (isPkg) {
    const okChain = net.chainId === SEPOLIA_CHAIN_ID;
    checks.push({ label: "Network is Ethereum Sepolia", ok: okChain, detail: `chainId ${net.chainId}` });
    if (!okChain || !net.contract || !isAddress(net.contract)) return done("INVALID_PACKAGE", m.analysisId);
    contract = getAddress(net.contract);
    const trusted = !local || contract === local;
    checks.push({ label: "Contract matches trusted registry", ok: local ? trusted : null, detail: local ? (trusted ? contract : `package ${contract} ≠ configured ${local}`) : `${contract} (no trusted address configured)` });
    if (!trusted) return done("INVALID_PACKAGE", m.analysisId);
  }
  if (!contract) { checks.push({ label: "Registry address", ok: null, detail: "No contract configured" }); return done("INCONCLUSIVE", m.analysisId); }

  if (outputHash) {
    const ok = outputHash === m.output.sha256;
    checks.push({ label: "Output artifact fingerprint", ok, detail: outputHash });
    if (!ok) return done("TAMPERED", m.analysisId);
  } else checks.push({ label: "Output artifact fingerprint", ok: null, detail: "Not supplied — artifact bytes unchecked" });
  if (datasetHash) {
    const ok = datasetHash === m.dataset.sha256;
    checks.push({ label: "Dataset artifact fingerprint", ok, detail: datasetHash });
    if (!ok) return done("TAMPERED", m.analysisId);
  }

  try {
    if (!(await contractDeployed(contract))) { checks.push({ label: "Registry contract exists", ok: false, detail: `No code at ${contract}` }); return done("INVALID_PACKAGE", m.analysisId); }
    const rec = await fetchRecord(m.projectId, m.analysisId, m.version ?? 1, contract);
    if (!rec) {
      checks.push({ label: "On-chain record found", ok: false, detail: `No record for key ${key}` });
      return done("UNREGISTERED", m.analysisId);
    }
    checks.push({ label: "On-chain record found", ok: true, detail: `Registered ${new Date(rec.registeredAt * 1000).toISOString()}` });
    const match = rec.commitment === commitment;
    checks.push({ label: "Commitment matches on-chain", ok: match, detail: match ? commitment : `computed ${commitment} ≠ on-chain ${rec.commitment}` });
    if (!match) return done("TAMPERED", m.analysisId);
    const authorized = await readContract(contract).hasRole(REGISTRAR_ROLE, rec.registrant);
    checks.push({ label: "Registrant currently authorized", ok: authorized, detail: rec.registrant });
    if (!authorized) return done("UNAUTHORIZED", m.analysisId);
    return done("VERIFIED", m.analysisId);
  } catch (e) {
    checks.push({ label: "Blockchain reachable", ok: null, detail: (e as Error).message?.slice(0, 200) ?? "RPC error" });
    return done("INCONCLUSIVE", m.analysisId);
  }
}
