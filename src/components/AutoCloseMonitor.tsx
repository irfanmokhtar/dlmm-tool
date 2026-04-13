"use client";

import React, { createContext, useContext } from "react";
import { useAutoClose, AutoCloseStatus, AutoCloseDirection, AutoCloseTriggerMode } from "@/hooks/useAutoClose";

interface AutoCloseContextValue {
  enableAutoClose: (positionId: string, poolAddress: string, lowerBinId: number, upperBinId: number, direction?: AutoCloseDirection, triggerMode?: AutoCloseTriggerMode, takeProfitPct?: number, stopLossPct?: number) => void;
  disableAutoClose: (positionId: string) => void;
  isAutoCloseEnabled: (positionId: string) => boolean;
  getStatus: (positionId: string) => AutoCloseStatus;
  getError: (positionId: string) => string | undefined;
  getDirection: (positionId: string) => AutoCloseDirection;
  updateDirection: (positionId: string, direction: AutoCloseDirection) => void;
  getTriggerMode: (positionId: string) => AutoCloseTriggerMode;
  updateTriggerMode: (positionId: string, triggerMode: AutoCloseTriggerMode) => void;
  getTakeProfit: (positionId: string) => number | undefined;
  updateTakeProfit: (positionId: string, pct: number | undefined) => void;
  getStopLoss: (positionId: string) => number | undefined;
  updateStopLoss: (positionId: string, pct: number | undefined) => void;
  getWarmupRemaining: (positionId: string) => number;
  getWarmupDuration: (positionId: string) => number;
  updateWarmupDuration: (positionId: string, ms: number) => void;
  pollInterval: number;
  updatePollInterval: (ms: number) => void;
  getLogs: (positionId: string) => any[];
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
        getDirection: autoClose.getDirection,
        updateDirection: autoClose.updateDirection,
        getTriggerMode: autoClose.getTriggerMode,
        updateTriggerMode: autoClose.updateTriggerMode,
        getTakeProfit: autoClose.getTakeProfit,
        updateTakeProfit: autoClose.updateTakeProfit,
        getStopLoss: autoClose.getStopLoss,
        updateStopLoss: autoClose.updateStopLoss,
        getWarmupRemaining: autoClose.getWarmupRemaining,
        getWarmupDuration: autoClose.getWarmupDuration,
        updateWarmupDuration: autoClose.updateWarmupDuration,
        pollInterval: autoClose.pollInterval,
        updatePollInterval: autoClose.updatePollInterval,
        getLogs: autoClose.getLogs,
      }}
    >
      {children}
    </AutoCloseContext.Provider>
  );
}
