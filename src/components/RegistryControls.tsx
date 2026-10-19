import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pause, Play, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChainRegistry } from "@/hooks/use-chain-registry";
import { useWallet } from "@/hooks/use-wallet";
import { administerRegistry, friendlyError } from "@/lib/chain";

export function RegistryControls() {
  const { status } = useChainRegistry();
  const { account } = useWallet();
  const [registrar, setRegistrar] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = Boolean(account && status.data?.admin.toLowerCase() === account.toLowerCase());
  async function act(action: Parameters<typeof administerRegistry>[0], target?: string) {
    setBusy(true);
    try { await administerRegistry(action, target); toast.success("Registry transaction confirmed"); setRegistrar(""); }
    catch (error) { toast.error(friendlyError(error)); }
    finally { setBusy(false); }
  }
  return (
    <section className="space-y-4 border-y border-border py-6">
      <h2 className="text-lg font-bold">Registry permissions</h2>
      {status.isPending ? <p className="text-muted-foreground">Checking registry…</p> : status.error ? <p className="text-destructive">{friendlyError(status.error)}</p> : <>
        <dl className="grid gap-3 text-sm">
          <div><dt className="text-muted-foreground">Administrator</dt><dd className="break-all font-mono">{status.data?.admin}</dd></div>
          <div><dt className="text-muted-foreground">Registration status</dt><dd className={status.data?.paused ? "text-warning" : "text-success"}>{status.data?.paused ? "Paused" : "Open"}</dd></div>
          <div><dt className="text-muted-foreground">Connected wallet</dt><dd>{!account ? "Not connected" : isAdmin ? "Administrator" : status.data?.registrar ? "Authorized registrar" : "Not authorized to register"}</dd></div>
        </dl>
        {isAdmin && <div className="space-y-3">
          <Button disabled={busy} variant="outline" onClick={() => act(status.data?.paused ? "unpauseRegistrations" : "pauseRegistrations")}>
            {busy ? <Loader2 className="animate-spin" /> : status.data?.paused ? <Play /> : <Pause />}{status.data?.paused ? "Resume registrations" : "Pause registrations"}
          </Button>
          <label className="block text-sm">Registrar wallet<input value={registrar} onChange={(e) => setRegistrar(e.target.value)} placeholder="0x…" className="mt-1 w-full rounded-md border border-input bg-background p-3 font-mono" /></label>
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy || !registrar.trim()} onClick={() => act("authorizeRegistrar", registrar.trim())}><UserPlus />Authorize</Button>
            <Button disabled={busy || !registrar.trim()} variant="destructive" onClick={() => act("revokeRegistrar", registrar.trim())}><UserMinus />Revoke</Button>
          </div>
        </div>}
      </>}
    </section>
  );
}