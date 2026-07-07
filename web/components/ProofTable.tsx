"use client";

import { explorerTxUrl, truncateMiddle } from "@/lib/cspr";
import type { ProofEvent } from "@/lib/types";
import { useEffect, useState } from "react";

type LoadState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; events: ProofEvent[] };

export function ProofTable() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        const body = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setState({
            status: "error",
            message: body?.error || `Request failed (${res.status})`,
          });
          return;
        }

        if (!body.configured) {
          setState({ status: "unconfigured" });
          return;
        }

        setState({ status: "ready", events: body.events ?? [] });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Network error",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h2>On-chain proof</h2>
        <span className="badge badge-neutral">PaymentExecuted</span>
      </div>
      <p className="card-sub">
        Allowed agent payments emit <code>PaymentExecuted</code> on Casper.
        This table reads that log from CSPR.cloud, not a local cache.
      </p>

      {state.status === "loading" ? (
        <p className="field-hint">Loading events...</p>
      ) : null}

      {state.status === "unconfigured" ? (
        <div className="empty-state">
          Set <code>CONTRACT_HASH</code> and <code>CSPR_CLOUD_ACCESS_KEY</code>{" "}
          in the web app environment after deploying AgentVault.
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="alert alert-error">{state.message}</div>
      ) : null}

      {state.status === "ready" && state.events.length === 0 ? (
        <div className="empty-state">
          No payments on-chain yet. Run an allowed agent action above.
        </div>
      ) : null}

      {state.status === "ready" && state.events.length > 0 ? (
        <table className="proof-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Agent</th>
              <th>Target</th>
              <th>Amount</th>
              <th>Purpose</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {state.events.map((event) => (
              <tr key={`${event.deployHash}-${event.purposeHash}`}>
                <td>{event.time || "—"}</td>
                <td className="mono">{truncateMiddle(event.agent, 8, 6)}</td>
                <td className="mono">{truncateMiddle(event.target, 8, 6)}</td>
                <td className="mono">{event.amount || "—"}</td>
                <td className="mono">{truncateMiddle(event.purposeHash, 10, 6)}</td>
                <td className="mono">
                  {event.deployHash ? (
                    <a
                      href={explorerTxUrl(event.deployHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {truncateMiddle(event.deployHash, 8, 6)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
