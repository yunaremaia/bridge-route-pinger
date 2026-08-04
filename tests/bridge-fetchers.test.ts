import { describe, it, expect, vi } from "vitest";
import { fetchAcrossQuote, fetchHopRoutes, fetchAllBridgeRoutes, TOKEN_ADDRESSES } from "../src/lib/bridge-fetchers.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("fetchAcrossQuote", () => {
  it("calls Across API with correct parameters and returns parsed route", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        relayFeeTotal: "5500", // 0.0055 USDC in 6 decimals
        estimatedFillTimeSec: 120,
        isAmountTooLow: false,
      }),
    });

    const result = await fetchAcrossQuote({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result).not.toBeNull();
    expect(result!.bridge).toBe("Across");
    expect(result!.feeUsd).toBeGreaterThan(0);
    expect(result!.etaMinutes).toBe(2); // 120 sec / 60
    expect(result!.fromChain).toBe("ethereum");
    expect(result!.toChain).toBe("arbitrum");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("across.to");
    // Should use token address, not symbol
    expect(url).toContain(TOKEN_ADDRESSES.USDC[1]);
  });

  it("returns null when API call fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await fetchAcrossQuote({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });
    expect(result).toBeNull();
  });

  it("returns null for unknown token", async () => {
    const result = await fetchAcrossQuote({
      token: "FAKE",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });
    expect(result).toBeNull();
  });
});

describe("fetchHopRoutes", () => {
  it("returns Hop route with fee and ETA", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        amountIn: "1000000",
        bonderFee: "10000", // 0.01 USDC in 6 decimals
        amountOutMin: "990000",
      }),
    });

    const result = await fetchHopRoutes({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result).not.toBeNull();
    expect(result!.bridge).toBe("Hop");
    expect(result!.etaMinutes).toBe(30); // default ETA for Hop
    expect(result!.feeUsd).toBeGreaterThan(0);
  });

  it("returns null on API failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchHopRoutes({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });
    expect(result).toBeNull();
  });

  it("returns null when API returns error object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "invalid token" }),
    });
    const result = await fetchHopRoutes({
      token: "FAKE",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });
    expect(result).toBeNull();
  });
});

describe("fetchAllBridgeRoutes", () => {
  it("aggregates routes from Across and Hop, filters nulls", async () => {
    // Across returns a route
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relayFeeTotal: "5500", estimatedFillTimeSec: 120 }),
    });
    // Hop returns a route
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bonderFee: "10000" }),
    });

    const routes = await fetchAllBridgeRoutes({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(routes.some((r) => r.bridge === "Across")).toBe(true);
    expect(routes.some((r) => r.bridge === "Hop")).toBe(true);
  });
});
