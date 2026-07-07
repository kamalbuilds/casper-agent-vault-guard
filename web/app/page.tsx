"use client";

import dynamic from "next/dynamic";

const HomeView = dynamic(
  () => import("@/components/HomeView").then((mod) => mod.HomeView),
  {
    ssr: false,
    loading: () => (
      <main className="page">
        <div className="container">
          <p className="field-hint">Loading AgentVault Guard...</p>
        </div>
      </main>
    ),
  }
);

export default function Home() {
  return <HomeView />;
}
