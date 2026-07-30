import type { BridgeRoute, BridgeQuote } from "./bridge.js";
import { compareRoutes } from "./bridge.js";

// Chain ID mapping for bridge APIs
export const CHAIN_IDS: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  137: "polygon",
  42161: "arbitrum",
  8453: "base",
  43114: "avalanche",
};
// Chain ID mapping for bridge APIs
export const NAME_TO_CHAIN_ID: Record<string, string> = {
  ethereum: "1",
  optimism: "10",
  polygon: "137",
  arbitrum: "42161",
  base: "8453",
  avalanche: "43114",
};

// Token decimals mapping
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  MATIC: 18,
  DAI: 18,
  WBTC: 8,
};

// Approximate token prices in USD for fee conversion
const TOKEN_PRICES: Record<string, number> = {
  USDC: 1.0,
  USDT: 1.0,
  ETH: 3000,
  MATIC: 0.8,
  DAI: 1.0,
  WBTC: 60000,
};

function rawToUsd(raw: string, token: string): number {
  const price = TOKEN_PRICES[token] ?? 1;
  const decimals = TOKEN_DECIMALS[token] ?? 18;
  const value = Number(raw) / Math.pow(10, decimals);
  return Math.round(value * price * 100) / 100;
}

interface BridgeQuery {
  token: string;
  amount: string;
  fromChain: string;
  toChain: string;
}

export async function fetchAcrossQuote(q: BridgeQuery): Promise<BridgeRoute | null> {
  try {
    const fromId = NAME_TO_CHAIN_ID[q.fromChain];
    const toId = NAME_TO_CHAIN_ID[q.toChain];
    const url = `https://across.to/api/suggested-fees?destinationChainId=${toId}&originChainId=${fromId}&token=${q.token}&amount=${q.amount}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feeUsd = data.relayerFee ? rawToUsd(data.relayerFee, q.token) : 0.5;
    const etaMinutes = Math.ceil((data.estimatedFillTime ?? 600) / 60);
    return {
      bridge: "Across",
      fromChain: q.fromChain,
      toChain: q.toChain,
      token: q.token,
      amount: q.amount,
      feeUsd,
      etaMinutes,
      requirements: ["ETH for gas on destination"],
    };
  } catch {
    return null;
  }
}

export async function fetchHopRoutes(q: BridgeQuery): Promise<BridgeRoute | null> {
  try {
    const fromId = NAME_TO_CHAIN_ID[q.fromChain];
    const toId = NAME_TO_CHAIN_ID[q.toChain];
    const url = `https://api.hop.exchange/v1/quote?token=${q.token}&amount=${q.amount}&fromChain=${fromId}&toChain=${toId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feeUsd = data.bonderFee ? rawToUsd(data.bonderFee, q.token) : 0.3;
    const etaMinutes = Math.ceil((data.estimatedFillTime ?? 300) / 60);
    return {
      bridge: "Hop",
      fromChain: q.fromChain,
      toChain: q.toChain,
      token: q.token,
      amount: q.amount,
      feeUsd,
      etaMinutes,
      requirements: ["ETH for gas"],
    };
  } catch {
    return null;
  }
}

export async function fetchSynapseQuote(q: BridgeQuery): Promise<BridgeRoute | null> {
  try {
    const fromId = NAME_TO_CHAIN_ID[q.fromChain];
    const toId = NAME_TO_CHAIN_ID[q.toChain];
    const url = `https://api.synapseprotocol.com/v2/bridge/quote?token=${q.token}&amount=${q.amount}&chainIdFrom=${fromId}&chainIdTo=${toId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feeUsd = data.bridgeFee ? Number(data.bridgeFee) : 0.5;
    const etaMinutes = data.estimatedTime ? Math.ceil(data.estimatedTime / 60) : 10;
    return {
      bridge: "Synapse",
      fromChain: q.fromChain,
      toChain: q.toChain,
      token: q.token,
      amount: q.amount,
      feeUsd,
      etaMinutes,
      requirements: ["ETH for gas"],
    };
  } catch {
    return null;
  }
}

export async function fetchAllBridgeRoutes(q: BridgeQuery): Promise<BridgeRoute[]> {
  const [across, hop, synapse] = await Promise.all([
    fetchAcrossQuote(q),
    fetchHopRoutes(q),
    fetchSynapseQuote(q),
  ]);
  return compareRoutes([across, hop, synapse].filter((r): r is BridgeRoute => r !== null));
}

export function buildQuote(routes: BridgeRoute[], q: BridgeQuery): BridgeQuote {
  const sorted = compareRoutes(routes);
  return {
    token: q.token,
    amount: q.amount,
    fromChain: q.fromChain,
    toChain: q.toChain,
    routes: sorted,
    bestRoute: sorted[0] ?? null,
    summary: {
      totalRoutes: sorted.length,
      cheapestFee: sorted.length > 0 ? sorted[0].feeUsd : null,
      fastestEta: sorted.length > 0 ? Math.min(...sorted.map((r) => r.etaMinutes)) : null,
    },
  };
}
