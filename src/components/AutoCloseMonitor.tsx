"use client";

import React, { createContext, useContext } from "react";
import { useAutoClose, AutoCloseStatus } from "@/hooks/useAutoClose";

interface AutoCloseContextValue {
  enableAutoClose: (positionId: string, poolAddress: string, lowerBinId: number, upperBinId: number) => void;
  disableAutoClose: (positionId: string) => void;
  isAutoCloseEnabled: (positionId: string) => boolean;
  getStatus: (positionId: string) => AutoCloseStatus;
  getError: (positionId: string) => string | undefined;
  pollInterval: number;
  updatePollInterval: (ms: number) => void;
}

const AutoCloseContext = createContext<AutoCloseContextValue | null>(null);

export function useAutoCloseContext() {
  const ctx = useContext(AutoCloseContext);
  if (!ctx) {
    throw new Error("useAutoCloseContext must be used within AutoCloseMonitor");
  }
  return ctx;
}

/**
 * Global headless component that runs auto-close monitoring.
 * Must be mounted inside WalletProvider so it has access to wallet context.
 */
export default function AutoCloseMonitor({ children }: { children: React.ReactNode }) {
  const autoClose = useAutoClose();

  return (
    <AutoCloseContext.Provider
      value={{
        enableAutoClose: autoClose.enableAutoClose,
        disableAutoClose: autoClose.disableAutoClose,
        isAutoCloseEnabled: autoClose.isAutoCloseEnabled,
        getStatus: autoClose.getStatus,
        getError: autoClose.getError,
        pollInterval: autoClose.pollInterval,
        updatePollInterval: autoClose.updatePollInterval,
      }}
    >
      {children}
    </AutoCloseContext.Provider>
  );
}
