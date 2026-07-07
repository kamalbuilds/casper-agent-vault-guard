import fs from "fs";
import {
  Args,
  CLValue,
  ContractCallBuilder,
  HttpHandler,
  Key,
  KeyAlgorithm,
  PrivateKey,
  PublicKey,
  RpcClient,
  Transaction,
} from "casper-js-sdk";

export const AGENT_PAY_ENTRY_POINT = "agent_pay";

/** Gas budget in motes (5 CSPR) for a single contract call. */
export const AGENT_PAY_PAYMENT_MOTES = 5_000_000_000;

export const DEFAULT_NODE_URL =
  process.env.CASPER_NODE_URL || "https://node.testnet.cspr.cloud/rpc";

export const DEFAULT_CHAIN_NAME =
  process.env.CASPER_CHAIN_NAME || "casper-test";

function normalizeContractHash(contractHash: string): string {
  return contractHash.trim().replace(/^hash-/, "").replace(/^contract-/, "");
}

/**
 * Resolves a Casper address string into a `Key` for contract runtime args.
 */
export function targetHexToKey(target: string): Key {
  const trimmed = target.trim();
  if (
    trimmed.startsWith("account-hash-") ||
    trimmed.startsWith("hash-") ||
    trimmed.startsWith("uref-") ||
    trimmed.startsWith("contract-") ||
    trimmed.startsWith("addressable-entity-")
  ) {
    return Key.newKey(trimmed);
  }
  const publicKey = PublicKey.fromHex(trimmed);
  return Key.newKey(publicKey.accountHash().toPrefixedString());
}

export interface BuildAgentPayParams {
  agentPublicKeyHex: string;
  contractHash: string;
  targetHex: string;
  amountMotes: string;
  purposeHash: string;
  chainName?: string;
  paymentMotes?: number;
}

/**
 * Builds an unsigned `agent_pay` contract-call transaction for AgentVault.
 */
export function buildAgentPayTransaction(params: BuildAgentPayParams): Transaction {
  const {
    agentPublicKeyHex,
    contractHash,
    targetHex,
    amountMotes,
    purposeHash,
    chainName = DEFAULT_CHAIN_NAME,
    paymentMotes = AGENT_PAY_PAYMENT_MOTES,
  } = params;

  const agentPublicKey = PublicKey.fromHex(agentPublicKeyHex);
  const targetKey = targetHexToKey(targetHex);

  const args = Args.fromMap({
    target: CLValue.newCLKey(targetKey),
    amount: CLValue.newCLUInt512(amountMotes),
    purpose_hash: CLValue.newCLString(purposeHash),
  });

  return new ContractCallBuilder()
    .from(agentPublicKey)
    .byHash(normalizeContractHash(contractHash))
    .entryPoint(AGENT_PAY_ENTRY_POINT)
    .runtimeArgs(args)
    .chainName(chainName)
    .payment(paymentMotes)
    .build();
}

export interface SubmitResult {
  txHash: string | null;
  transactionJson: object | null;
  chainNote: string;
}

/**
 * Signs and submits when `AGENT_SECRET_KEY_PATH` is set; otherwise returns the
 * unsigned transaction JSON for wallet-side signing.
 */
export async function submitAgentPayTransaction(
  transaction: Transaction
): Promise<SubmitResult> {
  const secretKeyPath = process.env.AGENT_SECRET_KEY_PATH;

  if (!secretKeyPath) {
    return {
      txHash: null,
      transactionJson: transaction.toJSON() as object,
      chainNote:
        "Built unsigned agent_pay transaction. Set AGENT_SECRET_KEY_PATH to auto-submit from the agent.",
    };
  }

  let pem: string;
  try {
    pem = fs.readFileSync(secretKeyPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      txHash: null,
      transactionJson: transaction.toJSON() as object,
      chainNote: `Could not read AGENT_SECRET_KEY_PATH: ${message}`,
    };
  }

  const privateKey = PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  transaction.sign(privateKey);

  const handler = new HttpHandler(DEFAULT_NODE_URL);
  const rpc = new RpcClient(handler);
  const result = await rpc.putTransaction(transaction);

  return {
    txHash: String(result.transactionHash),
    transactionJson: null,
    chainNote: "Submitted agent_pay to Casper testnet.",
  };
}

export function explorerTxUrl(hash: string): string {
  return `https://testnet.cspr.live/deploy/${hash}`;
}
