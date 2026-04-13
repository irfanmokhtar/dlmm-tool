"use client";

import { useState, useEffect } from "react";
import { useAutoCloseContext } from "@/components/AutoCloseMonitor";
import type { AutoCloseDirection, AutoCloseStatus, AutoCloseTriggerMode } from "@/hooks/useAutoClose";
import { SOL_MINT, USDC_MINT } from "@/lib/types/swap";

interface AutoCloseToggleProps {
  positionId: string;
  poolAddress: string;
  lowerBinId: number;
  upperBinId: number;
  isEnabled: boolean;
  status: AutoCloseStatus;
  error?: string;
  direction: AutoCloseDirection;
  triggerMode: AutoCloseTriggerMode;
  takeProfitPct?: number;
  stopLossPct?: number;
  pnlPercent?: string;
  tokenXSymbol?: string;
  tokenYSymbol?: string;
  onEnable: (positionId: string, poolAddress: string, lowerBinId: number, upperBinId: number, direction: AutoCloseDirection, triggerMode: AutoCloseTriggerMode, takeProfitPct?: number, stopLossPct?: number, swapEnabled?: boolean, swapOutputMint?: "auto" | string, swapSlippageBps?: number) => void;
  onDisable: (positionId: string) => void;
  onDirectionChange: (positionId: string, direction: AutoCloseDirection) => void;
  onTriggerModeChange: (positionId: string, triggerMode: AutoCloseTriggerMode) => void;
  onTakeProfitChange: (positionId: string, pct: number | undefined) => void;
  onStopLossChange: (positionId: string, pct: number | undefined) => void;
}

const STATUS_CONFIG: Record<AutoCloseStatus, { label: string; color: string; pulse?: boolean }> = {
  idle: { label: "Off", color: "text-muted-foreground" },
  monitoring: { label: "Monitoring", color: "text-amber-400", pulse: true },
  triggered: { label: "Triggered!", color: "text-orange-400", pulse: true },
  closing: { label: "Closing...", color: "text-orange-400", pulse: true },
  closed: { label: "Closed", color: "text-emerald-400" },
  error: { label: "Error", color: "text-rose-400" },
};

const DIRECTION_CONFIG: Record<AutoCloseDirection, { label: string; description: string }> = {
  above: { label: "Above", description: "Close when price moves above range" },
  below: { label: "Below", description: "Close when price moves below range" },
  both: { label: "Either", description: "Close when price exits range either way" },
};

const TRIGGER_MODE_CONFIG: Record<AutoCloseTriggerMode, { label: string; description: string }> = {
  range: { label: "Range", description: "Trigger when active bin exits position range" },
  pnl: { label: "PnL", description: "Trigger on take-profit or stop-loss thresholds" },
  both: { label: "Both", description: "Trigger on range exit or PnL thresholds" },
};

