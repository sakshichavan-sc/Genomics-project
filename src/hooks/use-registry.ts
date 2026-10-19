import { useEffect, useState } from "react";
import { loadPassports, loadVerifications, type StoredPassport, type VerificationRecord } from "@/lib/passport";

export function useRegistry() {
  const [passports, setP] = useState<StoredPassport[]>([]);
  const [verifications, setV] = useState<VerificationRecord[]>([]);
  useEffect(() => {
    const sync = () => { setP(loadPassports()); setV(loadVerifications()); };
    sync();
    window.addEventListener("genomeproof:update", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("genomeproof:update", sync); window.removeEventListener("storage", sync); };
  }, []);
  return { passports, verifications };
}
