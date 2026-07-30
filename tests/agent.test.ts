import { describe, it, expect, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

async function importApp() {
  const mod = await import("../src/index.js");
  return mod;
}

describe("Agent app entrypoint", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("health endpoint returns ok", async () => {
    const { app } = await importApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.version).toBeDefined();
  });

  it("entrypoint /entrypoints/bridge/invoke returns structured response", async () => {
    // Mock bridge API responses
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relayerFee: "1000000", estimatedFillTime: 600 }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bonderFee: "500000", estimatedFillTime: 300 }),
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { app } = await importApp();
    const res = await app.request("/entrypoints/bridge/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { token: "USDC", amount: "1000", fromChain: "ethereum", toChain: "arbitrum" },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run_id).toBeDefined();
    expect(body.status).toBe("succeeded");
    expect(body.output).toBeDefined();
    expect(body.output.token).toBe("USDC");
    expect(body.output.chainsScanned).toContain("ethereum");
    expect(body.output.chainsScanned).toContain("arbitrum");
    expect(Array.isArray(body.output.routes)).toBe(true);
    expect(body.output.routes.length).toBeGreaterThanOrEqual(1);
    expect(body.output.bestRoute).toBeDefined();
    expect(body.output.summary).toBeDefined();
  });

  it("returns error for unsupported chain", async () => {
    const { app } = await importApp();
    const res = await app.request("/entrypoints/bridge/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { token: "USDC", amount: "1000", fromChain: "ethereum", toChain: "cardano" },
      }),
    });

    expect(res.status).toBe(200); // Agent returns 200 with error in output
    const body = await res.json();
    expect(body.status).toBe("succeeded");
    expect(body.output.ok).toBe(false);
    expect(body.output.error).toContain("Unsupported chain");
  });
});