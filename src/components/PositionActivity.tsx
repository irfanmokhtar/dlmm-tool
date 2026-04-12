"use client";

import { useEffect, useState } from "react";

interface PositionActivity {
  signature: string;
  blockTime: number | null;
  type: string;
  label: string;
  icon: string;
  slot: number;
  url: string;
  failed: boolean;
  fee: number;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

const TYPE_COLORS: Record<string, string> = {
  open: "text-green-400",
  add_liquidity: "text-blue-400",
  remove_liquidity: "text-orange-400",
  claim_fee: "text-yellow-400",
  claim_reward: "text-purple-400",
  close: "text-red-400",
  rebalance: "text-cyan-400",
  extend: "text-teal-400",
  shrink: "text-pink-400",
  unknown: "text-zinc-400",
};

export default function PositionActivityCard({ positionId }: { positionId: string }) {
  const [activities, setActivities] = useState<PositionActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivity() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/position-activity?positionId=${encodeURIComponent(positionId)}&limit=20`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setActivities(data.activities || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchActivity();
    return () => { cancelled = true; };
  }, [positionId]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-300">Position Activity</h3>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 animate-pulse rounded bg-zinc-700" />
              <div className="h-3 w-32 animate-pulse rounded bg-zinc-700" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-zinc-700" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">Failed to load activity: {error}</p>
      )}

      {!loading && !error && activities.length === 0 && (
        <p className="text-sm text-zinc-500">No activity found for this position.</p>
      )}

      {!loading && !error && activities.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {activities.map((act) => (
            <a
              key={act.signature}
              href={act.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800 ${
                act.failed ? "opacity-50" : ""
              }`}
            >
              <span className="text-base">{act.icon}</span>
              <span
                className={`font-medium ${
                  TYPE_COLORS[act.type] || TYPE_COLORS.unknown
                } ${act.failed ? "line-through" : ""}`}
              >
                {act.label}
              </span>
              {act.blockTime && (
                <span className="ml-auto text-xs text-zinc-500">
                  {timeAgo(act.blockTime)}
                </span>
              )}
              {act.fee > 0 && (
                <span className="text-xs text-zinc-600">◎{act.fee.toFixed(6)}</span>
              )}
              {act.failed && (
                <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                  FAILED
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}