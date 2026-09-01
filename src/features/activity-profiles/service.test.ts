import { expect, test, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { XesLog } from "@/types/domain";
import { calculateAndStoreActivityProfiles } from "./service";

let testLogId: string;

beforeAll(async () => {
  // clean up and create a mock ProcessLog in the test database
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
  // clean up database test records
  if (testLogId) {
    await prisma.processLog.delete({
      where: { id: testLogId },
    });
  }
});

test("calculateAndStoreActivityProfiles correctly ingests and computes metrics", async () => {
  // set up a mock XesLog containing 2 traces:
  // trace 1: A (10:00, Res1) -> B (10:10, Res1) -> C (10:30, Res2)
  // trace 2: A (11:00, Res1) -> C (11:15, Res2) -> B (11:45, Res2)
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

  // run the profile calculator and database ingest
  await calculateAndStoreActivityProfiles(testLogId, mockLog);

  // 1. verify Traces Ingested
  const traces = await prisma.trace.findMany({
    where: { processLogId: testLogId },
    include: { events: true },
  });
  expect(traces.length).toBe(2);

  const trace1 = traces.find((t) => t.caseId === "Case-1");
  const trace2 = traces.find((t) => t.caseId === "Case-2");
  expect(trace1).toBeDefined();
  expect(trace2).toBeDefined();

  // verify chronological sort and event lengths
  expect(trace1!.events.length).toBe(3);
  expect(trace2!.events.length).toBe(3);

  // 2. verify Activity Profiles Calculated and Persisted
  const activities = await prisma.activity.findMany({
    where: { processLogId: testLogId },
  });
  expect(activities.length).toBe(3); // a, b, and c

  const profileA = activities.find((a) => a.name === "A");
  const profileB = activities.find((a) => a.name === "B");
  const profileC = activities.find((a) => a.name === "C");

  expect(profileA).toBeDefined();
  expect(profileB).toBeDefined();
  expect(profileC).toBeDefined();

  // assertions for activity "A" (always first event in both cases)
  expect(profileA!.frequency).toBe(2);
  expect(profileA!.caseCoverage).toBe(1.0);
  expect(profileA!.averageDuration).toBe(0);
  expect(profileA!.medianDuration).toBe(0);
  expect(profileA!.minDuration).toBe(0);
  expect(profileA!.maxDuration).toBe(0);
  expect(profileA!.durationVariance).toBe(0);
  expect(profileA!.resourceCount).toBe(1);
  expect(profileA!.resources).toContain("Res1");
  expect(profileA!.resourceEntropy).toBe(0);
  expect(profileA!.predecessorEntropy).toBe(0);
  // successor counts: 1 to B (Case-1), 1 to C (Case-2). equal probability => entropy is -(0.5 * log2(0.5) * 2) = 1.0
  expect(profileA!.successorEntropy).toBeCloseTo(1.0);
  expect(profileA!.successors).toContain("B");
  expect(profileA!.successors).toContain("C");

  // assertions for activity "b"
  // case-1: index 1. predecessor a. duration = 10 mins (600,000 ms). resource = res1
  // case-2: index 2. predecessor c. duration = 30 mins (1,800,000 ms). resource = res2
  expect(profileB!.frequency).toBe(2);
  expect(profileB!.caseCoverage).toBe(1.0);
  expect(profileB!.minDuration).toBe(600000);
  expect(profileB!.maxDuration).toBe(1800000);
  expect(profileB!.averageDuration).toBe(1200000);
  expect(profileB!.medianDuration).toBe(1200000);
  // variance: sum((d - avg)^2) / count => ((600000-1200000)^2 + (1800000-1200000)^2) / 2 = 3.6e11
  expect(profileB!.durationVariance).toBe(3.6e11);
  expect(profileB!.resourceCount).toBe(2);
  expect(profileB!.resources).toContain("Res1");
  expect(profileB!.resources).toContain("Res2");
  // resource entropy: Res1 (freq 1), Res2 (freq 1). Entropy = 1.0
  expect(profileB!.resourceEntropy).toBeCloseTo(1.0);
  expect(profileB!.predecessorEntropy).toBeCloseTo(1.0);
  expect(profileB!.predecessors).toContain("A");
  expect(profileB!.predecessors).toContain("C");

  // assertions for activity "c"
  // case-1: index 2. predecessor b. duration = 20 mins (1,200,000 ms). resource = res2
  // case-2: index 1. predecessor a. duration = 15 mins (900,000 ms). resource = res2
  expect(profileC!.frequency).toBe(2);
  expect(profileC!.caseCoverage).toBe(1.0);
  expect(profileC!.minDuration).toBe(900000);
  expect(profileC!.maxDuration).toBe(1200000);
  expect(profileC!.averageDuration).toBe(1050000);
  expect(profileC!.medianDuration).toBe(1050000);
  expect(profileC!.resourceCount).toBe(1);
  expect(profileC!.resources).toContain("Res2");
  expect(profileC!.resourceEntropy).toBe(0);

  // 3. verify rule-based assessments calculated and persisted
  const assessments = await prisma.assessment.findMany({
    where: { processLogId: testLogId },
  });
  expect(assessments.length).toBe(3);

  const assessmentA = assessments.find((a) => a.activityId === profileA!.id);
  expect(assessmentA).toBeDefined();
  expect(assessmentA!.type).toBe("RULE_BASED");
  expect(assessmentA!.score).toBeGreaterThanOrEqual(0);
  expect(assessmentA!.score).toBeLessThanOrEqual(100);
  expect(assessmentA!.label).toBeDefined();
  expect(assessmentA!.reasoning).toBeDefined();
});
