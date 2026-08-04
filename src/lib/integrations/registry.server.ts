import type { IntegrationProvider, ProviderId } from "./types";
import { ifoodProvider } from "./ifood/provider";
import { ninetyNineFoodProvider } from "./99food/provider";

const REGISTRY: Partial<Record<ProviderId, IntegrationProvider>> = {
  ifood: ifoodProvider,
  "99food": ninetyNineFoodProvider,
};

export function getProvider(id: ProviderId): IntegrationProvider | null {
  return REGISTRY[id] ?? null;
}

export function implementedProviders(): ProviderId[] {
  return Object.keys(REGISTRY) as ProviderId[];
}
