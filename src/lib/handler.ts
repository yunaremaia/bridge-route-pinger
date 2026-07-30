import { fetchAllBridgeRoutes, buildQuote } from "./bridge-fetchers.js";
import type { BridgeQuote } from "./bridge.js";

const SUPPORTED_CHAINS = new Set([
  "ethereum",
  "optimism",
  "polygon",
  "arbitrum",
  "base",
  "avalanche",
]);

export interface HandleBridgeQueryInput {
  token: string;
  amount: string;
  fromChain: string;
  toChain: string;
}

export interface HandleBridgeQueryResult {
  ok: boolean;
  routes: BridgeQuote["routes"];
  bestRoute: BridgeQuote["bestRoute"];
  summary: BridgeQuote["summary"];
  error?: string;
}

export async function handleBridgeQuery(input: HandleBridgeQueryInput): Promise<HandleBridgeQueryResult> {
  // Validate chains
  if (!SUPPORTED_CHAINS.has(input.fromChain) || !SUPPORTED_CHAINS.has(input.toChain)) {
    return {
      ok: false,
      routes: [],
      bestRoute: null,
      summary: { totalRoutes: 0, cheapestFee: null, fastestEta: null },
      error: `Unsupported chain: ${!SUPPORTED_CHAINS.has(input.fromChain) ? input.fromChain : input.toChain}`,
    };
  }

  if (input.fromChain === input.toChain) {
    return {
      ok: false,
      routes: [],
      bestRoute: null,
      summary: { totalRoutes: 0, cheapestFee: null, fastestEta: null },
      error: "Source and destination chains must be different",
    };
  }

  try {
    const routes = await fetchAllBridgeRoutes(input);
    const quote = buildQuote(routes, input);

    return {
      ok: routes.length > 0,
      routes: quote.routes,
      bestRoute: quote.bestRoute,
      summary: quote.summary,
    };
  } catch (error) {
    return {
      ok: false,
      routes: [],
      bestRoute: null,
      summary: { totalRoutes: 0, cheapestFee: null, fastestEta: null },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}