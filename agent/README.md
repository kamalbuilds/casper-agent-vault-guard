# AgentVault Guard Agent Backend

AI-powered policy enforcement backend for Casper AgentVault. This service parses natural language spend intents and evaluates them against on-chain policy constraints.

## Features

- Natural language intent parsing via OpenRouter AI
- Real-time policy evaluation against Casper contract constraints
- Pure policy evaluation function for predictable enforcement
- Express server with REST API endpoints
- CLI tool for testing and debugging
- Full TypeScript type safety with Zod validation

## Requirements

- Node.js v24.9.0 (or use nvm with `export PATH="/Users/kamal/.nvm/versions/node/v24.9.0/bin:$PATH"`)
- OpenRouter API key
- npm

## Installation

```bash
cd /Users/kamal/Desktop/caspa/hackathon-ideas/agent-vault-guard/agent

npm install

export PATH="/Users/kamal/.nvm/versions/node/v24.9.0/bin:$PATH"
```

## Environment Setup

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Then set these variables:

- `OPENROUTER_API_KEY` (required) - Obtain from https://openrouter.ai
- `OPENROUTER_MODEL` (optional, default: `anthropic/claude-sonnet-5`)
- `PORT` (optional, default: 3001)
- `CONTRACT_HASH` - Deployed contract address on testnet
- `CASPER_NODE_ADDRESS` - Casper testnet RPC endpoint
- `CSPR_CLOUD_ACCESS_KEY` - For reading contract events

Never commit `.env` or hardcode secrets in code.

## Build and Type Check

```bash
npm run typecheck
npm run build
```

## Running

### Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3001` with auto-reload on file changes.

### Production Build and Run

```bash
npm run build
npm start
```

### CLI Tool

Test the agent without running the server:

```bash
# Using demo policy
npm run cli "pay 50 CSPR to 01fedcba... for hosting"

# Or using a custom policy file
npm run cli "pay 100 CSPR to 01fedcba... for vendor_payment" /path/to/policy.json
```

### Policy Evaluation Tests

Run the pure policy evaluation against 8 test cases:

```bash
npm run test:policy
```

Expected output shows test results for allowed and blocked scenarios.

## API Endpoints

### POST /api/agent-action

Process a natural language intent and evaluate against a policy.

Request:

```json
{
  "intentText": "pay 50 CSPR to 01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543 for hosting",
  "policy": {
    "agent": "01abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    "maxPerTx": "1000000000000",
    "dailyCap": "5000000000000",
    "allowedTarget": "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
    "expiry": 9999999999,
    "purposes": ["hosting_payment", "vendor_payment", "service_fee"]
  }
}
```

Response:

```json
{
  "intentText": "pay 50 CSPR to 01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543 for hosting",
  "parsedAction": {
    "target": "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
    "amount": "50000000000",
    "purpose": "hosting_payment"
  },
  "policyEvaluation": {
    "allowed": true,
    "reason": "Action approved: 50000000000 motes to 01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543 for purpose 'hosting_payment'"
  },
  "aiReasoning": "Parsed intent: target=01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543, amount=50000000000 motes, purpose=hosting_payment",
  "success": true
}
```

### GET /health

Health check endpoint.

Response:

```json
{
  "ok": true,
  "timestamp": "2026-07-07T20:30:45.123Z",
  "uptime": 245.67,
  "environment": "development"
}
```

### GET /

Service info.

Response:

```json
{
  "name": "AgentVault Guard Agent Backend",
  "version": "1.0.0",
  "description": "AI-powered policy enforcement backend for Casper AgentVault",
  "endpoints": {
    "health": "GET /health",
    "agentAction": "POST /api/agent-action"
  }
}
```

## Architecture

### `src/ai.ts`

OpenRouter client. Provides:

- `ai` - Configured OpenAI client pointing to OpenRouter
- `reason(prompt, model?)` - Send a prompt and get text reasoning
- `parseJSON<T>(prompt, model?, maxRetries?)` - Parse structured JSON from AI with retry logic

