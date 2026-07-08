"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessLog } from "@/types/models";
import ProcessGraph from "@/features/visualization/ProcessGraph";

interface ProcessLogDetailsClientProps {
  processLog: ProcessLog;
}

export default function ProcessLogDetailsClient({ processLog }: ProcessLogDetailsClientProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{processLog.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            File: <span className="font-mono">{processLog.fileName}</span> • Size: {(
              processLog.fileSize /
              1024 /
              1024
            ).toFixed(2)}{" "}
            MB
          </p>
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset mt-2 ${
              processLog.status === "READY"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                : processLog.status === "ERROR"
                ? "bg-rose-50 text-rose-700 ring-rose-600/10"
                : "bg-amber-50 text-amber-700 ring-amber-600/10"
            }`}
          >
            {processLog.status}
          </span>
        </div>
        <Link href="/upload">
          <Button variant="outline">Back to uploads</Button>
        </Link>
      </div>

      {/* React Flow Graph (Full Width) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Process Transition Map
          </h2>
          <p className="text-xs text-muted-foreground">
            Select a node to inspect activity details
          </p>
        </div>
        <ProcessGraph processLogId={processLog.id} onNodeSelect={setSelectedActivity} />
      </div>

      {/* Details Panel (At the Bottom) */}
      <Card className="min-h-[200px] flex flex-col border shadow-md">
        <CardHeader className="border-b bg-slate-50/50">
          <CardTitle>Activity Details</CardTitle>
          <CardDescription>
            {selectedActivity ? "Profile and metrics" : "No activity selected"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center p-6 overflow-y-auto">
          {selectedActivity ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
                  Selected Activity
                </span>
                <h3 className="text-lg font-bold text-slate-800 break-all">{selectedActivity}</h3>
              </div>
              {/* TODO: Implement activity profile metrics sidebar */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-col gap-2">
                <p className="text-xs text-slate-600 font-medium">
                  Select nodes in the process map to inspect activity profiles.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <span className="text-4xl block">🔍</span>
              <p className="text-sm font-medium text-slate-500">
                Select an activity node in the process map to view details
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
