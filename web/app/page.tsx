import { ActionForm } from "@/components/ActionForm";
import { ProofTable } from "@/components/ProofTable";

export default function Home() {
  return (
    <main className="page">
      <div className="container">
        <header className="hero">
          <span className="brand">AgentVault Guard</span>
          <h1>Agents spend within policy</h1>
          <p className="hero-sub">
            Connect a wallet, describe a payment, and watch the agent parse your
            intent, enforce policy, and submit an on-chain{" "}
            <code>agent_pay</code> call to the AgentVault contract.
          </p>
        </header>

        <section className="stack">
          <ActionForm />
          <ProofTable />
        </section>
      </div>
    </main>
  );
}
