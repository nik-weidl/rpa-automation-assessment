import fs from "fs/promises";
import { XesEvent, XesLog } from "@/types/domain";

declare global {
  var XesImporter: {
    apply: (xmlString: string) => Pm4jLog;
  };
}

type Pm4jAttribute = {
  value: string | number | boolean | Date | null;
  [key: string]: unknown;
};

type Pm4jEvent = {
  attributes: Record<string, Pm4jAttribute>;
};

type Pm4jTrace = {
  attributes: Record<string, Pm4jAttribute>;
  events: Pm4jEvent[];
};

type Pm4jLog = {
  attributes?: Record<string, Pm4jAttribute>;
  traces?: Pm4jTrace | Pm4jTrace[];
};

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/tmp/uploads";

async function ensurePm4jsImporter() {
  if (globalThis.XesImporter) return;

  // Try loading the library's init entry which wires up importers
  try {
    // Prefer the explicit init path to avoid directory import issues
    // This will execute pm4js's initialization and register XesImporter on globalThis
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await import("pm4js/init.js");
  } catch (e) {
    // Fallback: try importing the package entry and check for exported importer
    try {
      const pm = await import("pm4js");
      // some builds may export under default
      const candidate = (pm as any).XesImporter || (pm as any).default?.XesImporter;
      if (candidate) {
        (globalThis as any).XesImporter = candidate;
      }
    } catch (e2) {
      // ignore — will handle below
    }
  }

  if (!globalThis.XesImporter) {
    throw new Error("PM4JS XES importer is unavailable after attempted imports");
  }
}

export async function parseXesFile(fileName: string): Promise<XesLog> {
  const xml = await fs.readFile(`${UPLOADS_DIR}/${fileName}`, "utf-8");
  await ensurePm4jsImporter();
  const eventLog = globalThis.XesImporter.apply(xml) as Pm4jLog;
  const traces = Array.isArray(eventLog.traces)
    ? eventLog.traces
    : eventLog.traces
    ? [eventLog.traces]
    : [];

  return {
    name: eventLog.attributes?.name?.value?.toString() || fileName,
    traces: traces.map((trace: Pm4jTrace) => ({
      caseId:
        trace.attributes?.["concept:name"]?.value?.toString() ||
        trace.attributes?.id?.value?.toString() ||
        "unknown",
      events: Array.isArray(trace.events)
        ? trace.events.map(parseEvent)
        : trace.events
        ? [parseEvent(trace.events)]
        : [],
    })),
  };
}

function parseEvent(event: Pm4jEvent): XesEvent {
  const timestampValue = event.attributes?.["time:timestamp"]?.value;

  return {
    activity: event.attributes?.["concept:name"]?.value?.toString() || "",
    resource: event.attributes?.["org:resource"]?.value?.toString() || undefined,
    timestamp: timestampValue ? new Date(String(timestampValue)) : new Date(),
    attributes: event.attributes,
  };
}
