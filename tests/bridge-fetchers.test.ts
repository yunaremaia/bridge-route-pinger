import { describe, it, expect, vi } from "vitest";
import { fetchAcrossQuote, fetchHopRoutes, fetchAllBridgeRoutes } from "../src/lib/bridge-fetchers.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("fetchAcrossQuote", () => {
  it("calls Across API with correct parameters and returns parsed route", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        relayerFee: "1500000", // 1.5 USDC in 6 decimals
        estimatedFillTime: 600,
        toChainToken: "USDC",
      }),
    });

    const result = await fetchAcrossQuote({
      token: "USDC",
      amount: "1000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result).not.toBeNull();
    expect(result!.bridge).toBe("Across");
    expect(result!.feeUsd).toBeGreaterThan(0);
    expect(result!.etaMinutes).toBe(10);
    expect(result!.fromChain).toBe("ethereum");
    expect(result!.toChain).toBe("arbitrum");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("across.to");
  });

  it("returns null when API call fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await fetchAcrossQuote({
      token: "USDC",
      amount: "1000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });
    expect(result).toBeNull();
  });
});

describe("fetchHopRoutes", () => {
  it("returns Hop route with fee and ETA from bridge config", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bonderFee: "1500000", // 1.5 USDC in 6 decimals
        estimatedFillTime: 300,
      }),
    });

    const result = await fetchHopRoutes({
      token: "USDC",
      amount: "1000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result).not.toBeNull();
    expect(result!.bridge).toBe("Hop");
    expect(result!.etaMinutes).toBe(5);
    expect(result!.feeUsd).toBeGreaterThan(0);
  });

  it("returns null on API failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchHopRoutes({
      token: "USDC",
      amount: "1000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });
    expect(result).toBeNull();
  });
});

describe("fetchAllBridgeRoutes", () => {
  it("aggregates routes from multiple bridge providers and filters nulls", async () => {
    // Across returns a route
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relayerFee: "1000000", estimatedFillTime: 600 }),
    });
    // Hop returns a route
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bonderFee: "500000", estimatedFillTime: 300 }),
    });
    // Synapse fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const routes = await fetchAllBridgeRoutes({
      token: "USDC",
      amount: "1000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(routes.some((r) => r.bridge === "Across")).toBe(true);
    expect(routes.some((r) => r.bridge === "Hop")).toBe(true);
  });
});
