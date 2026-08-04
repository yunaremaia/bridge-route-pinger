import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Dynamically import so mocks are set before module loads
async function importApp() {
  const mod = await import("../src/lib/handler.js");
  return mod;
}

describe("handleBridgeQuery", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns best route and summary when bridges respond", async () => {
    // Across responds (relayFeeTotal = "5500" = 0.0055 USDC ≈ $0.0055)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relayFeeTotal: "5500", estimatedFillTimeSec: 120 }),
    });
    // Hop responds (bonderFee = "10000" = 0.01 USDC = $0.01)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bonderFee: "10000" }),
    });

    const { handleBridgeQuery } = await importApp();
    const result = await handleBridgeQuery({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result.ok).toBe(true);
    expect(result.routes.length).toBeGreaterThanOrEqual(2);
    expect(result.bestRoute).not.toBeNull();
    // Across should be cheapest (0.0055 vs 0.01)
    expect(result.bestRoute!.bridge).toBe("Across");
    expect(result.summary.totalRoutes).toBeGreaterThanOrEqual(2);
    expect(result.summary.cheapestFee).toBeGreaterThan(0);
  });

  it("returns ok=false with empty routes when all bridges fail", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { handleBridgeQuery } = await importApp();
    const result = await handleBridgeQuery({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result.ok).toBe(false);
    expect(result.routes).toEqual([]);
    expect(result.bestRoute).toBeNull();
    expect(result.summary.totalRoutes).toBe(0);
  });

  it("includes requirements field in each route", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relayFeeTotal: "5500", estimatedFillTimeSec: 120 }),
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { handleBridgeQuery } = await importApp();
    const result = await handleBridgeQuery({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result.routes.length).toBeGreaterThanOrEqual(1);
    expect(result.routes[0].requirements).toBeDefined();
    expect(Array.isArray(result.routes[0].requirements)).toBe(true);
  });

  it("validates supported chains and rejects unsupported chain", async () => {
    const { handleBridgeQuery } = await importApp();
    const result = await handleBridgeQuery({
      token: "USDC",
      amount: "1000000",
      fromChain: "ethereum",
      toChain: "cardano",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unsupported chain");
  });
});
