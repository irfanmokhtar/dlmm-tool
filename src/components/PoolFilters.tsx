"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { PoolFilters, PoolSort, PoolSortField } from "@/lib/types/pool";
import { Search, ArrowUp, ArrowDown } from "lucide-react";

interface PoolFiltersProps {
  filters: PoolFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<PoolFilters>>;
  sort: PoolSort;
  onSortChange: React.Dispatch<React.SetStateAction<PoolSort>>;
}

const TVL_OPTIONS = [
  { value: "all", label: "All TVL" },
  { value: "1000", label: "≥ $1K" },
  { value: "10000", label: "≥ $10K" },
  { value: "100000", label: "≥ $100K" },
  { value: "1000000", label: "≥ $1M" },
];

const VOLUME_OPTIONS = [
  { value: "all", label: "All Volume" },
  { value: "10000", label: "≥ $10K" },
  { value: "50000", label: "≥ $50K" },
  { value: "100000", label: "≥ $100K" },
  { value: "500000", label: "≥ $500K" },
];

const SORT_OPTIONS: { value: PoolSortField; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "volume_24h", label: "Volume 24h" },
  { value: "tvl", label: "TVL" },
  { value: "apr", label: "APR" },
  { value: "fee_pct", label: "Fee Rate" },
  { value: "fee_tvl_ratio_24h", label: "Fee/TVL" },
  { value: "bin_step", label: "Bin Step" },
];

export default function PoolFilters({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
}: PoolFiltersProps) {
  // Convert null to "all" for select values
  const tvlSelectValue = filters.minTvl !== null ? String(filters.minTvl) : "all";
  const volumeSelectValue = filters.minVolume24h !== null ? String(filters.minVolume24h) : "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name, token, or address..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange((prev) => ({ ...prev, search: e.target.value }))
          }
          className="pl-8 h-8"
        />
      </div>

      {/* Min TVL */}
      <Select
        value={tvlSelectValue}
        onValueChange={(val) =>
          onFiltersChange((prev) => ({
            ...prev,
            minTvl: val === "all" ? null : Number(val),
          }))
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TVL_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Min Volume */}
      <Select
        value={volumeSelectValue}
        onValueChange={(val) =>
          onFiltersChange((prev) => ({
            ...prev,
            minVolume24h: val === "all" ? null : Number(val),
          }))
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VOLUME_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort By */}
      <Select
        value={sort.field}
        onValueChange={(val) =>
          onSortChange((prev) => ({
            ...prev,
            field: val as PoolSortField,
          }))
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort Direction Toggle */}
      <button
        onClick={() =>
          onSortChange((prev) => ({
            ...prev,
            direction: prev.direction === "desc" ? "asc" : "desc",
          }))
        }
        className="flex items-center gap-1 h-8 px-2 rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
        title={sort.direction === "desc" ? "Sort descending" : "Sort ascending"}
      >
        {sort.direction === "desc" ? (
          <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUp className="size-3.5" />
        )}
        <span className="hidden sm:inline">
          {sort.direction === "desc" ? "High→Low" : "Low→High"}
        </span>
      </button>
    </div>
  );
}