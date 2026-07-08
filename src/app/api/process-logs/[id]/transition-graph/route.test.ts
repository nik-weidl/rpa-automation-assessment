import { expect, test, beforeAll, afterAll } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { calculateAndStoreActivityProfiles } from "@/features/activity-profiles/service";
import { XesLog } from "@/types/domain";

let testLogId: string;

beforeAll(async () => {
  // setup a mock ProcessLog in the DB
  const log = await prisma.processLog.create({
    data: {
      name: "Test Visualizer Process",
      fileName: "test_visualizer.xes",
      fileSize: 512,
      filePath: "/uploads/test_visualizer.xes",
      status: "PENDING",
    },
  });
  testLogId = log.id;

  // mock event trace log:
  // trace 1: TaskA -> TaskB
  const mockLog: XesLog = {
    name: "Test Visualizer Process",
    traces: [
      {
        caseId: "Case-101",
        events: [
          {
            activity: "TaskA",
            resource: "User1",
            timestamp: new Date("2026-07-08T10:00:00Z"),
            attributes: {},
          },
          {
            activity: "TaskB",
            resource: "User2",
            timestamp: new Date("2026-07-08T10:15:00Z"), // + 15 mins (900,000 ms)
            attributes: {},
          },
        ],
      },
    ],
  };

  // populate traces, events, and activities using our calculation service
  await calculateAndStoreActivityProfiles(testLogId, mockLog);
});

afterAll(async () => {
  // clean up
  if (testLogId) {
    await prisma.processLog.delete({
      where: { id: testLogId },
    });
  }
});

test("GET transition-graph returns formatted node and edge structures", async () => {
  const req = new NextRequest(`http://localhost:3000/api/process-logs/${testLogId}/transition-graph`);
  
  // call Next.js endpoint handler directly
  const response = await GET(req, { params: { id: testLogId } });
  expect(response.status).toBe(200);

  const json = await response.json();
  expect(json.success).toBe(true);
  expect(json.data).toBeDefined();

  const { nodes, edges } = json.data;

  // 1. verify Nodes Structure
  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBe(4); // start, TaskA, TaskB, End

  const startNode = nodes.find((n: any) => n.id === "__START__");
  const endNode = nodes.find((n: any) => n.id === "__END__");
  const taskANode = nodes.find((n: any) => n.id === "TaskA");
  const taskBNode = nodes.find((n: any) => n.id === "TaskB");

  expect(startNode).toBeDefined();
  expect(startNode.type).toBe("start");
  expect(startNode.frequency).toBe(1);

  expect(endNode).toBeDefined();
  expect(endNode.type).toBe("end");
  expect(endNode.frequency).toBe(1);

  expect(taskANode).toBeDefined();
  expect(taskANode.type).toBe("activity");
  expect(taskANode.frequency).toBe(1);

  // 2. verify Edges Structure
  expect(edges).toBeDefined();
  expect(Array.isArray(edges)).toBe(true);
  expect(edges.length).toBe(3); // start->TaskA, TaskA->TaskB, TaskB->End

  const startEdge = edges.find((e: any) => e.source === "__START__" && e.target === "TaskA");
  const transitionEdge = edges.find((e: any) => e.source === "TaskA" && e.target === "TaskB");
  const endEdge = edges.find((e: any) => e.source === "TaskB" && e.target === "__END__");

  expect(startEdge).toBeDefined();
  expect(startEdge.count).toBe(1);

  expect(transitionEdge).toBeDefined();
  expect(transitionEdge.count).toBe(1);
  expect(transitionEdge.averageDelay).toBe(900000); // 15 mins in ms

  expect(endEdge).toBeDefined();
  expect(endEdge.count).toBe(1);
});

test("GET transition-graph returns 404 for missing process log", async () => {
  const req = new NextRequest("http://localhost:3000/api/process-logs/non-existent-id/transition-graph");
  const response = await GET(req, { params: { id: "non-existent-id" } });
  expect(response.status).toBe(404);

  const json = await response.json();
  expect(json.success).toBe(false);
  expect(json.error).toBe("Process log not found");
});
