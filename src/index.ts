import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { buildQuote } from "./lib/bridge-fetchers.js";
import { fetchAllBridgeRoutes } from "./lib/bridge-fetchers.js";
import type { BridgeRoute } from "./lib/bridge.js";

const SUPPORTED_CHAINS = [
  "ethereum",
  "arbitrum",
  "optimism",
  "polygon",
  "base",
  "avalanche",
];

function isSupportedChain(chain: string): boolean {
  return SUPPORTED_CHAINS.includes(chain.toLowerCase());
}

const { app, addEntrypoint }: { app: any; addEntrypoint: any } = createAgentApp({
  name: "bridge-route-pinger",
  version: "1.0.0",
  description: "List viable bridge routes and live fee/time quotes for token transfers",
});

addEntrypoint({
  key: "bridge",
  description: "Get bridge routes with fee and time estimates for a token transfer",
  price: process.env.DEFAULT_PRICE ?? "0.01",
  input: z.object({
    token: z.string().describe("Token symbol to bridge (e.g., USDC)"),
    amount: z.string().describe("Amount to bridge in raw units (e.g., 1000000 for 1 USDC)"),
    fromChain: z.string().describe("Source chain name (e.g., ethereum)"),
    toChain: z.string().describe("Destination chain name (e.g., arbitrum)"),
  }),
  async handler({ input }: { input: any }) {
    const token = input.token.toUpperCase();
    const amount = input.amount;
    const fromChain = input.fromChain.toLowerCase();
    const toChain = input.toChain.toLowerCase();

    if (!isSupportedChain(fromChain) || !isSupportedChain(toChain)) {
      return {
        output: {
          ok: false,
          error: `Unsupported chain: ${fromChain} or ${toChain}. Supported: ${SUPPORTED_CHAINS.join(", ")}`,
        },
        usage: { total_tokens: 0 },
      };
    }

    if (fromChain === toChain) {
      return {
        output: {
          ok: false,
          error: "fromChain and toChain must be different",
        },
        usage: { total_tokens: 0 },
      };
    }

    try {
      const routes = await fetchAllBridgeRoutes({
        token,
        amount,
        fromChain,
        toChain,
      });

      const quote = buildQuote(routes, { token, amount, fromChain, toChain });

      return {
        output: {
          ok: true,
          token: quote.token,
          amount: quote.amount,
          chainsScanned: [quote.fromChain, quote.toChain],
          totalRoutesChecked: quote.routes.length,
          routes: quote.routes.map((r: BridgeRoute) => ({
            bridge: r.bridge,
            fromChain: r.fromChain,
            toChain: r.toChain,
            token: r.token,
            amount: r.amount,
            feeUsd: r.feeUsd,
            etaMinutes: r.etaMinutes,
            requirements: r.requirements,
          })),
          bestRoute: quote.bestRoute
            ? {
                bridge: quote.bestRoute.bridge,
                fromChain: quote.bestRoute.fromChain,
                toChain: quote.bestRoute.toChain,
                token: quote.bestRoute.token,
                amount: quote.bestRoute.amount,
                feeUsd: quote.bestRoute.feeUsd,
                etaMinutes: quote.bestRoute.etaMinutes,
                requirements: quote.bestRoute.requirements,
              }
            : null,
          summary: {
            cheapestFeeUsd: quote.summary.cheapestFee,
            fastestEtaMinutes: quote.summary.fastestEta,
            totalRoutes: quote.summary.totalRoutes,
          },
        },
        usage: { total_tokens: 100 },
      };
    } catch (error) {
      return {
        output: {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        usage: { total_tokens: 0 },
      };
    }
  },
});

app.get("/health", (c: any) => c.json({ ok: true, version: "1.0.0" }));

export default app;
export { app };