function formatWarmup(ms: number): string {
  if (ms <= 0) return "";
  const totalSecs = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function AutoCloseToggle({
  positionId,
  poolAddress,
  lowerBinId,
  upperBinId,
  isEnabled,
  status,
  error,
  direction,
  triggerMode,
  takeProfitPct,
  stopLossPct,
  pnlPercent,
  tokenXSymbol,
  tokenYSymbol,
  onEnable,
  onDisable,
  onDirectionChange,
  onTriggerModeChange,
  onTakeProfitChange,
  onStopLossChange,
}: AutoCloseToggleProps) {
  const statusConfig = STATUS_CONFIG[status];
  const { pollInterval, updatePollInterval, getWarmupRemaining, getWarmupDuration, updateWarmupDuration,
    getSwapEnabled, updateSwapEnabled, getSwapOutputMint, updateSwapOutputMint, getSwapSlippageBps, updateSwapSlippageBps } = useAutoCloseContext();

  const [tpInput, setTpInput] = useState<string>(takeProfitPct != null ? String(takeProfitPct) : "");
  const [slInput, setSlInput] = useState<string>(stopLossPct != null ? String(stopLossPct) : "");
  const [warmupInput, setWarmupInput] = useState<string>(String(Math.round(getWarmupDuration(positionId) / 60_000)));
  const [warmupRemaining, setWarmupRemaining] = useState<number>(0);
  const [swapEnabled, setSwapEnabled] = useState(getSwapEnabled(positionId));
  const [swapOutputMint, setSwapOutputMint] = useState<"auto" | string>(getSwapOutputMint(positionId));
  const [swapSlippageInput, setSwapSlippageInput] = useState<string>(String(getSwapSlippageBps(positionId) / 100));

  // Sync local inputs when props change
  useEffect(() => {
    setTpInput(takeProfitPct != null ? String(takeProfitPct) : "");
  }, [takeProfitPct]);

  useEffect(() => {
    setSlInput(stopLossPct != null ? String(stopLossPct) : "");
  }, [stopLossPct]);

  // Warmup countdown timer
  useEffect(() => {
    if (!isEnabled || triggerMode === "range") {
      setWarmupRemaining(0);
      return;
    }

    const update = () => {
      setWarmupRemaining(getWarmupRemaining(positionId));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isEnabled, triggerMode, positionId, getWarmupRemaining]);

  const handleToggle = () => {
    if (isEnabled) {
      onDisable(positionId);
    } else {
      const tp = tpInput ? Number(tpInput) : undefined;
      const sl = slInput ? Number(slInput) : undefined;
      const slippageBps = Math.round(Number(swapSlippageInput) * 100) || 200;
      onEnable(positionId, poolAddress, lowerBinId, upperBinId, direction, triggerMode, tp, sl, swapEnabled, swapOutputMint, slippageBps);
    }
  };

  const handleTpBlur = () => {
    const val = tpInput.trim();
    if (!val) {
      onTakeProfitChange(positionId, undefined);
      return;
    }
    const num = Number(val);
    if (isNaN(num) || num <= 0) {
      setTpInput(takeProfitPct != null ? String(takeProfitPct) : "");
      return;
    }
    onTakeProfitChange(positionId, num);
  };

  const handleSlBlur = () => {
    const val = slInput.trim();
    if (!val) {
      onStopLossChange(positionId, undefined);
      return;
    }
    const num = Number(val);
    if (isNaN(num) || num <= 0) {
      setSlInput(stopLossPct != null ? String(stopLossPct) : "");
      return;
    }
    onStopLossChange(positionId, num);
  };

  const handleWarmupBlur = () => {
    const val = warmupInput.trim();
    const num = Number(val);
    if (isNaN(num) || num < 1) {
      setWarmupInput(String(Math.round(getWarmupDuration(positionId) / 60_000)));
      return;
    }
    const clamped = Math.min(Math.max(num, 1), 30);
    setWarmupInput(String(clamped));
    updateWarmupDuration(positionId, clamped * 60_000);
  };

  const showPnlInputs = triggerMode === "pnl" || triggerMode === "both";
  const showDirectionPicker = triggerMode === "range" || triggerMode === "both";
  const pnlNum = pnlPercent != null ? Number(pnlPercent) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Auto-Close</p>
          <p className="text-[10px] text-muted-foreground">
            {TRIGGER_MODE_CONFIG[triggerMode].description}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:ring-offset-2 focus:ring-offset-[#0a0b0f] ${
            isEnabled ? "bg-teal-500" : "bg-white/10"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
              isEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Trigger Mode Picker */}
      <div className="flex gap-1.5">
        {(["range", "pnl", "both"] as AutoCloseTriggerMode[]).map((mode) => {
          const cfg = TRIGGER_MODE_CONFIG[mode];
          const isActive = triggerMode === mode;
          return (
            <button
              key={mode}
              onClick={() => onTriggerModeChange(positionId, mode)}
              className={`flex-1 text-[10px] font-medium py-1.5 rounded-md border transition-colors ${
                isActive
                  ? "bg-teal-500/15 border-teal-500/30 text-teal-400"
                  : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground hover:border-white/[0.12]"
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Direction Picker (only for range/both mode) */}
      {showDirectionPicker && (
        <div className="flex gap-1.5">
          {(["above", "below", "both"] as AutoCloseDirection[]).map((dir) => {
            const cfg = DIRECTION_CONFIG[dir];
            const isActive = direction === dir;
            return (
              <button
                key={dir}
                onClick={() => onDirectionChange(positionId, dir)}
                className={`flex-1 text-[10px] font-medium py-1.5 rounded-md border transition-colors ${
                  isActive
                    ? "bg-teal-500/15 border-teal-500/30 text-teal-400"
                    : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground hover:border-white/[0.12]"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* PnL Triggers (only for pnl/both mode) */}
      {showPnlInputs && (
        <div className="space-y-2">
          {/* Take Profit */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-emerald-400 w-16 shrink-0">Take Profit</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min="0.1"
                max="1000"
                step="0.1"
                placeholder="e.g. 20"
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                onBlur={handleTpBlur}
                onKeyDown={(e) => { if (e.key === "Enter") handleTpBlur(); }}
                className="flex-1 h-6 px-2 text-right bg-emerald-500/5 border border-emerald-500/20 rounded-md text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-emerald-500/30"
              />
              <span className="text-[10px] text-emerald-400/60">%</span>
            </div>
            {pnlNum != null && (
              <span className={`text-[10px] font-mono font-medium shrink-0 ${pnlNum >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                {pnlNum >= 0 ? "+" : ""}{pnlNum.toFixed(1)}%
              </span>
            )}
          </div>

          {/* Stop Loss */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-rose-400 w-16 shrink-0">Stop Loss</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min="0.1"
                max="1000"
                step="0.1"
                placeholder="e.g. 15"
                value={slInput}
                onChange={(e) => setSlInput(e.target.value)}
                onBlur={handleSlBlur}
                onKeyDown={(e) => { if (e.key === "Enter") handleSlBlur(); }}
                className="flex-1 h-6 px-2 text-right bg-rose-500/5 border border-rose-500/20 rounded-md text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder:text-rose-500/30"
              />
              <span className="text-[10px] text-rose-400/60">%</span>
            </div>
            {pnlNum != null && (
              <span className={`text-[10px] font-mono font-medium shrink-0 ${pnlNum >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                {pnlNum >= 0 ? "+" : ""}{pnlNum.toFixed(1)}%
              </span>
            )}
          </div>

          {/* Warmup Duration */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-medium text-amber-400/80 w-16 shrink-0">Warmup</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min="1"
                max="30"
                step="1"
                value={warmupInput}
                onChange={(e) => setWarmupInput(e.target.value)}
                onBlur={handleWarmupBlur}
                onKeyDown={(e) => { if (e.key === "Enter") handleWarmupBlur(); }}
                className="flex-1 h-6 px-2 text-right bg-amber-500/5 border border-amber-500/20 rounded-md text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-[10px] text-amber-400/60">min</span>
            </div>
          </div>

          {/* Warmup Countdown */}
          {isEnabled && warmupRemaining > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span className="text-[10px] font-medium text-amber-400">
                PnL warmup: {formatWarmup(warmupRemaining)} remaining
              </span>
              <span className="text-[10px] text-amber-400/50 ml-auto">
                Range triggers active
              </span>
            </div>
          )}
        </div>
      )}

      {/* Swap on Close */}
      <div className="space-y-2 pt-1 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-foreground">Swap on Close</p>
            <p className="text-[9px] text-muted-foreground">
              Swap all tokens to a single token after closing
            </p>
          </div>
          <button
            onClick={() => {
              const newVal = !swapEnabled;
              setSwapEnabled(newVal);
              updateSwapEnabled(positionId, newVal);
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
              swapEnabled ? "bg-teal-500" : "bg-white/10"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                swapEnabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {swapEnabled && (
          <div className="space-y-2">
            {/* Output Token Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-blue-400/80 w-16 shrink-0">Receive</span>
              <div className="flex gap-1 flex-1">
                {[
                  { value: "auto", label: tokenYSymbol ? `Auto (${tokenYSymbol})` : "Auto (tokenY)" },
                  { value: SOL_MINT, label: "SOL" },
                  { value: USDC_MINT, label: "USDC" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSwapOutputMint(opt.value);
                      updateSwapOutputMint(positionId, opt.value);
                    }}
                    className={`flex-1 text-[9px] font-medium py-1 rounded-md border transition-colors ${
                      swapOutputMint === opt.value
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                        : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground hover:border-white/[0.12]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Slippage */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-blue-400/80 w-16 shrink-0">Slippage</span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={swapSlippageInput}
                  onChange={(e) => setSwapSlippageInput(e.target.value)}
                  onBlur={() => {
                    const val = Number(swapSlippageInput);
                    if (isNaN(val) || val < 0.1) {
                      setSwapSlippageInput("2");
                      updateSwapSlippageBps(positionId, 200);
                    } else if (val > 10) {
                      setSwapSlippageInput("10");
                      updateSwapSlippageBps(positionId, 1000);
                    } else {
                      updateSwapSlippageBps(positionId, Math.round(val * 100));
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="flex-1 h-5 px-2 text-right bg-blue-500/5 border border-blue-500/20 rounded-md text-foreground text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-blue-400/60">%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEnabled && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <span className="relative flex h-2 w-2">
            {statusConfig.pulse && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                status === "monitoring" ? "bg-amber-400" : "bg-orange-400"
              }`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              status === "monitoring" ? "bg-amber-400" :
              status === "error" ? "bg-rose-400" :
              status === "closed" ? "bg-emerald-400" : "bg-orange-400"
            }`} />
          </span>
          <span className={`text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Every</span>
            <input
              type="number"
              min="1"
              max="300"
              value={pollInterval / 1000}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) {
                  updatePollInterval(val * 1000);
                }
              }}
              className="w-12 h-6 px-1.5 text-center bg-white/5 border border-white/10 rounded-md text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <span>sec</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-rose-400 px-1">{error}</p>
      )}

      {isEnabled && (
        <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
          {triggerMode === "range" && (
            <>
              {direction === "above" && `When the active bin exceeds bin #${upperBinId}, the position will be closed automatically.`}
              {direction === "below" && `When the active bin drops below bin #${lowerBinId}, the position will be closed automatically.`}
              {direction === "both" && `When the active bin exits the range (bin #${lowerBinId} – #${upperBinId}), the position will be closed automatically.`}
            </>
          )}
          {triggerMode === "pnl" && (
            <>
              {takeProfitPct != null && stopLossPct != null
                ? `Close when PnL ≥ +${takeProfitPct}% (take profit) or ≤ -${stopLossPct}% (stop loss).`
                : takeProfitPct != null
                ? `Close when PnL ≥ +${takeProfitPct}% (take profit).`
                : stopLossPct != null
                ? `Close when PnL ≤ -${stopLossPct}% (stop loss).`
                : "No PnL triggers configured. Set a take-profit or stop-loss percentage above."}
            </>
          )}
          {triggerMode === "both" && (
            <>
              Close when the active bin exits range
              {direction === "above" && ` (above #${upperBinId})`}
              {direction === "below" && ` (below #${lowerBinId})`}
              {direction === "both" && ` (#${lowerBinId} – #${upperBinId})`}
              {takeProfitPct != null || stopLossPct != null ? " or PnL threshold is reached" : ""}.
            </>
          )}
        </p>
      )}
    </div>
  );
}
