import dotenv from "dotenv";
import { runAgentAction } from "./agent.js";
import { Policy, PolicySchema } from "./policy.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const intentText = process.argv[2];

  if (!intentText) {
    console.error(
      "Usage: tsx src/cli.ts <intent_text> [policy_json_path]\n\nExample:\n  tsx src/cli.ts 'pay 50 CSPR to 01abc... for hosting'\n"
    );
    process.exit(1);
  }

  const policyPath = process.argv[3] || path.join(__dirname, "../demo-policy.json");

  let policy: Policy;

  try {
    const policyContent = fs.readFileSync(policyPath, "utf-8");
    policy = JSON.parse(policyContent);
    PolicySchema.parse(policy);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[cli] Failed to load policy from ${policyPath}:`, errorMsg);
    process.exit(1);
  }

  console.log("[cli] Processing intent:", intentText);
  console.log("[cli] Using policy from:", policyPath);
  console.log("[cli] Policy purposes:", policy.purposes.join(", "));
  console.log("");

  try {
    const decision = await runAgentAction(intentText, policy);

    console.log("=== AGENT DECISION ===\n");

    console.log("Input Intent:");
    console.log(`  "${decision.intentText}"\n`);

    if (decision.parsedAction) {
      console.log("Parsed Action:");
      console.log(`  Target:  ${decision.parsedAction.target}`);
      console.log(`  Amount:  ${decision.parsedAction.amount} motes`);
      console.log(`  Purpose: ${decision.parsedAction.purpose}\n`);
    }

    console.log("Policy Evaluation:");
    console.log(`  Allowed: ${decision.policyEvaluation.allowed}`);
    console.log(`  Reason:  ${decision.policyEvaluation.reason}`);
    if (decision.policyEvaluation.violatedRule) {
      console.log(`  Violated Rule: ${decision.policyEvaluation.violatedRule}`);
    }
    console.log("");

    console.log("AI Reasoning:");
    console.log(`  ${decision.aiReasoning}\n`);

    console.log("=== JSON OUTPUT ===\n");
    console.log(JSON.stringify(decision, null, 2));

    process.exit(decision.success ? 0 : 1);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[cli] Error processing intent:", errorMsg);
    process.exit(1);
  }
}

main();
