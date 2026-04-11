"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type PnLCurrency = "USD" | "SOL";

interface PnLCurrencyContextType {
  currency: PnLCurrency;
  toggleCurrency: () => void;
  setCurrency: (c: PnLCurrency) => void;
  /** Convert a USD value string to the selected currency using the given SOL price */
  convert: (usdValue: string | undefined | null, solPrice?: number) => string;
  /** Format a converted value with the appropriate symbol */
  formatValue: (usdValue: string | undefined | null, solPrice?: number) => string;
  /** Get the currency symbol */
  symbol: string;
}

const PnLCurrencyContext = createContext<PnLCurrencyContextType | null>(null);

const STORAGE_KEY = "dlmm-pnl-currency";

export function PnLCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<PnLCurrency>(() => {
    if (typeof window === "undefined") return "USD";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "SOL" || saved === "USD") return saved;
    } catch {}
    return "USD";
  });

  const setCurrency = useCallback((c: PnLCurrency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {}
  }, []);

  const toggleCurrency = useCallback(() => {
    setCurrencyState((prev) => {
      const next = prev === "USD" ? "SOL" : "USD";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const convert = useCallback(
    (usdValue: string | undefined | null, solPrice?: number): string => {
      if (!usdValue || Number.isNaN(Number(usdValue))) return "—";
      if (currency === "USD") return usdValue;
      if (!solPrice || solPrice <= 0) return "—";
      const sol = Number(usdValue) / solPrice;
      return sol.toFixed(4);
    },
    [currency]
  );

  const formatValue = useCallback(
    (usdValue: string | undefined | null, solPrice?: number): string => {
      if (!usdValue || Number.isNaN(Number(usdValue))) return "—";
      const amount = Number(usdValue);
      if (currency === "USD") {
        return amount.toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        });
      }
      if (!solPrice || solPrice <= 0) return "—";
      const sol = amount / solPrice;
      const sign = sol >= 0 ? "" : "-";
      return `${sign}◎${Math.abs(sol).toFixed(4)}`;
    },
    [currency]
  );

  const symbol = currency === "USD" ? "$" : "◎";

  return (
    <PnLCurrencyContext.Provider
      value={{ currency, toggleCurrency, setCurrency, convert, formatValue, symbol }}
    >
      {children}
    </PnLCurrencyContext.Provider>
  );
}

export function usePnLCurrency() {
  const ctx = useContext(PnLCurrencyContext);
  if (!ctx) throw new Error("usePnLCurrency must be used within PnLCurrencyProvider");
  return ctx;
}

/**
 * Derive SOL price from position data.
 * If one of the tokens is SOL, its price from the PnL data is the SOL/USD price.
 */
export function deriveSolPrice(position: {
  tokenX: { symbol: string };
  tokenY: { symbol: string };
  tokenXPrice?: string;
  tokenYPrice?: string;
}): number | undefined {
  // Check if tokenX is SOL
  if (
    position.tokenX.symbol === "SOL" ||
    position.tokenX.symbol === "WSOL"
  ) {
    const price = Number(position.tokenXPrice);
    if (price > 0) return price;
  }
  // Check if tokenY is SOL
  if (
    position.tokenY.symbol === "SOL" ||
    position.tokenY.symbol === "WSOL"
  ) {
    const price = Number(position.tokenYPrice);
    if (price > 0) return price;
  }
  return undefined;
}