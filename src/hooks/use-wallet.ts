import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";
import { getContractAddress, getInjected } from "@/lib/chain";

export function useWallet() {
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const eth = getInjected();
    setHasWallet(!!eth);
    if (!eth) return;
    const onAcc = (a: unknown) => { const l = a as string[]; setAccount(l[0] ? getAddress(l[0]) : ""); };
    const onChain = (c: unknown) => setChainId(parseInt(c as string, 16));
    const sync = () => {
      eth.request({ method: "eth_accounts" }).then(onAcc).catch(() => {});
      eth.request({ method: "eth_chainId" }).then(onChain).catch(() => {});
    };
    sync();
    window.addEventListener("genomeproof:wallet", sync);
    eth.on?.("accountsChanged", onAcc);
    eth.on?.("chainChanged", onChain);
    return () => { window.removeEventListener("genomeproof:wallet", sync); eth.removeListener?.("accountsChanged", onAcc); eth.removeListener?.("chainChanged", onChain); };
  }, []);

  const connect = useCallback(async () => {
    const eth = getInjected();
    if (!eth) throw new Error("No Ethereum wallet found. Install MetaMask.");
    const l = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const selected = l[0] ? getAddress(l[0]) : "";
    setAccount(selected);
    setChainId(parseInt((await eth.request({ method: "eth_chainId" })) as string, 16));
    window.dispatchEvent(new Event("genomeproof:wallet"));
    return selected;
  }, []);

  return { account, chainId, hasWallet, connect };
}

export function useContractAddress() {
  const [addr, setAddr] = useState("");
  useEffect(() => {
    const s = () => setAddr(getContractAddress());
    s();
    window.addEventListener("genomeproof:config", s);
    return () => window.removeEventListener("genomeproof:config", s);
  }, []);
  return addr;
}
