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
    // Across responds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relayerFee: "1000000", estimatedFillTime: 600 }),
    });
    // Hop responds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bonderFee: "500000", estimatedFillTime: 300 }),
    });
    // Synapse fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { handleBridgeQuery } = await importApp();
    const result = await handleBridgeQuery({
      token: "USDC",
      amount: "1000",
      fromChain: "ethereum",
      toChain: "arbitrum",
    });

    expect(result.ok).toBe(true);
    expect(result.routes.length).toBeGreaterThanOrEqual(2);
    expect(result.bestRoute).not.toBeNull();
    expect(result.bestRoute!.bridge).toBe("Hop"); // cheaper ($0.50 vs $1.00)
    expect(result.summary.totalRoutes).toBeGreaterThanOrEqual(2);
    expect(result.summary.cheapestFee).toBe(0.5);
    expect(result.summary.fastestEta).toBe(5);
  });

  it("returns ok=false with empty routes when all bridges fail", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { handleBridgeQuery } = await importApp();
    const result = await handleBridgeQuery({
      token: "USDC",
      amount: "1000",
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
      json: async () => ({ relayerFee: "1000000", estimatedFillTime: 600 }),
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { handleBridgeQuery } = await importApp();
    const result = await handleBridgeQuery({
      token: "USDC",
      amount: "1000",
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
      amount: "1000",
      fromChain: "ethereum",
      toChain: "cardano",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unsupported chain");
  });
});
