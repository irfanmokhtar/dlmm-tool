"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getActiveBinForPool } from "@/lib/dlmm";
import { logger } from "@/lib/logger";
import type { SwapConfig } from "@/lib/types/swap";
import { DEFAULT_SWAP_CONFIG } from "@/lib/types/swap";

const STORAGE_KEY = "dlmm-auto-close";
const SETTINGS_KEY = "dlmm-auto-close-settings";
const DEFAULT_POLL_INTERVAL = 15_000; // 15 seconds
const DEFAULT_PNL_WARMUP_MS = 300_000; // 5 minutes
const PNL_SANITY_THRESHOLD = 500; // Skip PnL triggers if |pnlPctChange| > 500%

export type AutoCloseStatus =
  | "idle"
  | "monitoring"
  | "triggered"
  | "closing"
  | "closed"
  | "error";

export type AutoCloseDirection = "above" | "below" | "both";

export type AutoCloseTriggerMode = "range" | "pnl" | "both";

export interface AutoCloseLogEntry {
  timestamp: number;
  type: "range" | "pnl" | "system" | "swap";
  status: "passed" | "triggered" | "error" | "info";
  message: string;
}

interface AutoCloseEntry {
  positionId: string;
  poolAddress: string;
  upperBinId: number;
  lowerBinId: number;
  direction: AutoCloseDirection;
  triggerMode: AutoCloseTriggerMode;
  takeProfitPct?: number;
  stopLossPct?: number;
  enabledAt: number;
  pnlWarmupMs: number;
  swapEnabled: boolean;
  swapOutputMint: "auto" | string;
  swapSlippageBps: number;
}

interface AutoCloseState {
  entries: AutoCloseEntry[];
  statuses: Record<string, AutoCloseStatus>;
  errors: Record<string, string>;
  logs: Record<string, AutoCloseLogEntry[]>;
}

/** Migrate entries that lack new fields (backward compatible) */
function migrateEntry(entry: Partial<AutoCloseEntry> & { positionId: string; poolAddress: string }): AutoCloseEntry {
  return {
    positionId: entry.positionId,
    poolAddress: entry.poolAddress,
    upperBinId: entry.upperBinId ?? 0,
    lowerBinId: entry.lowerBinId ?? 0,
    direction: entry.direction ?? "above",
    triggerMode: entry.triggerMode ?? "range",
    takeProfitPct: entry.takeProfitPct,
    stopLossPct: entry.stopLossPct,
    enabledAt: entry.enabledAt ?? 0,
    pnlWarmupMs: entry.pnlWarmupMs ?? DEFAULT_PNL_WARMUP_MS,
    swapEnabled: entry.swapEnabled ?? true,
    swapOutputMint: entry.swapOutputMint ?? "auto",
    swapSlippageBps: entry.swapSlippageBps ?? DEFAULT_SWAP_CONFIG.slippageBps,
  };
}

function loadEntries(): AutoCloseEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateEntry);
  } catch {
    return [];
  }
}

