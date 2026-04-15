"use client";

import React from "react";
import type { PoolFilters, PoolSortField, TimeWindow } from "@/lib/types/pool";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PoolFiltersProps {
  filters: PoolFilters;
  onUpdate: <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => void;
  totalCount: number;
  filteredCount: number;
}

const VOLUME_THRESHOLDS: Record<TimeWindow, { label: string; value: number | null }[]> = {
  "5m": [
    { label: "All", value: null }, { label: "≥$50", value: 50 }, { label: "≥$100", value: 100 },
    { label: "≥$500", value: 500 }, { label: "≥$1K", value: 1000 }, { label: "≥$5K", value: 5000 },
  ],
  "30m": [
    { label: "All", value: null }, { label: "≥$500", value: 500 }, { label: "≥$1K", value: 1000 },
    { label: "≥$5K", value: 5000 }, { label: "≥$10K", value: 10000 }, { label: "≥$50K", value: 50000 },
  ],
  "1h": [
    { label: "All", value: null }, { label: "≥$1K", value: 1000 }, { label: "≥$5K", value: 5000 },
    { label: "≥$10K", value: 10000 }, { label: "≥$50K", value: 50000 }, { label: "≥$100K", value: 100000 },
  ],
  "4h": [
    { label: "All", value: null }, { label: "≥$5K", value: 5000 }, { label: "≥$10K", value: 10000 },
    { label: "≥$50K", value: 50000 }, { label: "≥$100K", value: 100000 }, { label: "≥$500K", value: 500000 },
  ],
  "24h": [
    { label: "All", value: null }, { label: "≥$10K", value: 10000 }, { label: "≥$50K", value: 50000 },
    { label: "≥$100K", value: 100000 }, { label: "≥$500K", value: 500000 }, { label: "≥$1M", value: 1000000 },
  ],
};

const TVL_OPTIONS = [
  { label: "All", value: null }, { label: "≥$1K", value: 1000 }, { label: "≥$10K", value: 10000 },
  { label: "≥$50K", value: 50000 }, { label: "≥$100K", value: 100000 }, { label: "≥$1M", value: 1000000 },
];

const ORGANIC_OPTIONS = [
  { label: "All", value: null }, { label: "≥40", value: 40 }, { label: "≥60 (default)", value: 60 },
  { label: "≥70", value: 70 }, { label: "≥80", value: 80 },
];

const HOLDERS_OPTIONS = [
  { label: "All", value: null }, { label: "≥100 (default)", value: 100 }, { label: "≥200", value: 200 },
  { label: "≥500", value: 500 }, { label: "≥1K", value: 1000 },
];

const FEE_TVL_OPTIONS = [
  { label: "All", value: null }, { label: "≥0.01", value: 0.01 }, { label: "≥0.05 (default)", value: 0.05 },
  { label: "≥0.1", value: 0.1 }, { label: "≥0.15", value: 0.15 },
];

const MCAP_MIN_OPTIONS = [
  { label: "All", value: null }, { label: "≥$50K", value: 50000 }, { label: "≥$100K (default)", value: 100000 },
  { label: "≥$500K", value: 500000 }, { label: "≥$1M", value: 1000000 },
];

const MCAP_MAX_OPTIONS = [
  { label: "None", value: null }, { label: "≤$1M", value: 1000000 }, { label: "≤$5M", value: 5000000 },
  { label: "≤$10M (default)", value: 10000000 }, { label: "≤$50M", value: 50000000 }, { label: "≤$100M", value: 100000000 },
];

const SORT_OPTIONS: { value: PoolSortField; label: string }[] = [
  { value: "score", label: "Score" }, { value: "volume_5m", label: "Vol 5m" },
  { value: "volume_24h", label: "Vol 24h" },
  { value: "fee_tvl_ratio", label: "Fee/TVL" }, { value: "tvl", label: "TVL" },
  { value: "organic_score", label: "Organic" },
];

const CATEGORY_OPTIONS: { value: PoolFilters["category"]; label: string }[] = [
  { value: "trending", label: "Trending" }, { value: "top", label: "Top" }, { value: "new", label: "New" },
];

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "5m", label: "5m" }, { value: "30m", label: "30m" }, { value: "1h", label: "1h" },
  { value: "4h", label: "4h" }, { value: "24h", label: "24h" },
];

