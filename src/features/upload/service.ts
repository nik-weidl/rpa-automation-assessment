import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { UploadFileSchema } from "./validation";
import { ProcessLog } from "@/types/models";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/tmp/uploads";

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function uploadXESFile(formData: FormData): Promise<{ processLog: ProcessLog; filePath: string }> {
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

  // save file to disk
  const timestamp = Date.now();
  const sanitizedName = processName.replace(/[^a-z0-9-]/gi, "_").substring(0, 50);
  const fileName = `${timestamp}_${sanitizedName}.xes`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  const fileBuffer = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(fileBuffer));

  // create ProcessLog in database
  const processLog = await prisma.processLog.create({
    data: {
      name: processName.trim(),
      fileName: file.name,
      fileSize: file.size,
      filePath: `/uploads/${fileName}`,
      status: "PENDING",
    },
  });

  return { processLog, filePath };
}

export async function getProcessLogs(): Promise<ProcessLog[]> {
  return prisma.processLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getProcessLog(id: string): Promise<ProcessLog | null> {
  return prisma.processLog.findUnique({
    where: { id },
  });
}