function saveEntries(entries: AutoCloseEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Fetch PnL data for a position from Meteora API (called each poll cycle) */
async function fetchPositionPnl(
  poolAddress: string,
  userAddress: string,
  positionAddress: string
): Promise<{ pnlPctChange: number } | null> {
  try {
    const query = new URLSearchParams({
      user: userAddress,
      status: "open",
      page: "1",
      page_size: "100",
    });

    const response = await fetch(
      `/api/meteora-pnl?poolAddress=${encodeURIComponent(poolAddress)}&${query.toString()}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.positions || !Array.isArray(data.positions)) return null;

    const pos = data.positions.find(
      (p: Record<string, unknown>) =>
        p.positionAddress === positionAddress ||
        p.position_address === positionAddress
    );

    if (!pos) return null;

    const rawPct = Number(pos.pnlPctChange ?? pos.pnl_pct_change ?? 0);
    if (isNaN(rawPct)) return null;

    return { pnlPctChange: rawPct };
  } catch (err) {
    logger.warn("[Auto-Close PnL] fetch failed for", positionAddress, err);
    return null;
  }
}

export function useAutoClose() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [state, setState] = useState<AutoCloseState>({
    entries: [],
    statuses: {},
    errors: {},
    logs: {},
  });
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const processingRef = useRef<Set<string>>(new Set());

  const addLog = useCallback((positionId: string, entry: Omit<AutoCloseLogEntry, "timestamp">) => {
    setState((prev) => {
      const positionLogs = prev.logs[positionId] || [];
      const newEntry: AutoCloseLogEntry = { ...entry, timestamp: Date.now() };
      // Keep last 20 logs
      const updatedLogs = [newEntry, ...positionLogs].slice(0, 20);
      return {
        ...prev,
        logs: { ...prev.logs, [positionId]: updatedLogs },
      };
    });
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    // Load entries
    const entries = loadEntries();
    const statuses: Record<string, AutoCloseStatus> = {};
    for (const e of entries) {
      statuses[e.positionId] = "monitoring";
    }
    setState({ entries, statuses, errors: {}, logs: {} });

    // Load settings
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.pollInterval) setPollInterval(parsed.pollInterval);
      }
    } catch {}
  }, []);

  const updatePollInterval = useCallback((ms: number) => {
    setPollInterval(ms);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pollInterval: ms }));
  }, []);

  const enableAutoClose = useCallback(
    (
      positionId: string,
      poolAddress: string,
      lowerBinId: number,
      upperBinId: number,
      direction: AutoCloseDirection = "above",
      triggerMode: AutoCloseTriggerMode = "range",
      takeProfitPct?: number,
      stopLossPct?: number,
      swapEnabled: boolean = true,
      swapOutputMint: "auto" | string = "auto",
      swapSlippageBps: number = DEFAULT_SWAP_CONFIG.slippageBps
    ) => {
      setState((prev) => {
        if (prev.entries.some((e) => e.positionId === positionId)) return prev;
        const newEntry: AutoCloseEntry = {
          positionId,
          poolAddress,
          upperBinId,
          lowerBinId,
          direction,
          triggerMode,
          takeProfitPct,
          stopLossPct,
          enabledAt: Date.now(),
          pnlWarmupMs: DEFAULT_PNL_WARMUP_MS,
          swapEnabled,
          swapOutputMint,
          swapSlippageBps,
        };
        const newEntries = [...prev.entries, newEntry];
        saveEntries(newEntries);
        return {
          ...prev,
          entries: newEntries,
          statuses: { ...prev.statuses, [positionId]: "monitoring" },
        };
      });
    },
    []
  );

  const disableAutoClose = useCallback((positionId: string) => {
    setState((prev) => {
      const newEntries = prev.entries.filter((e) => e.positionId !== positionId);
      saveEntries(newEntries);
      const newStatuses = { ...prev.statuses };
      delete newStatuses[positionId];
      const newErrors = { ...prev.errors };
      delete newErrors[positionId];
      return { entries: newEntries, statuses: newStatuses, errors: newErrors, logs: prev.logs };
    });
  }, []);

  const isAutoCloseEnabled = useCallback(
    (positionId: string) => {
      return state.entries.some((e) => e.positionId === positionId);
    },
    [state.entries]
  );

  const getStatus = useCallback(
    (positionId: string): AutoCloseStatus => {
      return state.statuses[positionId] || "idle";
    },
    [state.statuses]
  );

  const getError = useCallback(
    (positionId: string): string | undefined => {
      return state.errors[positionId];
    },
    [state.errors]
  );

  const getLogs = useCallback(
    (positionId: string): AutoCloseLogEntry[] => {
      return state.logs[positionId] || [];
    },
    [state.logs]
  );

  const getDirection = useCallback(
    (positionId: string): AutoCloseDirection => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.direction || "above";
    },
    [state.entries]
  );

  const updateDirection = useCallback(
    (positionId: string, direction: AutoCloseDirection) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, direction } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  const getTriggerMode = useCallback(
    (positionId: string): AutoCloseTriggerMode => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.triggerMode || "range";
    },
    [state.entries]
  );

  const updateTriggerMode = useCallback(
    (positionId: string, triggerMode: AutoCloseTriggerMode) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, triggerMode } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  const getTakeProfit = useCallback(
    (positionId: string): number | undefined => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.takeProfitPct;
    },
    [state.entries]
  );

  const updateTakeProfit = useCallback(
    (positionId: string, pct: number | undefined) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, takeProfitPct: pct } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  const getStopLoss = useCallback(
    (positionId: string): number | undefined => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.stopLossPct;
    },
    [state.entries]
  );

  const updateStopLoss = useCallback(
    (positionId: string, pct: number | undefined) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, stopLossPct: pct } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  const getWarmupRemaining = useCallback(
    (positionId: string): number => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      if (!entry) return 0;
      const elapsed = Date.now() - entry.enabledAt;
      return Math.max(0, entry.pnlWarmupMs - elapsed);
    },
    [state.entries]
  );

  const getWarmupDuration = useCallback(
    (positionId: string): number => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.pnlWarmupMs ?? DEFAULT_PNL_WARMUP_MS;
    },
    [state.entries]
  );

  const updateWarmupDuration = useCallback(
    (positionId: string, ms: number) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, pnlWarmupMs: ms } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  // --- Swap config getters/setters ---

  const getSwapEnabled = useCallback(
    (positionId: string): boolean => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.swapEnabled ?? true;
    },
    [state.entries]
  );

  const updateSwapEnabled = useCallback(
    (positionId: string, enabled: boolean) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, swapEnabled: enabled } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  const getSwapOutputMint = useCallback(
    (positionId: string): "auto" | string => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.swapOutputMint ?? "auto";
    },
    [state.entries]
  );

  const updateSwapOutputMint = useCallback(
    (positionId: string, mint: "auto" | string) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, swapOutputMint: mint } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  const getSwapSlippageBps = useCallback(
    (positionId: string): number => {
      const entry = state.entries.find((e) => e.positionId === positionId);
      return entry?.swapSlippageBps ?? DEFAULT_SWAP_CONFIG.slippageBps;
    },
    [state.entries]
  );

  const updateSwapSlippageBps = useCallback(
    (positionId: string, bps: number) => {
      setState((prev) => {
        const newEntries = prev.entries.map((e) =>
          e.positionId === positionId ? { ...e, swapSlippageBps: bps } : e
        );
        saveEntries(newEntries);
        return { ...prev, entries: newEntries };
      });
    },
    []
  );

  // Polling loop
  useEffect(() => {
    if (!publicKey || state.entries.length === 0) return;

    const walletStr = publicKey.toBase58();

    const checkPositions = async () => {
      for (const entry of state.entries) {
        // Skip if already processing
        if (processingRef.current.has(entry.positionId)) continue;

        try {
          let triggerClose = false;
          let closeReason = "";
          const mode = entry.triggerMode;

          // --- Range Check (if mode is "range" or "both") ---
          if (mode === "range" || mode === "both") {
            const { binId } = await getActiveBinForPool(connection, entry.poolAddress);

            const outOfRangeAbove = binId > entry.upperBinId;
            const outOfRangeBelow = binId < entry.lowerBinId;

            if (outOfRangeAbove && (entry.direction === "above" || entry.direction === "both")) {
              triggerClose = true;
              closeReason = "Out of range (above)";
              addLog(entry.positionId, {
                type: "range",
                status: "triggered",
                message: `Active Bin ${binId} > Upper Bin ${entry.upperBinId}`,
              });
            } else if (outOfRangeBelow && (entry.direction === "below" || entry.direction === "both")) {
              triggerClose = true;
              closeReason = "Out of range (below)";
              addLog(entry.positionId, {
                type: "range",
                status: "triggered",
                message: `Active Bin ${binId} < Lower Bin ${entry.lowerBinId}`,
              });
            } else {
              addLog(entry.positionId, {
                type: "range",
                status: "passed",
                message: `Bin ${binId} is within range (${entry.lowerBinId} – ${entry.upperBinId})`,
              });
            }
          }

          // --- PnL Check (if mode is "pnl" or "both" and not already triggered by range) ---
          if (!triggerClose && (mode === "pnl" || mode === "both")) {
            const hasPnlTriggers = entry.takeProfitPct != null || entry.stopLossPct != null;

            if (!hasPnlTriggers) {
              addLog(entry.positionId, {
                type: "pnl",
                status: "passed",
                message: "No PnL triggers configured",
              });
            } else {
              // Check warmup period
              const warmupRemaining = Math.max(0, entry.pnlWarmupMs - (Date.now() - entry.enabledAt));

              if (warmupRemaining > 0) {
                const secs = Math.ceil(warmupRemaining / 1000);
                const mins = Math.floor(secs / 60);
                const remSecs = secs % 60;
                const timeStr = mins > 0 ? `${mins}m ${remSecs}s` : `${secs}s`;
                addLog(entry.positionId, {
                  type: "pnl",
                  status: "passed",
                  message: `PnL warmup: ${timeStr} remaining`,
                });
              } else {
                // Warmup complete — fetch and check PnL
                const pnlData = await fetchPositionPnl(
                  entry.poolAddress,
                  walletStr,
                  entry.positionId
                );

                if (!pnlData) {
                  addLog(entry.positionId, {
                    type: "pnl",
                    status: "error",
                    message: "PnL data unavailable — PnL triggers skipped",
                  });
                } else {
                  const { pnlPctChange } = pnlData;

                  // Sanity check: skip extreme PnL values
                  if (Math.abs(pnlPctChange) > PNL_SANITY_THRESHOLD) {
                    addLog(entry.positionId, {
                      type: "pnl",
                      status: "error",
                      message: `PnL value seems invalid (${pnlPctChange >= 0 ? "+" : ""}${pnlPctChange.toFixed(1)}%), skipping trigger`,
                    });
                  } else {
                    let pnlTriggered = false;

                    // Take-profit check
                    if (entry.takeProfitPct != null && pnlPctChange >= entry.takeProfitPct) {
                      pnlTriggered = true;
                      triggerClose = true;
                      closeReason = `Take profit: PnL +${pnlPctChange.toFixed(1)}% ≥ +${entry.takeProfitPct}%`;
                      addLog(entry.positionId, {
                        type: "pnl",
                        status: "triggered",
                        message: `Take profit triggered: PnL +${pnlPctChange.toFixed(1)}% ≥ +${entry.takeProfitPct}%`,
                      });
                    }

                    // Stop-loss check
                    if (!pnlTriggered && entry.stopLossPct != null && pnlPctChange <= -entry.stopLossPct) {
                      pnlTriggered = true;
                      triggerClose = true;
                      closeReason = `Stop loss: PnL ${pnlPctChange.toFixed(1)}% ≤ -${entry.stopLossPct}%`;
                      addLog(entry.positionId, {
                        type: "pnl",
                        status: "triggered",
                        message: `Stop loss triggered: PnL ${pnlPctChange.toFixed(1)}% ≤ -${entry.stopLossPct}%`,
                      });
                    }

                    if (!pnlTriggered) {
                      addLog(entry.positionId, {
                        type: "pnl",
                        status: "passed",
                        message: `PnL ${pnlPctChange >= 0 ? "+" : ""}${pnlPctChange.toFixed(1)}% (TP: ${entry.takeProfitPct != null ? `+${entry.takeProfitPct}%` : "—"}, SL: ${entry.stopLossPct != null ? `-${entry.stopLossPct}%` : "—"})`,
                      });
                    }
                  }
                }
              }
            }
          }

          if (triggerClose) {
            // Trigger auto-close via API
            processingRef.current.add(entry.positionId);
            logger.info(`[Auto-Close] Triggering close for ${entry.positionId}. Reason: ${closeReason}`);

            setState((prev) => ({
              ...prev,
              statuses: { ...prev.statuses, [entry.positionId]: "triggered" },
            }));

            try {
              setState((prev) => ({
                ...prev,
                statuses: { ...prev.statuses, [entry.positionId]: "closing" },
              }));

              // Call server-side API route that signs with private key
              const response = await fetch("/api/auto-close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  positionId: entry.positionId,
                  poolAddress: entry.poolAddress,
                  lowerBinId: entry.lowerBinId,
                  upperBinId: entry.upperBinId,
                  closeReason,
                  swapConfig: {
                    enabled: entry.swapEnabled,
                    outputMint: entry.swapOutputMint,
                    slippageBps: entry.swapSlippageBps,
                  },
                }),
              });

              const result = await response.json();

              if (!response.ok && !result.partialSuccess) {
                throw new Error(result.error || "API request failed");
              }

              // Handle partial success — some transactions confirmed but not all
              if (result.partialSuccess) {
                logger.warn(
                  `[Auto-Close] Partial close for ${entry.positionId}: ${result.confirmedSignatures?.length || 0}/${result.totalChunks || "?"} transactions confirmed`
                );
                addLog(entry.positionId, {
                  type: "system",
                  status: "error",
                  message: `Partial close: ${result.confirmedSignatures?.length || 0} of ${result.totalChunks || "?"} transactions confirmed — ${closeReason}. Position may need manual retry.`,
                });
                // Keep monitoring — don't mark as closed, allow retry
                setState((prev) => ({
                  ...prev,
                  statuses: { ...prev.statuses, [entry.positionId]: "error" },
                  errors: {
                    ...prev.errors,
                    [entry.positionId]: result.error || "Partial close: some transactions failed",
                  },
                }));
                return; // Skip the success path below
              }

              logger.info(`[Auto-Close] Position ${entry.positionId} closed. Signatures:`, result.signatures);

              addLog(entry.positionId, {
                type: "system",
                status: "info",
                message: result.totalChunks > 1
                  ? `Position closed successfully (${result.totalChunks} transactions) — ${closeReason}`
                  : `Position closed successfully — ${closeReason}`,
              });

              // Log swap results if present
              if (result.swapResults && Array.isArray(result.swapResults)) {
                for (const swapResult of result.swapResults) {
                  if (swapResult.method === "skipped") {
                    addLog(entry.positionId, {
                      type: "swap",
                      status: "info",
                      message: `Swap skipped (dust amount): ${swapResult.inputMint}`,
                    });
                  } else if (swapResult.success) {
                    addLog(entry.positionId, {
                      type: "swap",
                      status: "info",
                      message: `Swap successful: ${swapResult.inputMint} → ${swapResult.outputMint} via ${swapResult.method}${swapResult.signatures?.length ? ` (tx: ${swapResult.signatures[0].slice(0, 8)}...)` : ""}`,
                    });
                  } else {
                    addLog(entry.positionId, {
                      type: "swap",
                      status: "error",
                      message: `Swap failed: ${swapResult.inputMint} → ${swapResult.outputMint}: ${swapResult.error || "Unknown error"}`,
                    });
                  }
                }
              }

              setState((prev) => ({
                ...prev,
                statuses: { ...prev.statuses, [entry.positionId]: "closed" },
              }));

              // Remove from auto-close list after successful close
              disableAutoClose(entry.positionId);
            } catch (closeErr) {
              logger.error(`Auto-close failed for ${entry.positionId}:`, closeErr);
              setState((prev) => ({
                ...prev,
                statuses: { ...prev.statuses, [entry.positionId]: "error" },
                errors: {
                  ...prev.errors,
                  [entry.positionId]:
                    closeErr instanceof Error ? closeErr.message : "Failed to close position",
                },
              }));
            } finally {
              processingRef.current.delete(entry.positionId);
            }
          }
        } catch (pollErr) {
          logger.warn(`Failed to check position ${entry.positionId}:`, pollErr);
        }
      }
    };

    // Run immediately once
    checkPositions();

    const interval = setInterval(checkPositions, pollInterval);
    return () => clearInterval(interval);
  }, [publicKey, connection, state.entries, disableAutoClose, pollInterval, addLog]);

  return {
    enableAutoClose,
    disableAutoClose,
    isAutoCloseEnabled,
    getStatus,
    getError,
    getLogs,
    getDirection,
    updateDirection,
    getTriggerMode,
    updateTriggerMode,
    getTakeProfit,
    updateTakeProfit,
    getStopLoss,
    updateStopLoss,
    getWarmupRemaining,
    getWarmupDuration,
    updateWarmupDuration,
    getSwapEnabled,
    updateSwapEnabled,
    getSwapOutputMint,
    updateSwapOutputMint,
    getSwapSlippageBps,
    updateSwapSlippageBps,
    entries: state.entries,
    pollInterval,
    updatePollInterval,
  };
}