export default function PoolFiltersBar({ filters, onUpdate, totalCount, filteredCount }: PoolFiltersProps) {
  const volumeOptions = VOLUME_THRESHOLDS[filters.volumeWindow];

  return (
    <div className="space-y-3">
      {/* Search + Top Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search token..."
          value={filters.query ?? ""}
          onChange={(e) => onUpdate("query", e.target.value)}
          className="w-40 h-8 text-sm"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Window</span>
          <Select
            value={filters.volumeWindow}
            onValueChange={(v) => { onUpdate("volumeWindow", v as TimeWindow); onUpdate("minVolume", null); }}
          >
            <SelectTrigger className="h-8 w-20 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIME_WINDOWS.map((tw) => <SelectItem key={tw.value} value={tw.value}>{tw.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Sort</span>
          <Select value={filters.sortBy} onValueChange={(v) => onUpdate("sortBy", v as PoolSortField)}>
            <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Category</span>
          <Select value={filters.category} onValueChange={(v) => onUpdate("category", v as PoolFilters["category"])}>
            <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} pools
        </span>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Vol ≥</span>
          <Select
            value={filters.minVolume === null ? "all" : String(filters.minVolume)}
            onValueChange={(v) => onUpdate("minVolume", v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {volumeOptions.map((opt) => <SelectItem key={opt.value === null ? "all" : String(opt.value)} value={opt.value === null ? "all" : String(opt.value)}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">TVL ≥</span>
          <Select
            value={filters.minTvl === null ? "all" : String(filters.minTvl)}
            onValueChange={(v) => onUpdate("minTvl", v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TVL_OPTIONS.map((opt) => <SelectItem key={opt.value === null ? "all" : String(opt.value)} value={opt.value === null ? "all" : String(opt.value)}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Organic ≥</span>
          <Select
            value={filters.minOrganicScore === null ? "all" : String(filters.minOrganicScore)}
            onValueChange={(v) => onUpdate("minOrganicScore", v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORGANIC_OPTIONS.map((opt) => <SelectItem key={opt.value === null ? "all" : String(opt.value)} value={opt.value === null ? "all" : String(opt.value)}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Holders ≥</span>
          <Select
            value={filters.minHolders === null ? "all" : String(filters.minHolders)}
            onValueChange={(v) => onUpdate("minHolders", v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HOLDERS_OPTIONS.map((opt) => <SelectItem key={opt.value === null ? "all" : String(opt.value)} value={opt.value === null ? "all" : String(opt.value)}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Mcap ≥</span>
          <Select
            value={filters.minMarketCap === null ? "all" : String(filters.minMarketCap)}
            onValueChange={(v) => onUpdate("minMarketCap", v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MCAP_MIN_OPTIONS.map((opt) => <SelectItem key={opt.value === null ? "all" : String(opt.value)} value={opt.value === null ? "all" : String(opt.value)}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Mcap ≤</span>
          <Select
            value={filters.maxMarketCap === null ? "none" : String(filters.maxMarketCap)}
            onValueChange={(v) => onUpdate("maxMarketCap", v === "none" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MCAP_MAX_OPTIONS.map((opt) => <SelectItem key={opt.value === null ? "none" : String(opt.value)} value={opt.value === null ? "none" : String(opt.value)}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Fee/TVL ≥</span>
          <Select
            value={filters.minFeeTvlRatio === null ? "all" : String(filters.minFeeTvlRatio)}
            onValueChange={(v) => onUpdate("minFeeTvlRatio", v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEE_TVL_OPTIONS.map((opt) => <SelectItem key={opt.value === null ? "all" : String(opt.value)} value={opt.value === null ? "all" : String(opt.value)}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Bin Step ≤</span>
          <Select
            value={filters.maxBinStep === null ? "all" : String(filters.maxBinStep)}
            onValueChange={(v) => onUpdate("maxBinStep", v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="10">≤10</SelectItem>
              <SelectItem value="20">≤20</SelectItem>
              <SelectItem value="50">≤50</SelectItem>
              <SelectItem value="100">≤100</SelectItem>
              <SelectItem value="200">≤200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}