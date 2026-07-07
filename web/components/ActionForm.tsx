"use client";

import { useCsprAccount } from "@/lib/useCsprAccount";
import { explorerTxUrl, truncateMiddle } from "@/lib/cspr";
import type { AgentDecision } from "@/lib/types";
import { useState } from "react";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

const DEMO_INTENT =
  "pay 50 CSPR to 01fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543 for hosting_payment";

export function ActionForm() {
  const { account, connecting, error: walletError, connect } = useCsprAccount();
  const [intentText, setIntentText] = useState(DEMO_INTENT);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<AgentDecision | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!intentText.trim()) {
      return;
    }

    setSubmitting(true);
    setApiError(null);
    setDecision(null);

    try {
      const res = await fetch(`${AGENT_URL}/api/agent-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentText }),
      });

      const body = (await res.json()) as AgentDecision & { error?: string };

      if (!res.ok) {
        setApiError(body.error || `Agent request failed (${res.status})`);
        return;
      }

      setDecision(body);
    } catch (err) {
      setApiError(
        `Could not reach agent at ${AGENT_URL}. Is it running? (${
          err instanceof Error ? err.message : String(err)
        })`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Agent action</h2>
        <span className="badge">Policy-gated spend</span>
      </div>
      <p className="card-sub">
        Describe a payment in plain language. The agent parses it, checks the
        off-chain policy, then builds an <code>agent_pay</code> transaction for
        the on-chain vault.
      </p>

      {!account?.public_key ? (
        <div className="wallet-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? "Opening wallet..." : "Connect wallet"}
          </button>
          {walletError ? <span className="field-error">{walletError}</span> : null}
        </div>
      ) : (
        <p className="field-hint">
          Connected: <span className="mono">{truncateMiddle(account.public_key, 8, 6)}</span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span className="field-label">Spend intent</span>
          <textarea
            className="input textarea"
            rows={3}
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            placeholder="pay 10 CSPR to 01... for vendor_payment"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Running agent..." : "Run agent action"}
        </button>
      </form>

      {apiError ? <div className="alert alert-error">{apiError}</div> : null}

      {decision ? (
        <div className={`result ${decision.success ? "result-ok" : "result-blocked"}`}>
          <p>
            <strong>Policy:</strong>{" "}
            {decision.policyEvaluation.allowed ? "allowed" : "blocked"}
          </p>
          <p>{decision.policyEvaluation.reason}</p>
          {decision.parsedAction ? (
            <p className="mono field-hint">
              {decision.parsedAction.amount} motes to{" "}
              {truncateMiddle(decision.parsedAction.target, 8, 6)} (
              {decision.parsedAction.purpose})
            </p>
          ) : null}
          {decision.txHash ? (
            <p>
              <strong>Tx hash:</strong>{" "}
              <a
                className="mono link"
                href={explorerTxUrl(decision.txHash)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {truncateMiddle(decision.txHash, 10, 8)}
              </a>
            </p>
          ) : null}
          {decision.chainNote ? (
            <p className="field-hint">{decision.chainNote}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
