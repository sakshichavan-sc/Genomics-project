// Ethereum Sepolia integration for the AnalysisPassportRegistry contract.
import { AbiCoder, BrowserProvider, Contract, JsonRpcProvider, Network, getAddress, isAddress, keccak256, toUtf8Bytes } from "ethers";
import registryAbi from "./registry-abi.json";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_HEX = "0xaa36a7";
export const EXPLORER = "https://sepolia.etherscan.io";
export const RPC_URL: string =
  (import.meta.env["VITE_SEPOLIA_RPC_URL"] as string | undefined) || "https://ethereum-sepolia-rpc.publicnode.com";

// Default registry supplied for this deployment; VITE_REGISTRY_ADDRESS can override it.
export const DEFAULT_REGISTRY_ADDRESS = "0xc1576223D05dCCB7888446cC7682cE0A5592EC51";
export const REGISTRY_DEPLOYMENT_BLOCK = 11939624;
export const REGISTRAR_ROLE = keccak256(toUtf8Bytes("REGISTRAR_ROLE"));
export const REGISTRY_ABI = registryAbi;

const ADDR_KEY = "genomeproof.contractAddress";
const ZERO32 = "0x" + "0".repeat(64);

export function getContractAddress(): string {
  if (typeof window !== "undefined") {
    const v = localStorage.getItem(ADDR_KEY);
    if (v && v.toLowerCase() !== "0x439578460fc3ff86de7055fedd3062d231cb5057" && isAddress(v)) return getAddress(v);
  }
  const env = import.meta.env["VITE_REGISTRY_ADDRESS"] as string | undefined;
  const configured = env && isAddress(env) ? env : DEFAULT_REGISTRY_ADDRESS;
  return isAddress(configured) ? getAddress(configured) : "";
}
export function setContractAddress(addr: string) {
  if (!isAddress(addr)) throw new Error("Not a valid Ethereum address");
  localStorage.setItem(ADDR_KEY, getAddress(addr));
  window.dispatchEvent(new Event("genomeproof:config"));
}

export function projectKey(id: string) {
  return keccak256(toUtf8Bytes(id.normalize("NFC")));
}
export function passportKey(projectId: string, analysisId: string, version = 1) {
  return keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes32", "uint32"], [projectKey(projectId), projectKey(analysisId), version]));
}
export function registrationArgs(args: { projectId: string; analysisId: string; commitment: string; version?: number }) {
  const version = args.version ?? 1;
  if (!Number.isInteger(version) || version < 1 || version > 4294967295) throw new Error("Passport version must be an integer between 1 and 4294967295.");
  return [projectKey(args.projectId), projectKey(args.analysisId), version, args.commitment] as const;
}

let readProvider: JsonRpcProvider | null = null;
export function getReadProvider() {
  if (!readProvider) readProvider = new JsonRpcProvider(RPC_URL, Network.from(SEPOLIA_CHAIN_ID), { staticNetwork: true });
  return readProvider;
}

export function readContract(address = getContractAddress()) {
  if (!address) throw new Error("Registry contract address is not configured");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Contract(address, REGISTRY_ABI, getReadProvider()) as any;
}

export interface OnChainRecord { commitment: string; registrant: string; registeredAt: number }
export async function fetchRecord(projectId: string, analysisId: string, version = 1, address?: string): Promise<OnChainRecord | null> {
  const c = readContract(address);
  const ids = [projectKey(projectId), projectKey(analysisId), version];
  try {
    const r = await c.getPassport(...ids);
    if (r.commitment === ZERO32) return null;
    return { commitment: r.commitment, registrant: r.registrant, registeredAt: Number(r.registeredAt) };
  } catch (error) {
    const revert = error as { code?: string; reason?: string };
    // The deployed registry reverts for missing records. Never mask RPC failures.
    if (revert.code === "CALL_EXCEPTION" && revert.reason === "Passport not found") return null;
    throw error;
  }
}
export interface ChainEntry extends OnChainRecord { projectId: string; passportId: string; version: number; txHash: string; block: number }
export async function fetchRegistryActivity(address = getContractAddress()): Promise<ChainEntry[]> {
  const provider = getReadProvider();
  const latest = await provider.getBlockNumber();
  const start = address.toLowerCase() === DEFAULT_REGISTRY_ADDRESS.toLowerCase() ? REGISTRY_DEPLOYMENT_BLOCK : Number(import.meta.env["VITE_REGISTRY_DEPLOYMENT_BLOCK"] ?? 0);
  const c = readContract(address);
  const entries: ChainEntry[] = [];
  for (let from = start; from <= latest; from += 2000) {
    const logs = await c.queryFilter(c.filters.PassportRegistered(), from, Math.min(from + 1999, latest));
    for (const log of logs) {
      const e = c.interface.parseLog(log);
      if (!e) continue;
      entries.push({ projectId: e.args.projectId, passportId: e.args.passportId, version: Number(e.args.version), commitment: e.args.commitment, registrant: e.args.registrant, registeredAt: Number(e.args.registeredAt), txHash: log.transactionHash, block: log.blockNumber });
    }
  }
  return entries.sort((a, b) => b.block - a.block);
}
export async function registryStatus(address = getContractAddress(), account?: string) {
  if (!(await contractDeployed(address))) throw new Error("No registry contract deployed on Sepolia at this address.");
  const c = readContract(address);
  const [paused, admin, registrar] = await Promise.all([c.paused(), c.defaultAdmin(), account ? c.hasRole(REGISTRAR_ROLE, account) : Promise.resolve(false)]);
  return { paused: Boolean(paused), admin: String(admin), registrar: Boolean(registrar) };
}
export async function administerRegistry(action: "authorizeRegistrar" | "revokeRegistrar" | "pauseRegistrations" | "unpauseRegistrations", account?: string) {
  const eth = getInjected();
  if (!eth) throw new Error("Connect an Ethereum wallet first.");
  const provider = new BrowserProvider(eth as never);
  if (Number((await provider.getNetwork()).chainId) !== SEPOLIA_CHAIN_ID) throw new Error("Switch to Sepolia first.");
  const signer = await provider.getSigner();
  const status = await registryStatus(getContractAddress());
  if (status.admin.toLowerCase() !== (await signer.getAddress()).toLowerCase()) throw new Error("Only the registry administrator can perform this action.");
  if (account !== undefined && !isAddress(account)) throw new Error("Enter a valid registrar wallet address.");
  const c = new Contract(getContractAddress(), REGISTRY_ABI, signer);
  const method = c.getFunction(action);
  const tx = account === undefined ? await method() : await method(getAddress(account));
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Transaction failed.");
  window.dispatchEvent(new Event("genomeproof:chain"));
  return receipt.hash as string;
}

