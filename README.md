# AgentVault Guard

AI agents can spend, but cannot steal.

## User

Casper users, teams, and protocols that want AI agents to transact without handing over full wallet authority.

## Problem

Agentic finance breaks when an LLM or backend agent controls a full hot key. One prompt injection, leaked key, or hallucinated action can drain funds.

## Solution

An Odra AgentVault contract that lets owners grant scoped permissions to agent keys. Policies include max per transaction, daily cap, allowed recipient or contract, expiry, revocation, and required purpose hash. Every agent action emits an auditable receipt.

## Quickstart

### 1. Contract tests and build

```bash
cd contract
cargo odra test
cargo odra build
```

Wasm lands at `contract/wasm/AgentVault.wasm`.

### 2. Deploy to Casper testnet (manual)

Do not commit secret keys. Generate keys and fund at the [testnet faucet](https://testnet.cspr.live/tools/faucet).

```bash
casper-client put-transaction session \
  --node-address https://node.testnet.cspr.cloud/rpc \
  --chain-name casper-test \
  --secret-key /path/to/secret_key.pem \
  --wasm-path ./wasm/AgentVault.wasm \
  --install-upgrade \
  --pricing-mode fixed \
  --gas-price-tolerance 1 \
  --payment-amount 300000000000
```

Record the contract hash from the deploy result and set it in env files below.

### 2a. Deploy verification checklist

After submitting the install transaction, verify execution before moving to agent/web:

```bash
casper-client get-transaction \
  --node-address https://node.testnet.cspr.cloud/rpc \
  <TXN_HASH>
```

Deployment is ready when:

- `execution_result` is successful
- a contract hash appears in transforms/named keys
- the hash is copied to `CONTRACT_HASH` in both `agent/.env` and `web/.env.local`

### 3. Agent backend

```bash
cd agent
npm install
cp .env.example .env   # if present; otherwise create .env
```

`.env` keys:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | AI intent parsing |
| `CONTRACT_HASH` | Deployed AgentVault hash |
| `AGENT_SECRET_KEY_PATH` | Agent key PEM for signing `agent_pay` (optional) |
| `CASPER_NODE_URL` | Default `https://node.testnet.cspr.cloud/rpc` |

```bash
npm run dev
# POST http://localhost:3001/api/agent-action
```

### 4. Web proof UI

```bash
export PATH="/Users/kamal/.nvm/versions/node/v24.9.0/bin:$PATH"
cd web
npm install
```

`.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CSPR_CLICK_APP_ID` | From [cspr.click](https://cspr.click) |
| `NEXT_PUBLIC_AGENT_URL` | Default `http://localhost:3001` |
| `CONTRACT_HASH` | For `/api/events` |
| `CSPR_CLOUD_ACCESS_KEY` | CSPR.cloud token for event reads |

```bash
npm run dev
# http://localhost:3000
```

## Demo loop

1. Owner deploys AgentVault and calls `set_policy` for an agent key.
2. User opens the web app and connects CSPR.click.
3. User describes a spend intent; agent parses and checks off-chain policy.
4. Agent builds `agent_pay` via casper-js-sdk and submits (if `AGENT_SECRET_KEY_PATH` is set).
5. Proof table shows `PaymentExecuted` events from CSPR.cloud.

## Proof table template

Use this template during demos and QA runs to capture the proof-first loop:

| Timestamp (UTC) | Network | Contract Hash | Txn Hash | Agent Key | Recipient/Target | Amount (motes) | Purpose Hash | Policy Result | Event Status |
|-----------------|---------|---------------|----------|-----------|------------------|----------------|--------------|---------------|--------------|
|                 |         |               |          |           |                  |                |              |               |              |
|                 |         |               |          |           |                  |                |              |               |              |
|                 |         |               |          |           |                  |                |              |               |              |

## Casper primitives

Odra smart contract, CSPR.click wallet flow, CSPR.cloud event reads.

## Docs

- [PRD](PRD.md)
- [Build Plan](BUILD_PLAN.md)
- [Demo and Submission](DEMO_AND_SUBMISSION.md)
- [Risk Register](RISK_REGISTER.md)
