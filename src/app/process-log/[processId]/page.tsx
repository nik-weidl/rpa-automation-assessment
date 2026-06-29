import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseProcessLog } from "@/features/process-mining/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: {
    processId: string;
  };
}

export default async function ProcessLogPage({ params }: PageProps) {
  const processLog = await prisma.processLog.findUnique({
    where: { id: params.processId },
  });

  if (!processLog) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">Process log not found</h1>
        <p className="mt-4 text-muted-foreground">The requested process log does not exist.</p>
        <Link href="/upload">
          <Button className="mt-6">Back to upload</Button>
        </Link>
      </div>
    );
  }

  let parsedLog;
  let parseError: string | null = null;

  try {
    parsedLog = await parseProcessLog(processLog.id);
  } catch (error) {
    parseError = error instanceof Error ? error.message : "Failed to parse XES file";
  }

  return (
    <div className="space-y-8 p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold">{processLog.name}</h1>
          <p className="text-muted-foreground mt-2">Uploaded file: {processLog.fileName}</p>
          <p className="text-sm text-muted-foreground">Status: {processLog.status}</p>
        </div>
        <Link href="/upload">
          <Button variant="outline">Back to uploads</Button>
        </Link>
      </div>

      {parseError ? (
        <Card>
          <CardHeader>
            <CardTitle>Process mining parse error</CardTitle>
            <CardDescription>{parseError}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        parsedLog && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Log Summary</CardTitle>
                <CardDescription>{parsedLog.traces.length} traces loaded</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Log name</p>
                    <p className="font-semibold">{parsedLog.name}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Trace count</p>
                    <p className="font-semibold">{parsedLog.traces.length}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">First trace</p>
                    <p className="font-semibold">{parsedLog.traces[0]?.caseId ?? "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trace sample</CardTitle>
                <CardDescription>First 3 traces with event activity names</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {parsedLog.traces.slice(0, 3).map((trace) => (
                    <div key={trace.caseId} className="rounded-lg border p-4">
                      <p className="font-semibold">Case: {trace.caseId}</p>
                      <p className="text-sm text-muted-foreground">Events: {trace.events.length}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {trace.events.slice(0, 6).map((event, index) => (
                          <span key={`${trace.caseId}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                            {event.activity || "Unknown"}
                          </span>
                        ))}
                        {trace.events.length > 6 && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                            +{trace.events.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  );
}
