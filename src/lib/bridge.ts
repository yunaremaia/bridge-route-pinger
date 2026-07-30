// Bridge route types and comparison logic

export interface BridgeRoute {
  bridge: string;
  fromChain: string;
  toChain: string;
  token: string;
  amount: string;
  feeUsd: number;
  etaMinutes: number;
  requirements: string[];
}

export interface BridgeQuote {
  token: string;
  amount: string;
  fromChain: string;
  toChain: string;
  routes: BridgeRoute[];
  bestRoute: BridgeRoute | null;
  summary: {
    totalRoutes: number;
    cheapestFee: number | null;
    fastestEta: number | null;
  };
}

export function compareRoutes(routes: BridgeRoute[]): BridgeRoute[] {
  if (routes.length === 0) return [];
  return [...routes].sort((a, b) => {
    // Sort by cheapest fee first
    if (a.feeUsd !== b.feeUsd) return a.feeUsd - b.feeUsd;
    // Break ties by fastest ETA
    return a.etaMinutes - b.etaMinutes;
  });
}
