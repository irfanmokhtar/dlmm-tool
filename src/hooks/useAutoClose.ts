"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getActiveBinForPool } from "@/lib/dlmm";

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

interface AutoCloseEntry {
  positionId: string;
  poolAddress: string;
  upperBinId: number;
  lowerBinId: number;
}

interface AutoCloseState {
  entries: AutoCloseEntry[];
  statuses: Record<string, AutoCloseStatus>;
  errors: Record<string, string>;
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
  });
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const processingRef = useRef<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    // Load entries
    const entries = loadEntries();
    const statuses: Record<string, AutoCloseStatus> = {};
    for (const e of entries) {
      statuses[e.positionId] = "monitoring";
    }
    setState({ entries, statuses, errors: {} });

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
    (positionId: string, poolAddress: string, lowerBinId: number, upperBinId: number) => {
      setState((prev) => {
        if (prev.entries.some((e) => e.positionId === positionId)) return prev;
        const newEntry: AutoCloseEntry = { positionId, poolAddress, upperBinId, lowerBinId };
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
      return { entries: newEntries, statuses: newStatuses, errors: newErrors };
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

  // Polling loop
  useEffect(() => {
    if (!publicKey || state.entries.length === 0) return;

    const checkPositions = async () => {
      for (const entry of state.entries) {
        // Skip if already processing
        if (processingRef.current.has(entry.positionId)) continue;

        try {
          const { binId } = await getActiveBinForPool(connection, entry.poolAddress);

          if (binId > entry.upperBinId) {
            // Active bin is above range — trigger auto-close via API
            processingRef.current.add(entry.positionId);

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

              if (!response.ok) {
                throw new Error(result.error || "API request failed");
              }

              console.log(`[Auto-Close] Position ${entry.positionId} closed. Signatures:`, result.signatures);

              setState((prev) => ({
                ...prev,
                statuses: { ...prev.statuses, [entry.positionId]: "closed" },
              }));

              // Remove from auto-close list after successful close
              disableAutoClose(entry.positionId);
            } catch (closeErr) {
              console.error(`Auto-close failed for ${entry.positionId}:`, closeErr);
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
          console.warn(`Failed to check active bin for ${entry.poolAddress}:`, pollErr);
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
    entries: state.entries,
    pollInterval,
    updatePollInterval,
  };
}
