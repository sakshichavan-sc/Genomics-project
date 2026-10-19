import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/AppShell";
import { useState } from "react";
import { toast } from "sonner";
import { DOMAIN_PREFIX, SCHEMA_VERSION } from "@/lib/passport";
import { EXPLORER, RPC_URL, setContractAddress, contractDeployed } from "@/lib/chain";
import { RegistryControls } from "@/components/RegistryControls";
import { useContractAddress } from "@/hooks/use-wallet";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Security & System Info — GenomeProof" },
      { name: "description", content: "Commitment scheme, trust model and limitations of GenomeProof." },
      { property: "og:title", content: "Security & System Info — GenomeProof" },
      { property: "og:description", content: "Commitment scheme, trust model and limitations." },
    ],
  }),
  component: SecurityPage,
});

const items: [string, string][] = [
  ["Schema version", SCHEMA_VERSION],
  ["Commitment", `SHA256("${DOMAIN_PREFIX}" ‖ canonical_manifest_bytes)`],
  ["Serialization", "Sorted keys, no whitespace, NFC-normalised UTF-8, finite numbers only"],
  ["File hashing", "SHA-256 computed locally in the browser (Web Crypto); files never leave the device"],
  ["Network", "Ethereum Sepolia (chainId 11155111)"],
  ["Read RPC", RPC_URL],
  ["Passport identity", "keccak256(NFC projectId), keccak256(NFC analysisId), uint32 version — records are immutable"],
  ["Local storage", "Browser cache only; the blockchain is the source of truth"],
];

function SecurityPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle title="Security & System Info" sub="How GenomeProof establishes trust — and what it does not prove." />
      <ContractConfig />
      <RegistryControls />
      <section className="panel divide-y divide-border">
        {items.map(([k, v]) => (
          <div key={k} className="grid gap-1 p-5 md:grid-cols-[200px_1fr]"><span className="text-muted-foreground">{k}</span><span className="break-all font-mono text-sm">{v}</span></div>
        ))}
      </section>
      <section className="panel p-6">
        <h2 className="font-bold">What verification does and doesn't mean</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li><b className="text-foreground">Artifact integrity:</b> the files match their recorded fingerprints.</li>
          <li><b className="text-foreground">Declared provenance:</b> metadata is as the creator declared — not independently attested.</li>
          <li><b className="text-foreground">Signer authenticity:</b> a wallet registered the commitment; wallet ownership does not prove institutional identity.</li>
          <li><b className="text-foreground">Scientific validity:</b> not proven. Results are not medical advice.</li>
          <li>Transaction hashes and block numbers are excluded from the passport fingerprint.</li>
        </ul>
      </section>
    </div>
  );
}

function ContractConfig() {
  const current = useContractAddress();
  const [v, setV] = useState("");
  async function save() {
    try {
      const { registryStatus } = await import("@/lib/chain");
      await registryStatus(v.trim());
      setContractAddress(v.trim());
      toast.success("Registry contract verified on Sepolia");
      setV("");
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <section className="panel p-6">
      <h2 className="font-bold">Registry contract</h2>
      <p className="mt-1 break-all font-mono text-sm">
        {current ? <a className="text-info" href={`${EXPLORER}/address/${current}`} target="_blank" rel="noreferrer">{current}</a> : <span className="text-warning">Not configured</span>}
      </p>
      <div className="mt-4 flex gap-3">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="0x… AnalysisPassportRegistry address" className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:border-ring" />
        <Button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</Button>
      </div>
    </section>
  );
}
