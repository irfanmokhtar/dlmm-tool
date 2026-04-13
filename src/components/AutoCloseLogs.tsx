"use client";

import React from "react";
import { useAutoCloseContext } from "./AutoCloseMonitor";
import { AutoCloseLogEntry } from "@/hooks/useAutoClose";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, CheckCircle2, AlertTriangle, Info, XCircle, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface AutoCloseLogsProps {
  positionId: string;
}

export default function AutoCloseLogs({ positionId }: AutoCloseLogsProps) {
  const { getLogs, isAutoCloseEnabled } = useAutoCloseContext();
  const logs = getLogs(positionId);

  if (!isAutoCloseEnabled(positionId) && logs.length === 0) {
    return null;
  }

  const getStatusIcon = (log: AutoCloseLogEntry) => {
    if (log.type === "pnl" && log.status === "triggered") {
      return log.message.toLowerCase().includes("take profit")
        ? <TrendingUp className="h-3 w-3 text-emerald-500" />
        : <TrendingDown className="h-3 w-3 text-rose-500" />;
    }
    if (log.type === "pnl") {
      return <BarChart3 className="h-3 w-3 text-violet-400" />;
    }
    switch (log.status) {
      case "passed":
        return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
      case "triggered":
        return <AlertTriangle className="h-3 w-3 text-amber-500" />;
      case "error":
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Info className="h-3 w-3 text-blue-500" />;
    }
  };

  const getStatusColor = (log: AutoCloseLogEntry) => {
    if (log.type === "pnl" && log.status === "triggered") {
      return log.message.toLowerCase().includes("take profit")
        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        : "bg-rose-500/10 text-rose-500 border-rose-500/20";
    }
    if (log.type === "pnl" && log.status === "error") {
      return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    }
    if (log.type === "pnl") {
      return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    }
    switch (log.status) {
      case "passed":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "triggered":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <Card className="bg-white/5 border-white/[0.05] overflow-hidden">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-white/[0.05]">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-400" />
          Monitoring Logs
        </CardTitle>
        <Badge variant="outline" className="text-[10px] bg-white/5 font-mono">
          {logs.length} Entries
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[250px] w-full">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground italic text-xs">
              Waiting for first monitoring cycle...
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {logs.map((log, idx) => (
                <div key={`${log.timestamp}-${idx}`} className="p-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log)}
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${getStatusColor(log).split(" ").find(c => c.startsWith("text-")) || "text-muted-foreground"}`}>
                        {log.type}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      {new Date(log.timestamp).toLocaleTimeString([], { 
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-foreground/80 font-mono pl-5">
                    {log.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
