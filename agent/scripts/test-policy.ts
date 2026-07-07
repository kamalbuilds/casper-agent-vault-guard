import { evaluate, ActionRequest, Policy } from "../src/policy.js";

const policy: Policy = {
  agent: "01abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
  maxPerTx: "1000000000000",
  dailyCap: "5000000000000",
  allowedTarget: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
  expiry: 9999999999,
  purposes: ["hosting_payment", "vendor_payment", "service_fee"],
};

console.log("=== POLICY EVALUATION TESTS ===\n");
console.log("Policy Configuration:");
console.log(`  Agent:          ${policy.agent}`);
console.log(`  Max Per Tx:     ${policy.maxPerTx} motes (1000 CSPR)`);
console.log(`  Daily Cap:      ${policy.dailyCap} motes (5000 CSPR)`);
console.log(`  Allowed Target: ${policy.allowedTarget}`);
console.log(`  Expiry:         ${policy.expiry} (unix timestamp)`);
console.log(`  Allowed Purposes: ${policy.purposes.join(", ")}\n`);

const testCases: Array<{
  name: string;
  action: ActionRequest;
  expectAllowed: boolean;
  expectViolation?: string;
}> = [
  {
    name: "ALLOWED: Standard payment within limits",
    action: {
      target: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
      amount: "500000000000",
      purpose: "hosting_payment",
    },
    expectAllowed: true,
  },
  {
    name: "BLOCKED: Amount exceeds per-transaction limit",
    action: {
      target: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
      amount: "1500000000000",
      purpose: "hosting_payment",
    },
    expectAllowed: false,
    expectViolation: "AmountExceedsLimit",
  },
  {
    name: "BLOCKED: Wrong target address",
    action: {
      target: "01wrongaddress1234567890abcdef1234567890abcdef1234567890ab",
      amount: "500000000000",
      purpose: "hosting_payment",
    },
    expectAllowed: false,
    expectViolation: "WrongTarget",
  },
  {
    name: "BLOCKED: Purpose not in allowed list",
    action: {
      target: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
      amount: "500000000000",
      purpose: "gambling",
    },
    expectAllowed: false,
    expectViolation: "WrongPurpose",
  },
  {
    name: "ALLOWED: Alternative allowed purpose",
    action: {
      target: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
      amount: "250000000000",
      purpose: "vendor_payment",
    },
    expectAllowed: true,
  },
  {
    name: "ALLOWED: Third allowed purpose",
    action: {
      target: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
      amount: "100000000000",
      purpose: "service_fee",
    },
    expectAllowed: true,
  },
  {
    name: "ALLOWED: Amount between per-tx and daily cap limits",
    action: {
      target: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
      amount: "800000000000",
      purpose: "hosting_payment",
    },
    expectAllowed: true,
  },
  {
    name: "ALLOWED: Maximum allowed per transaction",
    action: {
      target: "01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543",
      amount: "1000000000000",
      purpose: "hosting_payment",
    },
    expectAllowed: true,
  },
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = evaluate(testCase.action, policy);

  const passed_check =
    result.allowed === testCase.expectAllowed &&
    (!testCase.expectViolation || result.violatedRule === testCase.expectViolation);

  if (passed_check) {
    passed++;
    console.log(`✓ PASS: ${testCase.name}`);
  } else {
    failed++;
    console.log(`✗ FAIL: ${testCase.name}`);
    console.log(`  Expected: allowed=${testCase.expectAllowed}, violation=${testCase.expectViolation}`);
    console.log(`  Got:      allowed=${result.allowed}, violation=${result.violatedRule}`);
  }

  console.log(`  Reason: ${result.reason}\n`);
}

console.log("=== TEST SUMMARY ===");
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);
console.log("");

if (failed === 0) {
  console.log("All tests passed!");
  process.exit(0);
} else {
  console.log(`${failed} test(s) failed.`);
  process.exit(1);
}
