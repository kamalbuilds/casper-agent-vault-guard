import { parseJSON, DEFAULT_MODEL } from "./ai.js";
import {
  buildAgentPayTransaction,
  submitAgentPayTransaction,
} from "./cspr.js";
import { evaluate, ActionRequest, Policy, PolicyEvaluation } from "./policy.js";

export interface AgentDecision {
  intentText: string;
  parsedAction: ActionRequest | null;
  policyEvaluation: PolicyEvaluation;
  aiReasoning: string;
  success: boolean;
  txHash: string | null;
  transactionJson: object | null;
  chainNote: string | null;
}

export async function runAgentAction(
  intentText: string,
  policy: Policy,
  model: string = DEFAULT_MODEL
): Promise<AgentDecision> {
  const prompt = `You are an agent that parses natural language spend intents and converts them to structured JSON.

User intent: "${intentText}"

Parse this into a JSON object with exactly these fields:
{
  "target": "the recipient Casper address",
  "amount": "the amount in motes (1 CSPR = 1,000,000,000 motes)",
  "purpose": "one of: ${policy.purposes.join(", ")}"
}

Important:
- The amount must be a string representing motes
- The target must be a valid Casper address (40-character hex string starting with '01')
- The purpose must match one of the allowed purposes exactly
- If the user's intent is ambiguous or impossible, respond with your best guess but note the uncertainty in an "uncertainty" field

Respond with ONLY the JSON object, no additional text.`;

  let parsedAction: ActionRequest | null = null;
  let aiReasoning: string;

  try {
    parsedAction = await parseJSON<ActionRequest>(prompt, model, 1);
    aiReasoning = `Parsed intent: target=${parsedAction.target}, amount=${parsedAction.amount} motes, purpose=${parsedAction.purpose}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    aiReasoning = `Failed to parse intent: ${errorMsg}`;
    return {
      intentText,
      parsedAction: null,
      policyEvaluation: {
        allowed: false,
        reason: `Could not parse intent from AI: ${errorMsg}`,
        violatedRule: "ParseError",
      },
      aiReasoning,
      success: false,
      txHash: null,
      transactionJson: null,
      chainNote: null,
    };
  }

  const policyEvaluation = evaluate(parsedAction, policy);

  if (!policyEvaluation.allowed) {
    return {
      intentText,
      parsedAction,
      policyEvaluation,
      aiReasoning,
      success: false,
      txHash: null,
      transactionJson: null,
      chainNote: null,
    };
  }

  const contractHash = process.env.CONTRACT_HASH;
  if (!contractHash) {
    return {
      intentText,
      parsedAction,
      policyEvaluation,
      aiReasoning,
      success: true,
      txHash: null,
      transactionJson: null,
      chainNote:
        "Policy check passed. Set CONTRACT_HASH to build an on-chain agent_pay transaction.",
    };
  }

  try {
    const transaction = buildAgentPayTransaction({
      agentPublicKeyHex: policy.agent,
      contractHash,
      targetHex: parsedAction.target,
      amountMotes: parsedAction.amount,
      purposeHash: parsedAction.purpose,
    });

    const submit = await submitAgentPayTransaction(transaction);

    return {
      intentText,
      parsedAction,
      policyEvaluation,
      aiReasoning,
      success: true,
      txHash: submit.txHash,
      transactionJson: submit.transactionJson,
      chainNote: submit.chainNote,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      intentText,
      parsedAction,
      policyEvaluation,
      aiReasoning,
      success: false,
      txHash: null,
      transactionJson: null,
      chainNote: `Failed to build or submit agent_pay: ${errorMsg}`,
    };
  }
}
