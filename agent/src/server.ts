import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { runAgentAction } from "./agent.js";
import { Policy, PolicySchema } from "./policy.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.options("*", (_req: Request, res: Response) => {
  res.sendStatus(200);
});

interface AgentActionRequest {
  intentText: string;
  policy?: Policy;
}

app.post("/api/agent-action", async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const { intentText, policy } = _req.body as AgentActionRequest;

    if (!intentText || typeof intentText !== "string") {
      return res.status(400).json({
        error: "Missing or invalid intentText",
        example: {
          intentText: "pay 50 CSPR to address 01abc... for hosting",
          policy: {
            agent: "01...",
            maxPerTx: "1000000000000",
            dailyCap: "5000000000000",
            allowedTarget: "01...",
            expiry: 9999999999,
            purposes: ["hosting_payment", "vendor_payment"],
          },
        },
      });
    }

    let policyToUse = policy;

    if (!policyToUse) {
      try {
        const demoPath = path.join(__dirname, "../demo-policy.json");
        const demoContent = fs.readFileSync(demoPath, "utf-8");
        policyToUse = JSON.parse(demoContent) as Policy;
      } catch (error) {
        console.error("[server] Failed to load demo policy:", error);
        return res.status(400).json({
          error: "No policy provided and demo-policy.json not found",
        });
      }
    }

    PolicySchema.parse(policyToUse);

    console.log(
      `[agent] Processing intent: "${intentText}" against policy for agent ${policyToUse.agent}`
    );

    const decision = await runAgentAction(intentText, policyToUse);

    return res.json(decision);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[server] Error in /api/agent-action:", errorMsg);

    if (errorMsg.includes("validation")) {
      return res.status(400).json({
        error: "Invalid policy format",
        message: errorMsg,
      });
    }

    return res.status(500).json({
      error: "Failed to process agent action",
      message: errorMsg,
    });
  }
});

app.get("/health", (_req: Request, res: Response): void => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  };
  res.json(health);
});

app.get("/", (_req: Request, res: Response): void => {
  res.json({
    name: "AgentVault Guard Agent Backend",
    version: "1.0.0",
    description: "AI-powered policy enforcement backend for Casper AgentVault",
    endpoints: {
      health: "GET /health",
      agentAction: "POST /api/agent-action",
    },
  });
});

app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    error: "Not Found",
    path: _req.path,
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error("[server] Uncaught error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

const server = app.listen(PORT, () => {
  console.log(`[server] AgentVault Guard agent running on http://localhost:${PORT}`);
  console.log(`[server] POST /api/agent-action - Process agent intent and evaluate policy`);
  console.log(`[server] GET /health - Server health check`);
});

process.on("SIGINT", () => {
  console.log("[server] Shutting down gracefully...");
  server.close(() => {
    console.log("[server] Server closed");
    process.exit(0);
  });
});
