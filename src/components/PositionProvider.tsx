"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getUserPositions, UserPosition } from "@/lib/dlmm";
import { logger } from "@/lib/logger";

const SETTINGS_KEY = "dlmm-position-refresh-settings";
const DEFAULT_REFRESH_INTERVAL = 60_000; // 60 seconds

interface PositionContextValue {
  positions: UserPosition[];
  loading: boolean;
  error: string | null;
  refreshInterval: number;
  updateRefreshInterval: (ms: number) => void;
  refetch: () => Promise<void>;
}

const PositionContext = createContext<PositionContextValue | null>(null);

export function usePositionData() {
  const ctx = useContext(PositionContext);
  if (!ctx) {
    throw new Error("usePositionData must be used within PositionProvider");
  }
  return ctx;
}

export default function PositionProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL);
  const isFirstLoad = useRef(true);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
      }
    } catch {}
  }, []);

  const updateRefreshInterval = useCallback((ms: number) => {
    setRefreshInterval(ms);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ refreshInterval: ms }));
  }, []);

  const fetchPositions = useCallback(async () => {
    if (!publicKey) {
      setPositions([]);
      return;
    }

    if (isFirstLoad.current) setLoading(true);
    setError(null);

    try {
      const userPositions = await getUserPositions(connection, publicKey);
      setPositions(userPositions);
      isFirstLoad.current = false;
    } catch (err) {
      logger.error("Error fetching positions:", err);
      if (isFirstLoad.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch positions");
      }
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPositions, refreshInterval]);

  return (
    <PositionContext.Provider
      value={{
        positions,
        loading,
        error,
        refreshInterval,
        updateRefreshInterval,
        refetch: fetchPositions,
      }}
    >
      {children}
    </PositionContext.Provider>
  );
}
