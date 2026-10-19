import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, CheckCircle2, ArrowRight, Download } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { useWallet } from "@/hooks/use-wallet";
import {
  computeCommitment, createPassport, downloadJson, SCHEMA_VERSION,
  sha256File, validateManifest, type PassportManifest,
} from "@/lib/passport";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Create Analysis Passport — GenomeProof" },
      { name: "description", content: "Package genomic analysis metadata into a cryptographically verifiable passport." },
      { property: "og:title", content: "Create Analysis Passport — GenomeProof" },
      { property: "og:description", content: "Package genomic analysis metadata into a verifiable passport." },
    ],
  }),
  component: CreatePage,
});

const empty = {
  analysisId: "", version: "1",
  projectId: "", datasetId: "", datasetVersion: "1.0.0", datasetHash: "",
  refId: "GRCh38", refBuild: "GRCh38.p14", pipeName: "", pipeVersion: "",
  pipeSource: "", params: "", env: "runtime=browser\nhash=SHA-256", outputHash: "",
};

function parseKv(s: string) {
  return Object.fromEntries(s.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}

function CreatePage() {
  const [f, setF] = useState(empty);
  const [preview, setPreview] = useState<{ manifest: PassportManifest; commitment: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { account, connect } = useWallet();
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });


  async function hashInto(k: "datasetHash" | "outputHash", file?: File) {
    if (!file) return;
    setF((p) => ({ ...p, [k]: "" }));
    const h = await sha256File(file);
    setF((p) => ({ ...p, [k]: h }));
  }

  function build(): PassportManifest {
    return {
      schemaVersion: SCHEMA_VERSION, version: Number(f.version), analysisId: f.analysisId.trim(), projectId: f.projectId.trim(),
      dataset: { id: f.datasetId, version: f.datasetVersion, sha256: f.datasetHash.toLowerCase() },
      reference: { id: f.refId, build: f.refBuild },
      pipeline: { name: f.pipeName, version: f.pipeVersion, source: f.pipeSource },
      parameters: parseKv(f.params), environment: parseKv(f.env),
      output: { sha256: f.outputHash.toLowerCase() }, createdAt: new Date().toISOString(), creator: account,
    };
  }

  async function generate() {
    setBusy(true);
    try {
      const creator = account || await connect();
      if (!creator) throw new Error("Select a wallet account to create a passport.");
      const m = { ...build(), creator };
      const errs = validateManifest(m);
      if (errs.length) throw new Error(errs.join(" • "));
      const commitment = await computeCommitment(m);
      createPassport(m, commitment);
      setPreview({ manifest: m, commitment });
      toast.success("Passport created and saved to your dashboard.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create passport"); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring";
  const F = ({ label, k, mono }: { label: string; k: keyof typeof empty; mono?: boolean }) => (
    <label className="block text-sm"><span className="mb-1 block text-muted-foreground">{label}</span>
      <input type={k === "version" ? "number" : "text"} min={k === "version" ? 1 : undefined} max={k === "version" ? 4294967295 : undefined} step={k === "version" ? 1 : undefined} value={f[k]} onChange={set(k)} className={`${field} ${mono ? "font-mono text-xs" : ""}`} /></label>
  );

  return (
    <div className="max-w-6xl">
      <PageTitle title="Create Analysis Passport" sub="Declare the provenance of a genomic analysis run. Stable fields are hashed into the commitment." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel space-y-4 p-6">
          <h2 className="font-bold">Identity & dataset</h2>
          {F({ label: "Analysis ID", k: "analysisId" })}{F({ label: "Project ID", k: "projectId" })}{F({ label: "Passport version", k: "version" })}
          <div className="grid grid-cols-2 gap-3">{F({ label: "Dataset ID", k: "datasetId" })}{F({ label: "Dataset version", k: "datasetVersion" })}</div>
          {F({ label: "Dataset SHA-256", k: "datasetHash", mono: true })}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-info"><Upload className="h-4 w-4" />Hash a dataset file locally<input type="file" className="hidden" onChange={(e) => hashInto("datasetHash", e.target.files?.[0])} /></label>
          <div className="grid grid-cols-2 gap-3">{F({ label: "Reference genome", k: "refId" })}{F({ label: "Build", k: "refBuild" })}</div>
        </section>
        <section className="panel space-y-4 p-6">
          <h2 className="font-bold">Pipeline & output</h2>
          <div className="grid grid-cols-2 gap-3">{F({ label: "Pipeline name", k: "pipeName" })}{F({ label: "Version", k: "pipeVersion" })}</div>
          {F({ label: "Source / release", k: "pipeSource" })}
          <label className="block text-sm"><span className="mb-1 block text-muted-foreground">Parameters (key=value per line)</span><textarea rows={2} value={f.params} onChange={set("params")} className={`${field} font-mono text-xs`} /></label>
          <label className="block text-sm"><span className="mb-1 block text-muted-foreground">Environment manifest</span><textarea rows={2} value={f.env} onChange={set("env")} className={`${field} font-mono text-xs`} /></label>
          {F({ label: "Output SHA-256", k: "outputHash", mono: true })}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-info"><Upload className="h-4 w-4" />Hash an output file locally<input type="file" className="hidden" onChange={(e) => hashInto("outputHash", e.target.files?.[0])} /></label>
        </section>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Files are hashed in your browser and never uploaded. Avoid uploading identifiable patient data to public repositories or sharing it in exported manifests.</p>
      <Button disabled={busy} onClick={generate} className="mt-4 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground">{busy ? "Creating…" : "Create passport"}</Button>

      {preview && (
        <section className="panel mt-6 p-6">
          <h2 className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5 text-success" />Passport created</h2>
          <dl className="my-4 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Analysis</dt><dd>{preview.manifest.analysisId} · v{preview.manifest.version ?? 1}</dd></div>
            <div><dt className="text-muted-foreground">Project</dt><dd>{preview.manifest.projectId}</dd></div>
            <div><dt className="text-muted-foreground">Pipeline</dt><dd>{preview.manifest.pipeline.name} · {preview.manifest.pipeline.version}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">Commitment</p>
          <p className="mt-1 break-all font-mono text-sm text-success">{preview.commitment}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild><Link to="/passports">Register on Sepolia<ArrowRight /></Link></Button>
            <Button variant="outline" onClick={() => downloadJson(`${preview.manifest.analysisId}.passport.json`, preview.manifest)}><Download />Download passport</Button>
          </div>
        </section>
      )}
    </div>
  );
}
