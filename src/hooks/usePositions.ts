"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getUserPositions, UserPosition } from "@/lib/dlmm";

const REFRESH_INTERVAL = 30_000; // 30 seconds

export function usePositions() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!publicKey) {
      setPositions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userPositions = await getUserPositions(connection, publicKey);
      setPositions(userPositions);
    } catch (err) {
      console.error("Error fetching positions:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch positions"
      );
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  return { positions, loading, error, refetch: fetchPositions };
}
