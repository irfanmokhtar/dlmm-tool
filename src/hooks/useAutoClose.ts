"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getActiveBinForPool } from "@/lib/dlmm";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "dlmm-auto-close";
const SETTINGS_KEY = "dlmm-auto-close-settings";
const DEFAULT_POLL_INTERVAL = 15_000; // 15 seconds

export type AutoCloseStatus =
  | "idle"
  | "monitoring"
  | "triggered"
  | "closing"
  | "closed"
  | "error";

export type AutoCloseDirection = "above" | "below" | "both";

export interface AutoCloseLogEntry {
  timestamp: number;
  type: "range" | "system";
  status: "passed" | "triggered" | "error" | "info";
  message: string;
}

interface AutoCloseEntry {
  positionId: string;
  poolAddress: string;
  upperBinId: number;
  lowerBinId: number;
  direction: AutoCloseDirection;
}

interface AutoCloseState {
  entries: AutoCloseEntry[];
  statuses: Record<string, AutoCloseStatus>;
  errors: Record<string, string>;
  logs: Record<string, AutoCloseLogEntry[]>;
}

function loadEntries(): AutoCloseEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: AutoCloseEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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
    (positionId: string, poolAddress: string, lowerBinId: number, upperBinId: number, direction: AutoCloseDirection = "above") => {
      setState((prev) => {
        if (prev.entries.some((e) => e.positionId === positionId)) return prev;
        const newEntry: AutoCloseEntry = { positionId, poolAddress, upperBinId, lowerBinId, direction };
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

  // Polling loop
  useEffect(() => {
    if (!publicKey || state.entries.length === 0) return;

    const checkPositions = async () => {
      for (const entry of state.entries) {
        // Skip if already processing
        if (processingRef.current.has(entry.positionId)) continue;

        try {
          let triggerClose = false;
          let closeReason = "";

          // 1. Check Out-of-Range Condition
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
            const inRangeMsg = `Bin ${binId} is within range (${entry.lowerBinId} – ${entry.upperBinId})`;
            addLog(entry.positionId, {
              type: "range",
              status: "passed",
              message: inRangeMsg,
            });
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
                  message: `Partial close: ${result.confirmedSignatures?.length || 0} of ${result.totalChunks || "?"} transactions confirmed. Position may need manual retry.`,
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
                  ? `Position closed successfully (${result.totalChunks} transactions)`
                  : "Position closed successfully",
              });

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
          logger.warn(`Failed to check active bin for ${entry.poolAddress}:`, pollErr);
        }
      }
    };

    // Run immediately once
    checkPositions();

    const interval = setInterval(checkPositions, pollInterval);
    return () => clearInterval(interval);
  }, [publicKey, connection, state.entries, disableAutoClose, pollInterval]);

  return {
    enableAutoClose,
    disableAutoClose,
    isAutoCloseEnabled,
    getStatus,
    getError,
    getLogs,
    getDirection,
    updateDirection,
    entries: state.entries,
    pollInterval,
    updatePollInterval,
  };
}