export async function contractDeployed(address = getContractAddress()) {
  if (!address) return false;
  const code = await getReadProvider().getCode(address);
  return code !== "0x";
}

// ---------- Wallet ----------
type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, f: (...a: unknown[]) => void) => void; removeListener?: (e: string, f: (...a: unknown[]) => void) => void };
export function getInjected(): Eip1193 | undefined {
  return typeof window !== "undefined" ? (window as unknown as { ethereum?: Eip1193 }).ethereum : undefined;
}

export async function switchToSepolia() {
  const eth = getInjected();
  if (!eth) throw new Error("No Ethereum wallet found. Install MetaMask.");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
  } catch (e) {
    if ((e as { code?: number }).code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: SEPOLIA_HEX, chainName: "Sepolia", nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER] }],
      });
    } else throw e;
  }
  window.dispatchEvent(new Event("genomeproof:wallet"));
}

export interface Registration { txHash: string; block: number; registeredAt: string; registrar: string; passportKey: string; contract: string; chainId: number; version?: number }

export async function registerOnChain(
  args: { projectId: string; analysisId: string; commitment: string; version?: number },
  onSubmitted?: (txHash: string) => void,
): Promise<Registration> {
  const eth = getInjected();
  if (!eth) throw new Error("No Ethereum wallet found. Install MetaMask.");
  const address = getContractAddress();
  if (!address) throw new Error("Registry contract address is not configured (see Security & System Info).");
  const provider = new BrowserProvider(eth as never);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== SEPOLIA_CHAIN_ID) throw new Error("Wallet is on the wrong network. Switch to Sepolia.");
  if (!(await contractDeployed(address))) throw new Error("No contract found at the configured address on Sepolia.");
  const signer = await provider.getSigner();
  const me = await signer.getAddress();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = new Contract(address, REGISTRY_ABI, signer) as any;
  if (await c.paused()) throw new Error("Registrations are paused by the administrator.");
  if (!(await c.hasRole(REGISTRAR_ROLE, me))) throw new Error(`Connected account ${me} is not an authorized registrar.`);
  const key = passportKey(args.projectId, args.analysisId, args.version ?? 1);
  const existing = await fetchRecord(args.projectId, args.analysisId, args.version ?? 1, address);
  if (existing) throw new Error("This project/analysis ID is already registered on-chain.");
  const tx = await c.registerPassport(...registrationArgs(args));
  onSubmitted?.(tx.hash);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("Transaction failed or was reverted.");
  const ev = receipt.logs.map((l: { topics: string[]; data: string }) => { try { return c.interface.parseLog(l); } catch { return null; } }).find((p: { name?: string } | null) => p?.name === "PassportRegistered");
  if (!ev || ev.args.commitment.toLowerCase() !== args.commitment.toLowerCase() || ev.args.projectId !== projectKey(args.projectId) || ev.args.passportId !== projectKey(args.analysisId) || Number(ev.args.version) !== (args.version ?? 1)) throw new Error("Receipt did not contain the expected registration event.");
  window.dispatchEvent(new Event("genomeproof:chain"));
  return {
    version: args.version ?? 1, txHash: receipt.hash, block: receipt.blockNumber, registeredAt: new Date(Number(ev.args.registeredAt) * 1000).toISOString(),
    registrar: me, passportKey: key, contract: address, chainId: SEPOLIA_CHAIN_ID,
  };
}

export function friendlyError(e: unknown): string {
  const err = e as { code?: string | number; shortMessage?: string; message?: string; revert?: { name?: string } };
  if (err.code === "ACTION_REJECTED" || err.code === 4001) return "Request rejected in wallet.";
  if (err.revert?.name) return `Contract rejected: ${err.revert.name}`;
  return err.shortMessage || err.message || "Unknown error";
}