### `src/policy.ts`

Policy data model and evaluation logic. Provides:

- `Policy` - TypeScript interface for a policy
- `ActionRequest` - TypeScript interface for a spend action
- `evaluate(request, policy)` - Pure function returning `{allowed: boolean, reason: string, violatedRule?: string}`
- Helper functions for motes/CSPR conversion

Pure function evaluation means the same inputs always produce the same output, suitable for on-chain enforcement or deterministic testing.

### `src/agent.ts`

Main agent orchestration. Provides:

- `runAgentAction(intentText, policy, model?)` - Parse intent via AI and evaluate against policy
- Returns `AgentDecision` with parsed action, evaluation result, and AI reasoning

### `src/server.ts`

Express server with:

- POST `/api/agent-action` - Agent action endpoint
- GET `/health` - Health check
- GET `/` - Service info
- CORS enabled for localhost:3000
- Graceful shutdown on SIGINT

### `src/cli.ts`

Standalone CLI tool for testing without the server.

### `scripts/test-policy.ts`

Pure policy evaluation test suite exercising 8 test cases: allowed actions, amount limits, target restrictions, purpose validation, and policy expiry.

## Policy Structure

A policy defines the constraints for an agent:

```typescript
interface Policy {
  agent: string;                    // Agent address (40-char hex)
  maxPerTx: string;                 // Max per transaction in motes
  dailyCap: string;                 // Daily spending cap in motes
  allowedTarget: string;            // Recipient address (40-char hex)
  expiry: number;                   // Expiry unix timestamp
  purposes: string[];               // Allowed purpose strings
}
```

Example:

```json
{
  "agent": "01abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
  "maxPerTx": "1000000000000",
  "dailyCap": "5000000000000",
  "allowedTarget": "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
  "expiry": 9999999999,
  "purposes": ["hosting_payment", "vendor_payment"]
}
```

1 CSPR = 1,000,000,000 motes.

## Integration with Frontend

The frontend at `/Users/kamal/Desktop/caspa/hackathon-ideas/agent-vault-guard/web` sends intents to this backend:

```typescript
const response = await fetch("http://localhost:3001/api/agent-action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    intentText: "pay 50 CSPR to vendor for hosting",
    policy: { /* ... */ },
  }),
});

const decision = await response.json();
```

The decision object indicates whether the action is allowed and provides reasoning for the UI to display.

## Design Decisions

1. **Pure Evaluation Function**: `evaluate()` is pure and deterministic, making it suitable for on-chain validation and testing.

2. **Separate AI Parsing**: Intent parsing is delegated to OpenRouter, decoupling natural language understanding from enforcement logic.

3. **Retry on AI Parse Failure**: If AI returns malformed JSON, it retries once before failing. Useful for edge cases.

4. **Motes as Strings**: BigInt is used for amount comparisons to handle large values precisely (no floating point).

5. **Demo Policy**: A realistic demo policy is shipped so the CLI tool works out of the box.

6. **Express not Next.js**: Standalone Express server keeps dependencies minimal and separates backend logic from frontend concerns.

## Known Limitations

1. No persistent state or database - policies are passed per request.

2. No daily cap enforcement history - policy evaluation assumes the daily cap is not yet consumed. Real enforcement requires on-chain state.

3. AI model output is not deterministic (temperature 0.2 reduces variance). For production, implement structured output or constrain the model further.

4. Purpose matching is case-insensitive string comparison. Real contracts may use content-addressed hashes.

## Next Steps

1. Deploy contract on Casper testnet and store hash in CONTRACT_HASH env var.

2. Wire frontend to this backend's /api/agent-action endpoint.

3. Extend policy enforcement to track daily cap consumption on-chain.

4. Add WebSocket support for real-time intent streaming from frontend.

5. Implement attestation or signature verification for agent actions.
