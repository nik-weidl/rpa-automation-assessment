import { z } from "zod";

export const XES_FILE_VALIDATION = {
  MAX_SIZE: 500 * 1024 * 1024, // 500MB
  ALLOWED_TYPES: ["application/xml", "text/xml"],
  ALLOWED_EXTENSIONS: [".xes"],
};

export const UploadFileSchema = z.object({
  filename: z.string().endsWith(".xes", { message: "Must be .xes file" }),
  size: z.number().max(XES_FILE_VALIDATION.MAX_SIZE, { message: "File too large (max 500MB)" }),
  mimetype: z.string(),
});

export const CreateProcessLogSchema = z.object({
  name: z.string().min(1, "Process name required").max(255),
  fileName: z.string(),
  fileSize: z.number(),
  filePath: z.string(),
});

export type CreateProcessLogInput = z.infer<typeof CreateProcessLogSchema>;
