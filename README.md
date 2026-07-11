# AgentVault Guard

**AI agents can spend, but cannot steal from the users.**

AgentVault Guard is a scoped spending-policy vault for autonomous AI agents on the Casper blockchain. Owners grant agent keys limited permissions with per-transaction caps, daily limits, allowed recipients, expiry, and purpose hashes. Every payment is enforced on-chain and emits an auditable receipt. Built with the Odra 2.8.2 framework for Casper 2.0.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Contract Addresses](#contract-addresses)
- [Getting Started](#getting-started)
- [Frontend](#frontend)
- [Security](#security)
- [License](#license)
- [Links](#links)

---

## Overview

AgentVault Guard solves the hot-key problem in agentic finance. Instead of handing an LLM or backend agent full wallet authority, the owner deploys an AgentVault contract and registers scoped policies per agent key. The agent can call `agent_pay` only when every policy clause is satisfied. Violations revert with typed errors; successful payments emit `PaymentExecuted` events readable via CSPR.cloud.

### Key Metrics (Testnet)

| Metric | Value |
|--------|-------|
| **Network** | Casper Testnet |
| **Framework** | Odra 2.8.2 |
| **Deploy Account** | passionate-dev7 |
| **Agent Port** | 3001 |
| **Web Port** | 3000 |

---

## Features

- **Scoped Agent Policies**: Per-agent limits on amount, recipient, expiry, and purpose
- **Daily Spend Caps**: Rolling per-day counters prevent runaway spending
- **Instant Revocation**: Owner can disable any agent policy on-chain
- **Purpose Binding**: Every payment must match a registered purpose hash
- **Auditable Receipts**: `PaymentExecuted` events for proof tables and compliance
- **AI Intent Parsing**: Agent backend translates natural language into policy checks
- **CSPR.click Integration**: Owner wallet flow in the Next.js proof UI

---

## Architecture

```
                    +------------------+
                    |   Owner Wallet   |
                    |   (CSPR.click)   |
                    +--------+---------+
                             |
              set_policy / revoke_policy
                             v
+----------------------------------------------------------+
|              AgentVault Contract (Odra)                   |
|  - set_policy(): Register scoped spending rules           |
|  - agent_pay(): Enforce limits and emit receipt           |
|  - revoke_policy(): Disable agent immediately             |
+---------------------------+------------------------------+
                            |
                            v
+----------------------------------------------------------+
|              Agent Backend (port 3001)                    |
|  - POST /api/agent-action: Parse intent via OpenRouter    |
|  - Off-chain policy pre-check before on-chain submit      |
|  - Build agent_pay deploy via casper-js-sdk               |
+---------------------------+------------------------------+
                            |
                            v
+----------------------------------------------------------+
|              Web Proof UI (Next.js)                       |
|  - Connect wallet via CSPR.click                          |
|  - Submit spend intents to agent                          |
|  - Display PaymentExecuted events from CSPR.cloud         |
+----------------------------------------------------------+
```

### User Flow

```
+--------+    describe intent    +-------------+    agent_pay()    +-------------+
| Owner  | --------------------> | Agent (3001)| ----------------> | AgentVault  |
|        |                       |             |                   |             |
|        | <-------------------- |             | <---------------- |             |
+--------+   PaymentExecuted     +-------------+   policy enforced  +-------------+
```

---

## Smart Contracts

### AgentVault

The core vault contract managing per-agent spending policies and payment enforcement.

**Entry Points:**

| Function | Description | Parameters |
|----------|-------------|------------|
| `init` | Initialize vault with deployer as owner | - |
| `set_policy` | Register or update an agent policy | `agent: Address, max_per_tx: U512, daily_cap: U512, allowed_target: Address, expiry: u64, purpose_hash: String` |
| `revoke_policy` | Disable an agent policy | `agent: Address` |
| `agent_pay` | Execute an in-policy payment | `target: Address, amount: U512, purpose_hash: String` |
| `get_owner` | Return the vault owner | - |
| `get_policy` | Return policy for an agent | `agent: Address` |
| `get_spent_today` | Return agent spend in current day bucket | `agent: Address` |

**Events:**

| Event | Description |
|-------|-------------|
| `PolicySet` | Owner registered or updated an agent policy |
| `PolicyRevoked` | Owner disabled an agent policy |
| `PaymentExecuted` | Agent completed an in-policy payment |

---

## Contract Addresses

### Casper Testnet

| Contract | Package Hash | Explorer |
|----------|--------------|----------|
| **AgentVault** | `hash-6ccaa68fd5240f462ecd8c202182e60812b7971fca8049842c9b1b90ec9e00f4` | [View on cspr.live](https://testnet.cspr.live/package/hash-6ccaa68fd5240f462ecd8c202182e60812b7971fca8049842c9b1b90ec9e00f4) |

### Network Configuration

| Setting | Value |
|---------|-------|
| **Chain Name** | `casper-test` |
| **Node URL** | `https://node.testnet.casper.network` |
| **CSPR.cloud RPC** | `https://node.testnet.cspr.cloud/rpc` |
| **Explorer** | `https://testnet.cspr.live` |
| **Deploy Account** | passionate-dev7 |

---

## Getting Started

### Prerequisites

- Rust 1.70+
- Cargo
- Odra CLI 2.8.2
- Node.js 18+
- Casper testnet account funded via the [testnet faucet](https://testnet.cspr.live/tools/faucet)

### Build Contracts

```bash
cd contract
cargo odra test
cargo odra build
```

Wasm output lands at `contract/wasm/AgentVault.wasm`.

### Deploy Contracts

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

Record the contract hash from the deploy result and set it in environment files below.

Verify deployment:

```bash
casper-client get-transaction \
  --node-address https://node.testnet.cspr.cloud/rpc \
  <TXN_HASH>
```

### Run Agent Backend

```bash
cd agent
npm install
cp .env.example .env
npm run dev
```

Agent listens at `http://localhost:3001`. Primary endpoint: `POST /api/agent-action`.

### Run Web UI

```bash
cd web
npm install
npm run dev
```

Web UI available at `http://localhost:3000`.

---

## Frontend

The web app is a Next.js application with CSPR.click wallet integration.

### Pages

- **Home**: Connect wallet, describe spend intent, view policy status
- **Proof Table**: Display `PaymentExecuted` events from CSPR.cloud

### Wallet Integration

Uses [CSPR.click](https://cspr.click) for wallet connection supporting:

- Casper Wallet
- Ledger
- Torus Wallet
- CasperDash
- MetaMask Snap

### Environment Variables

**Agent (`agent/.env`):**

```env
OPENROUTER_API_KEY=sk_test_your_key_here
OPENROUTER_MODEL=anthropic/claude-sonnet-5
CONTRACT_HASH=hash-6ccaa68fd5240f462ecd8c202182e60812b7971fca8049842c9b1b90ec9e00f4
CASPER_NODE_ADDRESS=https://node.testnet.cspr.cloud/rpc
CSPR_CLOUD_ACCESS_KEY=your_cspr_cloud_token_here
PORT=3001
```

**Web (`web/.env.local`):**

```env
NEXT_PUBLIC_CSPR_CLICK_APP_ID=your_cspr_click_app_id
NEXT_PUBLIC_AGENT_URL=http://localhost:3001
CONTRACT_HASH=hash-6ccaa68fd5240f462ecd8c202182e60812b7971fca8049842c9b1b90ec9e00f4
CSPR_CLOUD_ACCESS_KEY=your_cspr_cloud_token_here
```

---

## Security

### Access Control

- Owner-only functions: `set_policy`, `revoke_policy`
- `agent_pay` callable only by registered agent keys
- Policy revocation takes effect immediately on-chain

### Policy Enforcement

- Per-transaction amount cap (`max_per_tx`)
- Rolling daily spend cap (`daily_cap`)
- Single allowed recipient address per policy
- Expiry timestamp enforced against block time
- Required purpose hash must match on every payment

### Safety Features

- Typed revert errors for every policy violation
- No withdrawal path for agents beyond scoped `agent_pay`
- Event emission on every successful payment for off-chain audit

### Audits

- [ ] Pending security audit

---

## License

MIT License. See [LICENSE](./LICENSE) for details.

---

## Links

- **Testnet Explorer**: [cspr.live](https://testnet.cspr.live)
- **Package**: [AgentVault on testnet](https://testnet.cspr.live/package/hash-6ccaa68fd5240f462ecd8c202182e60812b7971fca8049842c9b1b90ec9e00f4)
- **Casper Documentation**: [docs.casper.network](https://docs.casper.network)
- **Odra Framework**: [odra.dev](https://odra.dev)
- **CSPR.click**: [cspr.click](https://cspr.click)
- **CSPR.cloud**: [cspr.cloud](https://cspr.cloud)
