import { IncomingForm } from "formidable";

export async function parseForm(req: unknown) {
  return new Promise<{ fields: Record<string, string[]>; files: Record<string, unknown[]> }>((resolve, reject) => {
    const form = new IncomingForm({
      multiples: true,
      uploadDir: "/tmp",
      keepExtensions: true,
    });

    form.parse(req as never, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      const normalizedFields = Object.entries(fields as Record<string, string | string[] | undefined>).reduce<Record<string, string[]>>(
        (acc, [key, value]) => {
          if (Array.isArray(value)) {
            acc[key] = value.filter((item): item is string => typeof item === "string");
          } else if (typeof value === "string") {
            acc[key] = [value];
          } else {
            acc[key] = [];
          }
          return acc;
        },
        {}
      );

      const normalizedFiles = Object.entries(files as Record<string, unknown>).reduce<Record<string, unknown[]>>(
        (acc, [key, value]) => {
          if (Array.isArray(value)) {
            acc[key] = value;
          } else if (value !== undefined) {
            acc[key] = [value];
          } else {
            acc[key] = [];
          }
          return acc;
        },
        {}
      );

      resolve({ fields: normalizedFields, files: normalizedFiles });
    });
  });
}
