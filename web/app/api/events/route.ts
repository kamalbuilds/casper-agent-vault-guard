import { NextResponse } from "next/server";
import type { ProofEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CsprCloudEventEnvelope {
  name?: string;
  event_name?: string;
  contract_event_name?: string;
  deploy_hash?: string;
  transaction_hash?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function pickString(envelope: CsprCloudEventEnvelope, keys: string[]): string {
  for (const key of keys) {
    const fromData = envelope.data?.[key];
    if (typeof fromData === "string") return fromData;
    const fromTop = envelope[key];
    if (typeof fromTop === "string") return fromTop;
  }
  return "";
}

function isPaymentExecuted(envelope: CsprCloudEventEnvelope): boolean {
  const name =
    envelope.name || envelope.event_name || envelope.contract_event_name;
  if (name) {
    return name === "PaymentExecuted";
  }
  return Boolean(envelope.data?.purpose_hash || envelope.data?.["purpose_hash"]);
}

function toProofEvent(envelope: CsprCloudEventEnvelope): ProofEvent {
  return {
    time: envelope.timestamp || "",
    agent: pickString(envelope, ["agent"]),
    target: pickString(envelope, ["target"]),
    amount: pickString(envelope, ["amount"]),
    purposeHash: pickString(envelope, ["purpose_hash", "purposeHash"]),
    deployHash: envelope.deploy_hash || envelope.transaction_hash || "",
  };
}

export async function GET() {
  const contractHash = process.env.CONTRACT_HASH;
  const accessKey = process.env.CSPR_CLOUD_ACCESS_KEY;

  if (!contractHash || !accessKey) {
    return NextResponse.json({ configured: false, events: [] });
  }

  const normalizedHash = contractHash.replace(/^hash-/, "");
  const url = `https://api.testnet.cspr.cloud/contracts/${normalizedHash}/events?page=1&limit=25`;

  try {
    const res = await fetch(url, {
      headers: { authorization: accessKey },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[api/events] cspr.cloud fetch failed:", res.status);
      return NextResponse.json(
        { configured: true, error: `CSPR.cloud returned ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const raw: CsprCloudEventEnvelope[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];

    const events = raw.filter(isPaymentExecuted).map(toProofEvent);

    return NextResponse.json({ configured: true, events });
  } catch (err) {
    console.error("[api/events] request to cspr.cloud threw:", err);
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "Unknown fetch error",
      },
      { status: 502 }
    );
  }
}
