import { expect, test, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { XesLog } from "@/types/domain";
import { calculateAndStoreActivityProfiles } from "./service";

let testLogId: string;

beforeAll(async () => {
  // Clean up and create a mock ProcessLog in the test database
  const log = await prisma.processLog.create({
    data: {
      name: "Test Ingestion Process",
      fileName: "test_ingestion.xes",
      fileSize: 1024,
      filePath: "/uploads/test_ingestion.xes",
      status: "PENDING",
    },
  });
  testLogId = log.id;
});

afterAll(async () => {
  // Clean up database test records
  if (testLogId) {
    await prisma.processLog.delete({
      where: { id: testLogId },
    });
  }
});

test("calculateAndStoreActivityProfiles correctly ingests and computes metrics", async () => {
  // Set up a mock XesLog containing 2 traces:
  // Trace 1: A (10:00, Res1) -> B (10:10, Res1) -> C (10:30, Res2)
  // Trace 2: A (11:00, Res1) -> C (11:15, Res2) -> B (11:45, Res2)
  const mockLog: XesLog = {
    name: "Test Ingestion Process",
    traces: [
      {
        caseId: "Case-1",
        events: [
          {
            activity: "A",
            resource: "Res1",
            timestamp: new Date("2026-07-08T10:00:00Z"),
            attributes: {},
          },
          {
            activity: "B",
            resource: "Res1",
            timestamp: new Date("2026-07-08T10:10:00Z"), // + 10 mins (600,000 ms)
            attributes: {},
          },
          {
            activity: "C",
            resource: "Res2",
            timestamp: new Date("2026-07-08T10:30:00Z"), // + 20 mins (1,200,000 ms)
            attributes: {},
          },
        ],
      },
      {
        caseId: "Case-2",
        events: [
          {
            activity: "A",
            resource: "Res1",
            timestamp: new Date("2026-07-08T11:00:00Z"),
            attributes: {},
          },
          {
            activity: "C",
            resource: "Res2",
            timestamp: new Date("2026-07-08T11:15:00Z"), // + 15 mins (900,000 ms)
            attributes: {},
          },
          {
            activity: "B",
            resource: "Res2",
            timestamp: new Date("2026-07-08T11:45:00Z"), // + 30 mins (1,800,000 ms)
            attributes: {},
          },
        ],
      },
    ],
  };

  // Run the profile calculator and database ingest
  await calculateAndStoreActivityProfiles(testLogId, mockLog);

  // 1. Verify Traces Ingested
  const traces = await prisma.trace.findMany({
    where: { processLogId: testLogId },
    include: { events: true },
  });
  expect(traces.length).toBe(2);

  const trace1 = traces.find((t) => t.caseId === "Case-1");
  const trace2 = traces.find((t) => t.caseId === "Case-2");
  expect(trace1).toBeDefined();
  expect(trace2).toBeDefined();

  // Verify chronological sort and event lengths
  expect(trace1!.events.length).toBe(3);
  expect(trace2!.events.length).toBe(3);

  // 2. Verify Activity Profiles Calculated and Persisted
  const activities = await prisma.activity.findMany({
    where: { processLogId: testLogId },
  });
  expect(activities.length).toBe(3); // A, B, and C

  const profileA = activities.find((a) => a.name === "A");
  const profileB = activities.find((a) => a.name === "B");
  const profileC = activities.find((a) => a.name === "C");

  expect(profileA).toBeDefined();
  expect(profileB).toBeDefined();
  expect(profileC).toBeDefined();

  // Assertions for Activity "A" (always first event in both cases)
  expect(profileA!.frequency).toBe(2);
  expect(profileA!.caseCoverage).toBe(1.0);
  expect(profileA!.averageDuration).toBe(0);
  expect(profileA!.minDuration).toBe(0);
  expect(profileA!.maxDuration).toBe(0);
  expect(profileA!.durationVariance).toBe(0);
  expect(profileA!.resourceCount).toBe(1);
  expect(profileA!.resources).toContain("Res1");
  expect(profileA!.resourceEntropy).toBe(0);
  expect(profileA!.predecessorEntropy).toBe(0);
  // Successor counts: 1 to B (Case-1), 1 to C (Case-2). Equal probability => entropy is -(0.5 * log2(0.5) * 2) = 1.0
  expect(profileA!.successorEntropy).toBeCloseTo(1.0);
  expect(profileA!.successors).toContain("B");
  expect(profileA!.successors).toContain("C");

  // Assertions for Activity "B"
  // Case-1: index 1. Predecessor A. Duration = 10 mins (600,000 ms). Resource = Res1
  // Case-2: index 2. Predecessor C. Duration = 30 mins (1,800,000 ms). Resource = Res2
  expect(profileB!.frequency).toBe(2);
  expect(profileB!.caseCoverage).toBe(1.0);
  expect(profileB!.minDuration).toBe(600000);
  expect(profileB!.maxDuration).toBe(1800000);
  expect(profileB!.averageDuration).toBe(1200000);
  // Variance: sum((d - avg)^2) / count => ((600000-1200000)^2 + (1800000-1200000)^2) / 2 = 3.6e11
  expect(profileB!.durationVariance).toBe(3.6e11);
  expect(profileB!.resourceCount).toBe(2);
  expect(profileB!.resources).toContain("Res1");
  expect(profileB!.resources).toContain("Res2");
  // Resource Entropy: Res1 (freq 1), Res2 (freq 1). Entropy = 1.0
  expect(profileB!.resourceEntropy).toBeCloseTo(1.0);
  expect(profileB!.predecessorEntropy).toBeCloseTo(1.0);
  expect(profileB!.predecessors).toContain("A");
  expect(profileB!.predecessors).toContain("C");

  // Assertions for Activity "C"
  // Case-1: index 2. Predecessor B. Duration = 20 mins (1,200,000 ms). Resource = Res2
  // Case-2: index 1. Predecessor A. Duration = 15 mins (900,000 ms). Resource = Res2
  expect(profileC!.frequency).toBe(2);
  expect(profileC!.caseCoverage).toBe(1.0);
  expect(profileC!.minDuration).toBe(900000);
  expect(profileC!.maxDuration).toBe(1200000);
  expect(profileC!.averageDuration).toBe(1050000);
  expect(profileC!.resourceCount).toBe(1);
  expect(profileC!.resources).toContain("Res2");
  expect(profileC!.resourceEntropy).toBe(0);
});
