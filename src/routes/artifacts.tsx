import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/AppShell";
import { useRegistry } from "@/hooks/use-registry";

export const Route = createFileRoute("/artifacts")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Research Artifacts — GenomeProof" },
      { name: "description", content: "Datasets and outputs fingerprinted across your analysis passports." },
      { property: "og:title", content: "Research Artifacts — GenomeProof" },
      { property: "og:description", content: "Fingerprinted datasets and analysis outputs." },
    ],
  }),
  component: ArtifactsPage,
});

function ArtifactsPage() {
  const { passports } = useRegistry();
  const rows = passports.flatMap((p) => [
    { kind: "Dataset", name: `${p.manifest.dataset.id}@${p.manifest.dataset.version}`, hash: p.manifest.dataset.sha256, analysis: p.manifest.analysisId },
    { kind: "Output", name: `${p.manifest.analysisId} output`, hash: p.manifest.output.sha256, analysis: p.manifest.analysisId },
  ]);
  return (
    <div>
      <PageTitle title="Research Artifacts" sub="Every dataset and output fingerprint (SHA-256) declared in your passports." />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 && <div className="panel p-8 text-muted-foreground">No artifacts yet.</div>}
        {rows.map((r, i) => (
          <div key={i} className="panel p-5">
            <div className="flex items-center justify-between"><span className="font-semibold">{r.name}</span><span className={`rounded-full px-2.5 py-0.5 text-xs ${r.kind === "Dataset" ? "bg-info/20 text-info" : "bg-violet/25 text-violet"}`}>{r.kind}</span></div>
            <div className="mt-2 break-all font-mono text-xs text-muted-foreground">{r.hash}</div>
            <div className="mt-2 text-xs">Analysis: {r.analysis}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
