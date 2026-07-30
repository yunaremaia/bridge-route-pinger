import { describe, it, expect } from "vitest";
import { compareRoutes, type BridgeRoute, type BridgeQuote } from "../src/lib/bridge.js";

describe("compareRoutes", () => {
  it("returns empty array when no routes provided", () => {
    const result = compareRoutes([]);
    expect(result).toEqual([]);
  });

  it("returns single route unchanged when only one route exists", () => {
    const routes: BridgeRoute[] = [
      {
        bridge: "Hop",
        fromChain: "ethereum",
        toChain: "arbitrum",
        token: "USDC",
        amount: "1000",
        feeUsd: 1.5,
        etaMinutes: 10,
        requirements: ["ETH for gas"],
      },
    ];
    const result = compareRoutes(routes);
    expect(result).toHaveLength(1);
    expect(result[0].bridge).toBe("Hop");
  });

  it("sorts routes by cheapest fee first", () => {
    const routes: BridgeRoute[] = [
      { bridge: "ExpensiveBridge", fromChain: "ethereum", toChain: "arbitrum", token: "USDC", amount: "1000", feeUsd: 5.0, etaMinutes: 30, requirements: [] },
      { bridge: "CheapBridge", fromChain: "ethereum", toChain: "arbitrum", token: "USDC", amount: "1000", feeUsd: 0.5, etaMinutes: 15, requirements: [] },
      { bridge: "MidBridge", fromChain: "ethereum", toChain: "arbitrum", token: "USDC", amount: "1000", feeUsd: 2.0, etaMinutes: 20, requirements: [] },
    ];
    const result = compareRoutes(routes);
    expect(result[0].bridge).toBe("CheapBridge");
    expect(result[1].bridge).toBe("MidBridge");
    expect(result[2].bridge).toBe("ExpensiveBridge");
  });

  it("breaks fee ties by fastest ETA", () => {
    const routes: BridgeRoute[] = [
      { bridge: "SlowSamePrice", fromChain: "ethereum", toChain: "arbitrum", token: "USDC", amount: "1000", feeUsd: 1.0, etaMinutes: 60, requirements: [] },
      { bridge: "FastSamePrice", fromChain: "ethereum", toChain: "arbitrum", token: "USDC", amount: "1000", feeUsd: 1.0, etaMinutes: 5, requirements: [] },
    ];
    const result = compareRoutes(routes);
    expect(result[0].bridge).toBe("FastSamePrice");
  });
});
