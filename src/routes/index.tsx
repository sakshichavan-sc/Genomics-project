import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { AlertTriangle, BarChart3, Box, CheckCircle2, ExternalLink, FileText, Hourglass, Info, ArrowRight, ShieldCheck, Zap, MinusCircle, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/dna-hero.jpg";
import { EthIcon } from "@/components/AppShell";
import { useRegistry } from "@/hooks/use-registry";
import { shortHex } from "@/lib/passport";
import { useContractAddress } from "@/hooks/use-wallet";
import { useChainRegistry } from "@/hooks/use-chain-registry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Dashboard — GenomeProof" },
      { name: "description", content: "Track, verify and share genomic analysis passports with Ethereum-backed provenance." },
      { property: "og:title", content: "Dashboard — GenomeProof" },
      { property: "og:description", content: "Track, verify and share genomic analysis passports with Ethereum-backed provenance." },
    ],
  }),
  component: Dashboard,
});


function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} mins ago` : m < 1440 ? `${Math.round(m / 60)} hrs ago` : `${Math.round(m / 1440)} days ago`;
}

function Dashboard() {
  const { passports, verifications } = useRegistry();
  const verified = verifications.filter((v) => v.result === "VERIFIED").length;
  const tampered = verifications.filter((v) => v.result === "TAMPERED").length;
  const { activity: chainActivity, status: registry } = useChainRegistry();
  const chainStatus = registry.isPending ? "checking" : registry.isError || chainActivity.isError ? "offline" : "live";
  const chainTotal = chainActivity.data?.length ?? null;
  const stats = { total: passports.length, verified, tampered, onchain: chainTotal ?? 0 };
  const score = stats.verified + stats.tampered ? Math.round((stats.verified / (stats.verified + stats.tampered)) * 100) : 0;
  const contract = useContractAddress();

  const activity = useMemo(() => {
    const live = [
      ...passports.map((p) => ({ kind: "created" as const, title: "Analysis Passport Created", sub: `${p.manifest.analysisId} · ${p.manifest.projectId} · v${p.manifest.version ?? 1}`, at: p.manifest.createdAt })),
      ...(chainActivity.data ?? []).map((p) => ({ kind: "reg" as const, title: "Analysis Passport Registered", sub: `Passport: ${shortHex(p.passportId)} · v${p.version}`, at: new Date(p.registeredAt * 1000).toISOString(), txHash: p.txHash })),
      ...verifications.map((v) => ({ kind: v.result === "VERIFIED" ? ("ok" as const) : v.result === "TAMPERED" ? ("bad" as const) : ("other" as const), title: v.result === "VERIFIED" ? "Verification Successful" : v.result === "TAMPERED" ? "Tampering Detected" : `Verification: ${v.result}`, sub: `Passport: ${v.analysisId}`, at: v.at })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return live.slice(0, 5);
  }, [chainActivity.data, verifications, passports]);

  // Chart values are derived from actual local passport and verification records; no synthetic activity.
  const data = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - i));
      return { date, day: date.toLocaleDateString(undefined, { weekday: "short" }), created: 0, registered: 0, verified: 0, tampered: 0 };
    });
    const indexFor = (iso: string) => {
      const t = new Date(iso).getTime();
      return days.find((d) => { const start = d.date.getTime(); return t >= start && t < start + 86400000; });
    };
    for (const p of passports) { const day = indexFor(p.manifest.createdAt); if (day) day.created += 1; }
    for (const r of chainActivity.data ?? []) { const day = indexFor(new Date(r.registeredAt * 1000).toISOString()); if (day) day.registered += 1; }
    for (const v of verifications) { const day = indexFor(v.at); if (day && v.result === "VERIFIED") day.verified += 1; else if (day && v.result === "TAMPERED") day.tampered += 1; }
    return days.map(({ day, created, registered, verified, tampered }) => ({ day, created, registered, verified, tampered }));
  }, [passports, verifications, chainActivity.data]);

  const cards = [
    { n: stats.total, label: "Total Passports", icon: FileText, tone: "bg-violet/25 text-violet border-violet/30", wrap: "border-violet/30" },
    { n: stats.verified, label: "Verified", icon: ShieldCheck, tone: "bg-success/20 text-success", wrap: "border-success/30" },
    { n: stats.tampered, label: "Tampered", icon: AlertTriangle, tone: "bg-warning/25 text-warning", wrap: "border-warning/30", warn: true },
    { n: chainTotal === null ? "—" : stats.onchain, label: "Total On-Chain Registrations", icon: Box, tone: "bg-info/20 text-info", wrap: "border-info/30" },
  ];

  return (
    <div className="relative">
      <img src={hero} alt="" width={1600} height={640} className="genomic-cover pointer-events-none absolute -top-16 right-0 h-[280px] w-[60%] object-cover opacity-60" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-info"><Dna className="h-4 w-4" />Genomic provenance registry</div>
        <h1 className="text-4xl font-bold">GenomeProof</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">Your analysis records, fingerprints and verification history.</p>
        <Button asChild variant="outline" className="mt-5"><Link to="/create"><Dna />Create passport<ArrowRight /></Link></Button>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className={`panel flex items-center gap-5 p-5 ${c.wrap}`}>
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${c.tone}`}><c.icon className="h-6 w-6" /></div>
              <div className="flex-1">
                <div className="text-3xl font-bold">{c.n}</div>
                <div className="text-sm">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center gap-3">
              <BarChart3 className="h-7 w-7 text-info" />
              <h2 className="text-xl font-bold">Analysis Overview</h2>
              <span className="ml-auto text-sm text-muted-foreground">Last 7 days · Sepolia + local checks</span>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs">
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-chart-4" />Created</span>
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-chart-1" />Registered</span>
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-chart-2" />Verified</span>
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-chart-3" />Tampered</span>
            </div>
            <div className="mt-2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ left: -20, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical horizontal />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} domain={[0, "auto"]} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="registered" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gc)" dot={{ r: 4, fill: "var(--chart-1)" }} />
                  <Area type="monotone" dataKey="verified" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#gv)" dot={{ r: 4, fill: "var(--chart-2)" }} />
                  <Line type="monotone" dataKey="created" stroke="var(--chart-4)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--chart-4)" }} />
                  <Line type="monotone" dataKey="tampered" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--chart-3)" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><span className={`h-2 w-2 rounded-full ${chainStatus === "live" ? "status-live bg-success" : "bg-warning"}`} />Blockchain Status</h2>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <EthIcon className="h-16 w-11" />
              <span className="text-lg font-semibold">Ethereum Sepolia</span>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${chainStatus === "live" ? "bg-success text-success-foreground" : chainStatus === "checking" ? "bg-info/20 text-info" : "bg-warning/20 text-warning"}`}>{chainStatus === "live" ? registry.data?.paused ? "Paused" : "Live" : chainStatus === "checking" ? "Checking…" : "RPC unavailable"}</span>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between"><dt className="flex items-center gap-2 text-muted-foreground"><Info className="h-4 w-4" />Contract Address</dt><dd className="flex items-center gap-2 font-mono">{contract ? shortHex(contract, 6, 4) : "Not configured"}<ExternalLink className="h-4 w-4 text-info" /></dd></div>
                          </dl>
            <a href={contract ? `https://sepolia.etherscan.io/address/${contract}` : "https://sepolia.etherscan.io"} target="_blank" rel="noreferrer" className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-border bg-background/40 py-2.5 text-sm hover:bg-accent">View on Etherscan <ArrowRight className="h-4 w-4" /></a>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="panel p-6">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 fill-warning text-warning" />
              <h2 className="text-lg font-bold">Recent Activity</h2>
              <Link to="/passports" className="ml-auto flex items-center gap-1 text-sm font-semibold text-info">View All <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ol className="mt-5 space-y-5 border-l border-border pl-6">
              {activity.length === 0 && <li className="text-sm text-muted-foreground">No analysis activity yet.</li>}
              {activity.map((a, i) => (
                <li key={i} className="relative flex flex-wrap items-start gap-2">
                  <span className={`absolute -left-[37px] grid h-6 w-6 place-items-center rounded-full ${a.kind === "bad" ? "bg-warning text-warning-foreground" : a.kind === "other" ? "bg-muted text-muted-foreground" : "bg-success text-success-foreground"}`}>
                    {a.kind === "bad" ? <AlertTriangle className="h-3.5 w-3.5" /> : a.kind === "other" ? <MinusCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{a.title}</div>
                    <div className="break-words text-sm text-muted-foreground">{a.sub} • {ago(a.at)}</div>
                  </div>
                  {"txHash" in a ? <a href={`https://sepolia.etherscan.io/tx/${a.txHash}`} target="_blank" rel="noreferrer" className="ml-auto text-sm text-info">View Tx</a> : a.kind === "created" ? <Link to="/passports" className="text-sm text-info">View passport</Link> : <Link to="/verify" className="ml-auto flex items-center gap-1 text-sm font-medium text-info">
                    {a.kind === "ok" ? "View Report" : "View Details"} <ExternalLink className="h-4 w-4" />
                  </Link>}
                </li>
              ))}
            </ol>
          </section>

          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Hourglass className="h-6 w-6 text-info" />Your Genomic Integrity Score <Info className="h-4 w-4 text-muted-foreground" /></h2>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <div className="relative h-36 w-36 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" className="fill-none stroke-muted" strokeWidth="9" />
                  <circle cx="50" cy="50" r="42" className="fill-none stroke-success" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(score / 100) * 264} 264`} />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-3xl font-bold">{score}%</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">{stats.verified + stats.tampered === 0 ? "No checks yet" : score >= 90 ? "Excellent!" : score >= 70 ? "Good" : "Needs attention"}</div>
                <p className="mt-2 text-sm text-muted-foreground">Share of matched versus tampered verification results. This reflects artifact integrity, not scientific validity.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
