"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface TokenLogoProps {
  src?: string;
  symbol: string;
  className?: string;
  backgroundColor?: string;
}

export default function TokenLogo({ src, symbol, className, backgroundColor }: TokenLogoProps) {
  const [error, setError] = useState(false);

  if (src && !error) {
    return (
      <div className={cn("relative flex shrink-0", className)}>
        {/* Shadow/Glow effect */}
        <div className="absolute inset-0 rounded-full blur-[2px] bg-white/10" />
        <img
          src={src}
          alt={symbol}
          className="relative w-full h-full rounded-full object-cover"
          onError={() => {
            logger.warn(`[TokenLogo] Failed to load logo for ${symbol} from ${src}`);
            setError(true);
          }}
          onLoad={() => logger.debug(`[TokenLogo] Successfully loaded logo for ${symbol}`)}
        />
      </div>
    );
  }

  if (src && error) {
    logger.debug(`[TokenLogo] Showing fallback for ${symbol} due to load error`);
  } else if (!src) {
    logger.debug(`[TokenLogo] No src provided for ${symbol}, showing fallback`);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md ring-2 ring-black/30 shrink-0",
        className
      )}
      style={{ backgroundColor: backgroundColor || "#4b5563" }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}
