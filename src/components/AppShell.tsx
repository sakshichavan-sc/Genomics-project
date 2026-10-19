import { Button } from "@/components/ui/button";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FileText, FlaskConical, Home, Plus, Settings, ShieldCheck, Dna } from "lucide-react";
import { toast } from "sonner";
import { shortHex } from "@/lib/passport";
import { useWallet } from "@/hooks/use-wallet";
import { SEPOLIA_CHAIN_ID, friendlyError, switchToSepolia } from "@/lib/chain";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/create", label: "Create Analysis Passport", icon: Plus },
  { to: "/passports", label: "Registered Passports", icon: FileText },
  { to: "/verify", label: "Verify Passport", icon: ShieldCheck },
  { to: "/artifacts", label: "Research Artifacts", icon: FlaskConical },
  { to: "/security", label: "Security & System Info", icon: Settings },
] as const;

function EthIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 38" className={className} aria-hidden>
      <path d="M12 0 0 19.5 12 26.5 24 19.5Z" className="fill-violet" />
      <path d="M12 0v26.5l12-7Z" className="fill-primary/80" />
      <path d="M0 22 12 38 24 22 12 29Z" className="fill-violet/70" />
    </svg>
  );
}
export { EthIcon };

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen w-full bg-background font-sans text-foreground">
      <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <Link to="/" className="flex items-center gap-3 px-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-info/40 text-info">
            <Dna className="h-7 w-7" />
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-tight">
              Genome<span className="text-info">Proof</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Verifiable Genomic Analysis Provenance</div>
          </div>
        </Link>
        <nav className="mt-10 space-y-1.5">
          {nav.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-4 rounded-xl px-4 py-3.5 text-[15px] transition-colors ${
                  active ? "nav-active font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/40"
                }`}
              >
                <n.icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <WalletPanel />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-10 flex flex-wrap items-center gap-4 px-6 py-5 lg:px-8">
          <nav className="flex w-full min-w-0 gap-3 overflow-x-auto text-sm lg:hidden">{nav.map((n) => <Link key={n.to} to={n.to} className="whitespace-nowrap text-muted-foreground">{n.label}</Link>)}</nav>
          <div className="ml-auto lg:hidden"><WalletPanel compact /></div>
        </header>
        <main className="flex-1 px-6 pb-10 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
    </div>
  );
}

function WalletPanel({ compact }: { compact?: boolean }) {
  const { account, chainId, hasWallet, connect } = useWallet();
  const right = chainId === SEPOLIA_CHAIN_ID;
  const act = async (f: () => Promise<unknown>) => { try { await f(); } catch (e) { toast.error(friendlyError(e)); } };
  if (!account) {
    return (
      <div className={compact ? "" : "panel mt-auto p-4"}>
        {!compact && <div className="mb-3 text-sm text-muted-foreground">{hasWallet ? "No wallet connected" : "No Ethereum wallet detected"}</div>}
        {hasWallet ? (
          <Button onClick={() => act(connect)} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Connect wallet</Button>
        ) : (
          <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground">Install MetaMask</a>
        )}
      </div>
    );
  }
  return (
    <div className={compact ? "flex items-center gap-2 text-sm" : "panel mt-auto p-4"}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {!compact && <div className="text-sm text-muted-foreground">Connected Wallet</div>}
          <div className="font-mono text-sm">{shortHex(account, 6, 4)}</div>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${right ? "bg-success" : "bg-warning"}`} />
      </div>
      {right ? (
        <div className={`flex items-center gap-3 text-sm font-semibold ${compact ? "" : "mt-4"}`}><EthIcon className="h-6 w-6" /> Sepolia Testnet</div>
      ) : (
        <Button onClick={() => act(switchToSepolia)} className={`rounded-lg bg-warning px-3 py-2 text-xs font-semibold text-warning-foreground ${compact ? "" : "mt-4 w-full"}`}>Wrong network — switch to Sepolia</Button>
      )}
    </div>
  );
}
