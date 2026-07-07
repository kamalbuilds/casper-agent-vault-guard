export interface ProofEvent {
  time: string;
  agent: string;
  target: string;
  amount: string;
  purposeHash: string;
  deployHash: string;
}

export interface AgentDecision {
  intentText: string;
  parsedAction: {
    target: string;
    amount: string;
    purpose: string;
  } | null;
  policyEvaluation: {
    allowed: boolean;
    reason: string;
    violatedRule?: string;
  };
  aiReasoning: string;
  success: boolean;
  txHash: string | null;
  transactionJson: object | null;
  chainNote: string | null;
}
