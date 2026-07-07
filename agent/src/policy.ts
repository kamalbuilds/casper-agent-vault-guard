import { z } from "zod";

export const PolicySchema = z.object({
  agent: z.string().describe("Agent address"),
  maxPerTx: z.string().describe("Max amount per transaction in motes"),
  dailyCap: z.string().describe("Daily spending cap in motes"),
  allowedTarget: z.string().describe("Allowed recipient address"),
  expiry: z.number().describe("Policy expiry timestamp"),
  purposes: z.array(z.string()).describe("Allowed purpose hashes or purpose types"),
});

export type Policy = z.infer<typeof PolicySchema>;

export const ActionRequestSchema = z.object({
  target: z.string().describe("Recipient address"),
  amount: z.string().describe("Amount in motes"),
  purpose: z.string().describe("Purpose hash or purpose description"),
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export interface PolicyEvaluation {
  allowed: boolean;
  reason: string;
  violatedRule?: string;
}

export function evaluate(request: ActionRequest, policy: Policy): PolicyEvaluation {
  const now = Date.now();

  if (now > policy.expiry * 1000) {
    return {
      allowed: false,
      reason: "Policy has expired",
      violatedRule: "Expired",
    };
  }

  if (request.target !== policy.allowedTarget) {
    return {
      allowed: false,
      reason: `Target address ${request.target} is not in the allowed recipients list`,
      violatedRule: "WrongTarget",
    };
  }

  const amount = BigInt(request.amount);
  const maxPerTx = BigInt(policy.maxPerTx);
  if (amount > maxPerTx) {
    return {
      allowed: false,
      reason: `Amount ${request.amount} exceeds per-transaction limit of ${policy.maxPerTx}`,
      violatedRule: "AmountExceedsLimit",
    };
  }

  const dailyCap = BigInt(policy.dailyCap);
  if (amount > dailyCap) {
    return {
      allowed: false,
      reason: `Amount ${request.amount} exceeds daily cap of ${policy.dailyCap}`,
      violatedRule: "DailyCapExceeded",
    };
  }

  const purposeNormalized = request.purpose.toLowerCase().trim();
  const allowedPurposes = policy.purposes.map((p) => p.toLowerCase());

  if (!allowedPurposes.includes(purposeNormalized)) {
    return {
      allowed: false,
      reason: `Purpose "${request.purpose}" is not in the list of allowed purposes: ${policy.purposes.join(", ")}`,
      violatedRule: "WrongPurpose",
    };
  }

  return {
    allowed: true,
    reason: `Action approved: ${request.amount} motes to ${request.target} for purpose "${request.purpose}"`,
  };
}

export function dailyCapAsCSPR(motes: string): string {
  const num = BigInt(motes);
  const cspr = num / BigInt(1_000_000_000);
  return cspr.toString();
}

export function motes(cspr: number): string {
  return (BigInt(cspr) * BigInt(1_000_000_000)).toString();
}
