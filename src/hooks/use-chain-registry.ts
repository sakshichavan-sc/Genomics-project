import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRegistryActivity, registryStatus } from "@/lib/chain";
import { useContractAddress, useWallet } from "./use-wallet";

export function useChainRegistry() {
  const address = useContractAddress();
  const { account } = useWallet();
  const client = useQueryClient();
  const status = useQuery({ queryKey: ["chain-status", address, account], queryFn: () => registryStatus(address, account), enabled: Boolean(address), refetchInterval: 15000, retry: 1 });
  const activity = useQuery({ queryKey: ["chain-activity", address], queryFn: () => fetchRegistryActivity(address), enabled: Boolean(address), refetchInterval: 15000, retry: 1 });
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["chain-status"] }); void client.invalidateQueries({ queryKey: ["chain-activity"] }); };
    window.addEventListener("genomeproof:chain", refresh);
    return () => window.removeEventListener("genomeproof:chain", refresh);
  }, [client]);
  return { address, status, activity };
}