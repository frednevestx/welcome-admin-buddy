import { useState } from "react";
import { periodFromKey, type Period } from "@/lib/period";

export function usePeriod(defaultKey: "today" | "7d" | "30d" | "90d" = "30d") {
  const [period, setPeriod] = useState<Period>(() => periodFromKey(defaultKey));
  return { period, setPeriod };
}
