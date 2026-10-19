import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { useChainRegistry } from "@/hooks/use-chain-registry";
import { projectKey } from "@/lib/chain";
import { useRegistry } from "@/hooks/use-registry";
import { useContractAddress, useWallet } from "@/hooks/use-wallet";
import { buildPackage, downloadJson, shortHex, updatePassport, type StoredPassport } from "@/lib/passport";
import { EXPLORER, SEPOLIA_CHAIN_ID, friendlyError, registerOnChain, switchToSepolia } from "@/lib/chain";

export const Route = createFileRoute("/passports")({
  head: () => ({
    meta: [
      { title: "Registered Passports — GenomeProof" },
      { name: "description", content: "All analysis passports and their on-chain registration status on Ethereum Sepolia." },
      { property: "og:title", content: "Registered Passports — GenomeProof" },
      { property: "og:description", content: "All analysis passports and their registration status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PassportsPage,
});

function PassportsPage() {
  const { passports } = useRegistry();
  const { activity, status } = useChainRegistry();
  const { account, chainId, connect } = useWallet();
  const contract = useContractAddress();
  const [pending, setPending] = useState<Record<string, string>>({});

  async function reg(p: StoredPassport) {
    try {
      if (!contract) throw new Error("Set the registry contract address in Security & System Info first.");
      if (!account) await connect();
      if (chainId !== SEPOLIA_CHAIN_ID) await switchToSepolia();
      setPending((s) => ({ ...s, [p.commitment]: "Confirm in wallet…" }));
      const r = await registerOnChain(
        { projectId: p.manifest.projectId, analysisId: p.manifest.analysisId, commitment: p.commitment, version: p.manifest.version ?? 1 },
        (h) => setPending((s) => ({ ...s, [p.commitment]: `Pending ${shortHex(h)}` })),
      );
      updatePassport(p.commitment, { registration: r, status: "registered" });
      toast.success(`Registered in block #${r.block}`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setPending((s) => { const n = { ...s }; delete n[p.commitment]; return n; });
    }
  }

  return (
    <div>
      <PageTitle title="Registered Passports" sub="Passports created in this browser. Registration writes the commitment to the AnalysisPassportRegistry contract on Sepolia." />
      {!contract && (
        <div className="panel mb-5 border-warning/40 p-4 text-sm text-warning">
          No registry contract configured. <Link to="/security" className="underline">Set the contract address</Link> to enable registration.
        </div>
      )}
      {status.data?.paused && <p className="mb-4 text-warning">Registrations are currently paused by the registry administrator.</p>}
      {account && status.data && !status.data.registrar && <p className="mb-4 text-warning">This wallet needs registrar authorization before it can submit a transaction. <Link to="/security" className="underline">Registry permissions</Link></p>}
      {passports.length === 0 ? (
        <div className="panel p-10 text-center text-muted-foreground">No passports yet. <Link to="/create" className="text-info">Create one</Link>.</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr className="border-b border-border">
              {["Analysis", "Project", "Pipeline", "Commitment", "Status", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {passports.map((p) => (
                <tr key={p.commitment} className="border-b border-border/50">
                  <td className="px-5 py-4 font-semibold">{p.manifest.analysisId} · v{p.manifest.version ?? 1}</td>
                  <td className="px-5 py-4">{p.manifest.projectId}</td>
                  <td className="px-5 py-4">{p.manifest.pipeline.name}@{p.manifest.pipeline.version}</td>
                  <td className="px-5 py-4 font-mono text-xs">{shortHex(p.commitment, 10, 6)}</td>
                  <td className="px-5 py-4">
                    {p.registration ? <span className="rounded-full bg-success/20 px-2.5 py-1 text-xs font-semibold text-success">Block #{p.registration.block}</span>
                      : pending[p.commitment] ? <span className="flex items-center gap-1 text-xs text-info"><Loader2 className="h-3 w-3 animate-spin" />{pending[p.commitment]}</span>
                      : <span className="rounded-full bg-warning/20 px-2.5 py-1 text-xs font-semibold text-warning">Not registered</span>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-5 py-4 text-right">
                    <Button onClick={() => downloadJson(`${p.manifest.analysisId}.passport.json`, p.manifest)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Manifest</Button>
                    {!p.registration && <Button disabled={!!pending[p.commitment] || status.data?.paused || Boolean(account && status.data && !status.data.registrar)} onClick={() => reg(p)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Register on Sepolia</Button>}
                    {p.registration && (
                      <>
                        <Button onClick={() => downloadJson(`${p.manifest.analysisId}.package.json`, buildPackage(p))} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Export package</Button>
                        <a href={`${EXPLORER}/tx/${p.registration.txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-info">tx {shortHex(p.registration.txHash)}<ExternalLink className="h-3 w-3" /></a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl font-bold">Live Sepolia registrations</h2>
        {activity.isPending ? <p className="mt-4 text-muted-foreground">Loading on-chain activity…</p> : activity.error ? <p className="mt-4 text-destructive">{friendlyError(activity.error)}</p> : activity.data?.length === 0 ? <p className="mt-4 text-muted-foreground">No registrations in this registry yet.</p> : <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm"><thead><tr className="border-b border-border">{["Passport", "Version", "Commitment", "Registrant", "Registered", "Transaction"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
            <tbody>{activity.data?.map((r) => {
              const local = passports.find((p) => projectKey(p.manifest.projectId) === r.projectId && projectKey(p.manifest.analysisId) === r.passportId && (p.manifest.version ?? 1) === r.version);
              return <tr key={r.txHash} className="border-b border-border"><td className="p-3">{local?.manifest.analysisId ?? shortHex(r.passportId)}</td><td className="p-3">{r.version}</td><td className="p-3 font-mono">{shortHex(r.commitment)}</td><td className="p-3 font-mono">{shortHex(r.registrant)}</td><td className="whitespace-nowrap p-3">{new Date(r.registeredAt * 1000).toLocaleString()}</td><td className="p-3"><a href={`${EXPLORER}/tx/${r.txHash}`} target="_blank" rel="noreferrer" className="inline-flex gap-1 text-info">{shortHex(r.txHash)}<ExternalLink className="h-4 w-4" /></a></td></tr>;
            })}</tbody>
          </table>
        </div>}
      </section>
    </div>
  );
}
