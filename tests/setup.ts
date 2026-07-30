import { vi } from "vitest";

// Set required x402 env vars for testing
process.env.X402_RECEIVER_ADDRESS = "0x1234567890123456789012345678901234567890";
process.env.X402_PRICING = "0.01";
process.env.X402_ASSET = "USDC";
process.env.X402_NETWORK = "base";
process.env.NODE_ENV = "test";

// Mock global fetch for bridge API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Reset mocks before each test
beforeEach(() => {
  mockFetch.mockReset();
});