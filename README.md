# Bridge Route Pinger

x402 agent that fetches live bridge quotes from Across and Hop for token transfers across EVM chains, returning fees, ETAs, and requirements.

## Bounty

Daydreams AI Agent Bounties — **#10 Bridge Route Pinger** ($1,000)

## What it does

- Queries Across API (token address-based) and Hop API (chain slug-based)
- Returns fee in USD and estimated time for each bridge route
- Aggregates and sorts routes by cost and speed
- Reports additional requirements (gas tokens, etc.)

## Deploy

- **URL**: https://bridge-route-pinger-phi.vercel.app
- **Endpoint**: `POST /entrypoints/bridge/invoke`
- **Input**: `{ "token": "USDC", "amount": "1000000", "fromChain": "ethereum", "toChain": "arbitrum" }`
- **x402**: Active — returns 402 without payment

## Tests

```bash
npm run test    # vitest: 18/18 passing
npm run build   # tsc: clean
```

## Tech Stack

- TypeScript + Hono + @lucid-dreams/agent-kit
- x402 payment middleware
- Across API + Hop API
- vitest
