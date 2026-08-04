import type { BridgeRoute, BridgeQuote } from "./bridge.js";
import { compareRoutes } from "./bridge.js";

// ── Chain ID mapping for bridge APIs ──
export const NAME_TO_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  optimism: 10,
  polygon: 137,
  arbitrum: 42161,
  base: 8453,
  avalanche: 43114,
};

// ── Well-known token contract addresses (for APIs that require addresses) ──
export const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  USDC: {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    42161: "0xaf88d065e77c8cC2239327c5edb3a432268e5831",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48A6E",
  },
  USDT: {
    1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    137: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    42161: "0xFd086bC7cd5c481DcC9C85eBE478A1C0b69FCbb9",
    8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    43114: "0x9702230A8Ea53601F5Cd2dc00fdbc13d4dF4A8c7",
  },
  DAI: {
    1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    10: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    137: "0x8f3C70D810aD22D81daB9fF13aFc8c16B104F5C7",
    42161: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    43114: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
  },
  ETH: {
    1: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    10: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    137: "0x0000000000000000000000000000000000001010",
    42161: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    8453: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    43114: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66C7",
  },
};

// Token decimals for fee conversion
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  ETH: 18,
  MATIC: 18,
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
  const value = Number(BigInt(raw)) / 10 ** decimals;
  return Math.round(value * price * 100) / 100;
}

interface BridgeQuery {
  token: string;
  amount: string;
  fromChain: string;
  toChain: string;
}

// ── Across ──
// Docs: https://docs.across.to/reference/suggestedfees
export async function fetchAcrossQuote(q: BridgeQuery): Promise<BridgeRoute | null> {
  try {
    const fromId = NAME_TO_CHAIN_ID[q.fromChain];
    const toId = NAME_TO_CHAIN_ID[q.toChain];
    if (!fromId || !toId) return null;

    const tokenAddr = TOKEN_ADDRESSES[q.token]?.[fromId];
    if (!tokenAddr) return null;

    const url = `https://across.to/api/suggested-fees?destinationChainId=${toId}&originChainId=${fromId}&token=${tokenAddr}&amount=${q.amount}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();

    // Across returns relayFeeTotal as a raw string (in token units)
    const feeUsd = data.relayFeeTotal ? rawToUsd(data.relayFeeTotal, q.token) : 0.5;
    const etaMinutes = Math.ceil((data.estimatedFillTimeSec ?? 600) / 60);
    const isAmountTooLow = data.isAmountTooLow ?? false;

    return {
      bridge: "Across",
      fromChain: q.fromChain,
      toChain: q.toChain,
      token: q.token,
      amount: q.amount,
      feeUsd,
      etaMinutes,
      requirements: [
        "ETH for gas on source chain",
        ...(isAmountTooLow ? ["Amount too low for reliable bridging"] : []),
      ],
    };
  } catch {
    return null;
  }
}

// ── Hop ──
// Docs: https://docs.hop.exchange/
export async function fetchHopRoutes(q: BridgeQuery): Promise<BridgeRoute | null> {
  try {
    const fromId = NAME_TO_CHAIN_ID[q.fromChain];
    const toId = NAME_TO_CHAIN_ID[q.toChain];
    if (!fromId || !toId) return null;

    // Hop uses chain slugs ("ethereum"), not chain IDs
    const fromSlug = q.fromChain.toLowerCase();
    const toSlug = q.toChain.toLowerCase();

    const url = `https://api.hop.exchange/v1/quote?token=${q.token}&amount=${q.amount}&fromChain=${fromSlug}&toChain=${toSlug}&slippage=0.5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();

    if (data.error) return null;

    const feeUsd = data.bonderFee ? rawToUsd(data.bonderFee, q.token) : 0.3;
    // Hop doesn't return estimated fill time in quote, use default
    const etaMinutes = 30; // Hop typically fills in ~30min

    return {
      bridge: "Hop",
      fromChain: q.fromChain,
      toChain: q.toChain,
      token: q.token,
      amount: q.amount,
      feeUsd,
      etaMinutes,
      requirements: ["ETH for gas on source chain"],
    };
  } catch {
    return null;
  }
}

export async function fetchAllBridgeRoutes(q: BridgeQuery): Promise<BridgeRoute[]> {
  const [across, hop] = await Promise.all([
    fetchAcrossQuote(q),
    fetchHopRoutes(q),
  ]);
  return compareRoutes([across, hop].filter((r): r is BridgeRoute => r !== null));
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
