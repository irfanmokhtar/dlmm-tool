"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonCard() {
  return (
    <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm overflow-hidden">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="w-14 h-2.5" />
            </div>
          </div>
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>

        {/* Active Price */}
        <div className="mb-4 px-3 py-2 rounded-lg bg-white/[0.02]">
          <Skeleton className="w-12 h-2.5 mb-1" />
          <Skeleton className="w-28 h-4" />
        </div>

        {/* Token Balances */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1.5">
            <Skeleton className="w-8 h-2.5" />
            <Skeleton className="w-16 h-4" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="w-8 h-2.5" />
            <Skeleton className="w-16 h-4" />
          </div>
        </div>

        {/* Range */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <Skeleton className="w-10 h-2.5" />
            <Skeleton className="w-10 h-2.5" />
          </div>
          <Skeleton className="w-full h-1.5 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}
