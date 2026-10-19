import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { verifyPackage } from "@/lib/verify";
import { PageTitle } from "@/components/AppShell";
import { addVerification, downloadJson, sha256File, type VerificationRecord } from "@/lib/passport";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Verify Passport — GenomeProof" },
      { name: "description", content: "Independently verify a genomic analysis passport against its registered commitment." },
      { property: "og:title", content: "Verify Passport — GenomeProof" },
      { property: "og:description", content: "Independently verify a genomic analysis passport." },
    ],
  }),
  component: VerifyPage,
});

const LABEL: Record<VerificationRecord["result"], [string, string]> = {
  VERIFIED: ["VERIFIED — all defined checks passed", "text-success"],
  TAMPERED: ["TAMPERED — a fingerprint or commitment does not match", "text-destructive"],
  UNREGISTERED: ["UNREGISTERED — no matching on-chain record", "text-warning"],
  UNAUTHORIZED: ["UNAUTHORIZED — registrant is not an authorized registrar", "text-destructive"],
  INVALID_PACKAGE: ["INVALID PACKAGE — schema, network or contract check failed", "text-destructive"],
  INCONCLUSIVE: ["INCONCLUSIVE — blockchain or evidence unavailable", "text-warning"],
};

function VerifyPage() {
  const [passFile, setPassFile] = useState<File>();
  const [outFile, setOutFile] = useState<File>();
  const [dataFile, setDataFile] = useState<File>();
  const [report, setReport] = useState<VerificationRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function verify() {
    setErr(""); setReport(null);
    if (!passFile) return setErr("Select a verification package or passport JSON");
    setBusy(true);
    try {
      const r = await verifyPackage(await passFile.text(), outFile && (await sha256File(outFile)), dataFile && (await sha256File(dataFile)));
      addVerification(r); setReport(r);
    } catch (error) { setErr(error instanceof Error ? error.message : "Verification failed. Please retry."); } finally { setBusy(false); }
  }

  const box = "panel flex cursor-pointer flex-col gap-2 p-6 text-sm hover:border-primary/60";
  return (
    <div className="max-w-4xl">
      <PageTitle title="Verify Passport" sub="Recomputes fingerprints in your browser and compares them with the commitment stored on Ethereum Sepolia." />
      <div className="grid gap-5 md:grid-cols-3">
        <label className={box}><span className="font-semibold">Package / passport JSON</span><span className="text-muted-foreground">{passFile?.name ?? "Choose file…"}</span><input type="file" accept=".json" className="hidden" onChange={(e) => setPassFile(e.target.files?.[0])} /></label>
        <label className={box}><span className="font-semibold">Output artifact (recommended)</span><span className="text-muted-foreground">{outFile?.name ?? "Choose file…"}</span><input type="file" className="hidden" onChange={(e) => setOutFile(e.target.files?.[0])} /></label>
        <label className={box}><span className="font-semibold">Dataset artifact (optional)</span><span className="text-muted-foreground">{dataFile?.name ?? "Choose file…"}</span><input type="file" className="hidden" onChange={(e) => setDataFile(e.target.files?.[0])} /></label>
      </div>
      <Button disabled={busy} onClick={verify} className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Verifying…" : "Run verification"}</Button>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      {report && (
        <section className="panel mt-6 p-6">
          <div className={`text-2xl font-bold ${LABEL[report.result][1]}`}>{LABEL[report.result][0]}</div>
          <ul className="mt-4 space-y-3">
            {report.checks.map((c) => (
              <li key={c.label} className="flex gap-3">
                {c.ok === true ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : c.ok === false ? <XCircle className="h-5 w-5 shrink-0 text-destructive" /> : <MinusCircle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                <div><div className="font-medium">{c.label}</div><div className="break-all font-mono text-xs text-muted-foreground">{c.detail}</div></div>
              </li>
            ))}
          </ul>
          <Button onClick={() => downloadJson(`verification-${report.analysisId}.json`, report)} className="mt-5 rounded-lg border border-border px-4 py-2 text-xs">Download report</Button>
          <p className="mt-4 text-xs text-muted-foreground">Verification confirms artifact integrity and the registered declaration only — not scientific or medical validity, and not that the declared experiment was honestly performed.</p>
        </section>
      )}
    </div>
  );
}
