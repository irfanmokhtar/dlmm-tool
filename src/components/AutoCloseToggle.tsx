"use client";

import { useAutoCloseContext } from "@/components/AutoCloseMonitor";

interface AutoCloseToggleProps {
  positionId: string;
  poolAddress: string;
  lowerBinId: number;
  upperBinId: number;
  isEnabled: boolean;
  status: import("@/hooks/useAutoClose").AutoCloseStatus;
  error?: string;
  onEnable: (positionId: string, poolAddress: string, lowerBinId: number, upperBinId: number) => void;
  onDisable: (positionId: string) => void;
}

const STATUS_CONFIG: Record<import("@/hooks/useAutoClose").AutoCloseStatus, { label: string; color: string; pulse?: boolean }> = {
  idle: { label: "Off", color: "text-muted-foreground" },
  monitoring: { label: "Monitoring", color: "text-amber-400", pulse: true },
  triggered: { label: "Triggered!", color: "text-orange-400", pulse: true },
  closing: { label: "Closing...", color: "text-orange-400", pulse: true },
  closed: { label: "Closed", color: "text-emerald-400" },
  error: { label: "Error", color: "text-rose-400" },
};

export default function AutoCloseToggle({
  positionId,
  poolAddress,
  lowerBinId,
  upperBinId,
  isEnabled,
  status,
  error,
  onEnable,
  onDisable,
}: AutoCloseToggleProps) {
  const statusConfig = STATUS_CONFIG[status];
  const { pollInterval, updatePollInterval } = useAutoCloseContext();

  const handleToggle = () => {
    if (isEnabled) {
      onDisable(positionId);
    } else {
      onEnable(positionId, poolAddress, lowerBinId, upperBinId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Auto-Close</p>
          <p className="text-[10px] text-muted-foreground">
            Close when price moves above range
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
          Monitoring current price. When the active bin exceeds bin #{upperBinId}, 
          the position will be closed automatically in the background.
        </p>
      )}
    </div>
  );
}
