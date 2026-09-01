import fs from "fs/promises";
import path from "path";
import { expect, test, beforeAll, afterAll } from "vitest";

const SAMPLE = path.resolve(__dirname, "../../../../testscript/BPIC15_4.xes");
const TMP_DIR = path.resolve(process.cwd(), "tmp/test-uploads");

beforeAll(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
  try {
    await fs.copyFile(SAMPLE, path.join(TMP_DIR, "BPIC15_4.xes"));
    // ensure adapter picks up our uploads dir by setting env before importing
    process.env.UPLOADS_DIR = TMP_DIR;
  } catch (err) {
    // if sample is missing, tests will be skipped via runtime checks
    console.warn("sample xes not found at", SAMPLE);
  }
});

afterAll(async () => {
    // clean up temp files
    try {
        await fs.rm(TMP_DIR, { recursive: true, force: true });
    } catch (e) {}
});

test("parseXesFile returns a valid XesLog structure", async () => {
  // ensure the real pm4js importer is loaded for an integration-style test.
  try {
    await import("pm4js/init.js");
  } catch (e) {
    // if pm4js can't be loaded in this environment, let the adapter attempt its own imports.
    // the adapter will throw if importer truly isn't available.
  }

  const { parseXesFile } = await import("./adapter");
  const log = await parseXesFile("BPIC15_4.xes");

  expect(log).toBeDefined();
  expect(typeof log.name).toBe("string");
  expect(Array.isArray(log.traces)).toBe(true);
  expect(log.traces.length).toBeGreaterThan(0);

  const trace = log.traces[0];
  expect(typeof trace.caseId).toBe("string");
  expect(Array.isArray(trace.events)).toBe(true);
  expect(trace.events.length).toBeGreaterThan(0);

  const event = trace.events[0];
  expect(typeof event.activity).toBe("string");
  expect(event.timestamp instanceof Date).toBe(true);
});

test("parseXesFile throws for missing file", async () => {
  const { parseXesFile } = await import("./adapter");
  await expect(parseXesFile("does-not-exist.xes")).rejects.toThrow();
});
