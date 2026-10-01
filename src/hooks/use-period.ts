import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { periodFromKey, type Period } from "@/lib/period";

const STORAGE_KEY = "luud:financial-period:v1";
type PeriodContextValue = { period: Period; setPeriod: (period: Period) => void };
const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>(() => periodFromKey("30d"));

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<Period>;
      if (typeof parsed.from === "string" && typeof parsed.to === "string" && typeof parsed.key === "string") {
        setPeriod(parsed as Period);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const update = (next: Period) => {
    setPeriod(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return <PeriodContext.Provider value={{ period, setPeriod: update }}>{children}</PeriodContext.Provider>;
}

export function usePeriod(defaultKey: "today" | "7d" | "30d" | "90d" = "30d") {
  const shared = useContext(PeriodContext);
  const [localPeriod, setLocalPeriod] = useState<Period>(() => periodFromKey(defaultKey));
  if (shared) return shared;
  const period = localPeriod;
  const setPeriod = setLocalPeriod;
  return { period, setPeriod };
}
