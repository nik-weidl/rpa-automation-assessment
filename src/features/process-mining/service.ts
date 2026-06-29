import path from "path";
import { prisma } from "@/lib/prisma";
import { XesLog } from "@/types/domain";
import { parseXesFile } from "@/features/process-mining/adapter";

export async function parseProcessLog(processLogId: string): Promise<XesLog> {
  const processLog = await prisma.processLog.findUnique({
    where: { id: processLogId },
  });

  if (!processLog) {
    throw new Error("Process log not found");
  }

  const fileName = path.basename(processLog.filePath);
  return parseXesFile(fileName);
}
