import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import ProcessLogDetailsClient from "./ProcessLogDetailsClient";

interface PageProps {
  params: Promise<{
    processId: string;
  }>;
}

export default async function ProcessLogPage({ params }: PageProps) {
  const { processId } = await params;

  const processLog = await prisma.processLog.findUnique({
    where: { id: processId },
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

  return <ProcessLogDetailsClient processLog={processLog} />;
}
