import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { UploadFileSchema } from "./validation";
import { ProcessLog } from "@/types/models";
import { parseXesFile } from "@/features/process-mining/adapter";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/tmp/uploads";

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export type UploadProgressCallback = (stage: string, percent: number, message: string) => void;

export async function uploadXESFile(
  formData: FormData,
  onProgress?: UploadProgressCallback
): Promise<{ processLog: ProcessLog; filePath: string }> {
  await ensureUploadsDir();

  const file = formData.get("file") as File;
  const processName = (formData.get("processName") as string) || "";

  if (!file) {
    throw new Error("No file provided");
  }

  // validate file
  const fileValidation = UploadFileSchema.safeParse({
    filename: file.name,
    size: file.size,
    mimetype: file.type,
  });

  if (!fileValidation.success) {
    const issue = fileValidation.error.issues[0];
    throw new Error(`File validation failed: ${issue?.message || "Invalid file"}`);
  }

  if (!processName.trim()) {
    throw new Error("Process name is required");
  }

  onProgress?.("SAVING", 10, "Writing file buffer to disk...");

  // save file to disk
  const timestamp = Date.now();
  const sanitizedName = processName.replace(/[^a-z0-9-]/gi, "_").substring(0, 50);
  const fileName = `${timestamp}_${sanitizedName}.xes`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  const fileBuffer = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(fileBuffer));

  onProgress?.("PENDING_DB", 25, "Creating pending process log entry in database...");

  // create ProcessLog in database with initial pending state
  const processLog = await prisma.processLog.create({
    data: {
      name: processName.trim(),
      fileName: file.name,
      fileSize: file.size,
      filePath: `/uploads/${fileName}`,
      status: "PENDING",
    },
  });

  try {
    onProgress?.("PARSING_XML", 45, `Parsing XML event log traces via PM4JS...`);
    const parsedLog = await parseXesFile(fileName);
    
    onProgress?.("BUILDING_PROFILES", 75, `Ingesting ${parsedLog.traces.length} process traces and computing activity metrics...`);
    const { calculateAndStoreActivityProfiles } = await import("@/features/activity-profiles/service");
    await calculateAndStoreActivityProfiles(processLog.id, parsedLog);

    onProgress?.("FINALIZING", 95, "Calculating Rule-Based scores and finalizing process log...");
    const readyLog = await prisma.processLog.update({
      where: { id: processLog.id },
      data: { status: "READY" },
    });

    onProgress?.("COMPLETE", 100, "Processing complete!");

    return { processLog: readyLog, filePath };
  } catch (error) {
    await prisma.processLog.update({
      where: { id: processLog.id },
      data: { status: "ERROR" },
    });
    throw error;
  }
}

export async function getProcessLogs(): Promise<ProcessLog[]> {
  return prisma.processLog.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      activities: {
        select: {
          id: true,
          name: true,
        },
      },
      assessments: {
        select: {
          id: true,
          type: true,
          model: true,
          costUsd: true,
          score: true,
        },
      },
      _count: {
        select: {
          activities: true,
          traces: true,
          assessments: true,
        },
      },
    },
    take: 50,
  }) as any;
}

export async function getProcessLog(id: string): Promise<ProcessLog | null> {
  return prisma.processLog.findUnique({
    where: { id },
  });
}

export async function deleteProcessLog(id: string): Promise<void> {
  const processLog = await prisma.processLog.findUnique({
    where: { id },
  });

  if (!processLog) {
    throw new Error("Process log not found");
  }

  const fileName = path.basename(processLog.filePath);
  const filePath = path.join(UPLOADS_DIR, fileName);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await prisma.processLog.delete({
    where: { id },
  });
}

export async function renameProcessLog(id: string, newFileName: string): Promise<ProcessLog> {
  const processLog = await prisma.processLog.findUnique({
    where: { id },
  });

  if (!processLog) {
    throw new Error("Process log not found");
  }

  if (!newFileName.trim()) {
    throw new Error("File name cannot be empty");
  }

  let normalizedName = newFileName.trim();
  if (!normalizedName.toLowerCase().endsWith(".xes")) {
    normalizedName = `${normalizedName}.xes`;
  }

  if (!normalizedName.toLowerCase().endsWith(".xes")) {
    throw new Error("Uploaded file name must end with .xes");
  }

  normalizedName = normalizedName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (normalizedName.length === 0) {
    throw new Error("Invalid file name");
  }

  const storedFileName = path.basename(processLog.filePath);
  const oldDiskPath = path.join(UPLOADS_DIR, storedFileName);
  const timestampPrefix = storedFileName.includes("_") ? storedFileName.split("_")[0] : `${Date.now()}`;
  const targetFileName = `${timestampPrefix}_${normalizedName}`;
  const targetDiskPath = path.join(UPLOADS_DIR, targetFileName);

  try {
    await fs.rename(oldDiskPath, targetDiskPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Original uploaded file missing from disk");
    }
    throw error;
  }

  return prisma.processLog.update({
    where: { id },
    data: {
      fileName: normalizedName,
      filePath: `/uploads/${targetFileName}`,
    },
  });
}
