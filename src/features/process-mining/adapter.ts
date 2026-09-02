import fs from "fs";
import readline from "readline";
import { XesEvent, XesLog, XesTrace } from "@/types/domain";

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

  try {
    await import("pm4js/init.js");
  } catch (e) {
    try {
      const pm = await import("pm4js");
      const candidate = (pm as any).XesImporter || (pm as any).default?.XesImporter;
      if (candidate) {
        (globalThis as any).XesImporter = candidate;
      }
    } catch (e2) {}
  }
}

async function parseXesFileWithPm4js(fileName: string): Promise<XesLog> {
  const filePath = `${UPLOADS_DIR}/${fileName}`;
  const xml = await fs.promises.readFile(filePath, "utf-8");
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

export async function parseXesFile(fileName: string): Promise<XesLog> {
  const filePath = `${UPLOADS_DIR}/${fileName}`;
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${fileName}`);
  }

  try {
    const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let logName = fileName;
    const traces: XesTrace[] = [];

    let currentTrace: XesTrace | null = null;
    let currentEvent: XesEvent | null = null;
    let inLogHeader = true;

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 1. Log Name
      if (inLogHeader && trimmed.includes('key="concept:name"')) {
        const match = trimmed.match(/value="([^"]+)"/);
        if (match) {
          logName = match[1];
          inLogHeader = false;
        }
      }

      // 2. Start Trace
      if (trimmed.startsWith("<trace")) {
        inLogHeader = false;
        currentTrace = {
          caseId: "unknown",
          events: [],
        };
        continue;
      }

      // 3. End Trace
      if (trimmed.startsWith("</trace>")) {
        if (currentTrace) {
          traces.push(currentTrace);
          currentTrace = null;
        }
        continue;
      }

      // 4. Case ID
      if (currentTrace && !currentEvent) {
        if (trimmed.includes('key="concept:name"') || trimmed.includes('key="id"')) {
          const match = trimmed.match(/value="([^"]+)"/);
          if (match && currentTrace.caseId === "unknown") {
            currentTrace.caseId = match[1];
          }
        }
      }

      // 5. Start Event
      if (currentTrace && trimmed.startsWith("<event")) {
        currentEvent = {
          activity: "",
          resource: undefined,
          timestamp: new Date(),
          attributes: {},
        };
        continue;
      }

      // 6. End Event
      if (currentTrace && currentEvent && trimmed.startsWith("</event>")) {
        if (currentEvent.activity) {
          currentTrace.events.push(currentEvent);
        }
        currentEvent = null;
        continue;
      }

      // 7. Event attributes
      if (currentEvent) {
        if (trimmed.includes('key="concept:name"')) {
          const match = trimmed.match(/value="([^"]+)"/);
          if (match) currentEvent.activity = match[1];
        } else if (trimmed.includes('key="org:resource"')) {
          const match = trimmed.match(/value="([^"]+)"/);
          if (match) currentEvent.resource = match[1];
        } else if (trimmed.includes('key="time:timestamp"')) {
          const match = trimmed.match(/value="([^"]+)"/);
          if (match) {
            const d = new Date(match[1]);
            if (!isNaN(d.getTime())) {
              currentEvent.timestamp = d;
            }
          }
        }
      }
    }

    if (traces.length > 0) {
      return {
        name: logName,
        traces,
      };
    }
  } catch (err) {
    console.warn("Fast streaming parser encountered error, falling back to PM4JS:", err);
  }

  // Fallback to PM4JS DOM parser
  return parseXesFileWithPm4js(fileName);
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
