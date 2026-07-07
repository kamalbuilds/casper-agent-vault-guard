"use client";

import { ClickProvider, ClickUI } from "@make-software/csprclick-ui";
import { CONTENT_MODE } from "@make-software/csprclick-types";
import type { CsprClickInitOptions } from "@make-software/csprclick-web-sdk/types";

const clickOptions: CsprClickInitOptions = {
  appName: "AgentVault Guard",
  appId: process.env.NEXT_PUBLIC_CSPR_CLICK_APP_ID || "",
  contentMode: CONTENT_MODE.IFRAME,
  providers: ["casper-wallet", "ledger", "casperdash", "metamask-snap"],
  chainName: process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test",
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClickProvider options={clickOptions}>
      <ClickUI />
      {children}
    </ClickProvider>
  );
}
