"use client";

import { useClickRef } from "@make-software/csprclick-ui";
import { CSPRCLICK_EVENTS } from "@make-software/csprclick-types";
import type { AccountType } from "@make-software/csprclick-types";
import { useCallback, useEffect, useState } from "react";

export interface CsprAccountState {
  account: AccountType | null;
  connecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

export function useCsprAccount(): CsprAccountState {
  const clickRef = useClickRef();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clickRef) {
      return;
    }

    let cancelled = false;

    clickRef
      .getActiveAccountAsync()
      .then((active: AccountType | null | undefined) => {
        if (!cancelled) {
          setAccount(active ?? null);
        }
      })
      .catch((err: unknown) => {
        console.error("[useCsprAccount] getActiveAccountAsync failed:", err);
      });

    const onSignedIn = (evt: { account: AccountType }) => {
      setConnecting(false);
      setError(null);
      setAccount(evt.account);
    };
    const onSwitched = (evt: { account: AccountType }) => {
      setAccount(evt.account);
    };
    const onSignedOut = () => setAccount(null);
    const onDisconnected = () => setAccount(null);

    clickRef.on(CSPRCLICK_EVENTS.SIGNED_IN, onSignedIn);
    clickRef.on(CSPRCLICK_EVENTS.SWITCHED_ACCOUNT, onSwitched);
    clickRef.on(CSPRCLICK_EVENTS.SIGNED_OUT, onSignedOut);
    clickRef.on(CSPRCLICK_EVENTS.DISCONNECTED, onDisconnected);

    return () => {
      cancelled = true;
      clickRef.off(CSPRCLICK_EVENTS.SIGNED_IN, onSignedIn);
      clickRef.off(CSPRCLICK_EVENTS.SWITCHED_ACCOUNT, onSwitched);
      clickRef.off(CSPRCLICK_EVENTS.SIGNED_OUT, onSignedOut);
      clickRef.off(CSPRCLICK_EVENTS.DISCONNECTED, onDisconnected);
    };
  }, [clickRef]);

  const connect = useCallback(() => {
    if (!clickRef) {
      setError("Wallet SDK is still loading, try again in a moment");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      clickRef.signIn();
    } catch (err) {
      console.error("[useCsprAccount] signIn failed:", err);
      setConnecting(false);
      setError("Failed to open the wallet sign-in flow");
    }
  }, [clickRef]);

  const disconnect = useCallback(() => {
    if (!clickRef) {
      return;
    }
    try {
      clickRef.signOut();
    } catch (err) {
      console.error("[useCsprAccount] signOut failed:", err);
    }
    setAccount(null);
  }, [clickRef]);

  return { account, connecting, error, connect, disconnect };
}
