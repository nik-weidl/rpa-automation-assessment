import { expect, test, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("./openrouter", () => ({
  callOpenRouter: vi.fn(),
}));

import { evaluateActivityWithLLMAgentic } from "./agentic-service";
import { callOpenRouter } from "./openrouter";

let testLogId: string;
let testActivityId: string;

beforeAll(async () => {
  const log = await prisma.processLog.create({
    data: {
      name: "Test Agentic Process Log",
      fileName: "agentic_test.xes",
      fileSize: 1024,
      filePath: "/uploads/agentic_test.xes",
      status: "PENDING",
    },
  });
  testLogId = log.id;

  const activity = await prisma.activity.create({
    data: {
      processLogId: testLogId,
      name: "Verify Invoice Details",
      frequency: 150,
      caseCoverage: 0.95,
      averageDuration: 120000,
      medianDuration: 110000,
      minDuration: 60000,
      maxDuration: 240000,
      resourceCount: 3,
      resources: ["UserA", "UserB", "UserC"],
      predecessors: ["Receive Invoice"],
      successors: ["Approve Payment"],
      durationVariance: 1440000000,
      resourceEntropy: 0.85,
      predecessorEntropy: 0.2,
      successorEntropy: 0.3,
    },
  });
  testActivityId = activity.id;
});

afterAll(async () => {
  if (testLogId) {
    await prisma.processLog.delete({
      where: { id: testLogId },
    });
  }
});

test("evaluateActivityWithLLMAgentic executes dynamic while-loop with tool selections and early exit", async () => {
  const mockedCall = vi.mocked(callOpenRouter);

  // turn 1 mock: hypothesis & decision to RETRIEVE_METRICS
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      confidenceScore: 60,
      label: "MEDIUM",
      reasoning: "Standard invoice verification step, but system integrations may introduce manual checks.",
      selfCritique: "Need quantitative process metrics to verify time variance.",
      selectedTool: "RETRIEVE_METRICS",
      requestedMetrics: ["durationVariance", "predecessorEntropy", "resourceCount"],
    }),
    latencyMs: 800,
    tokens: { prompt: 100, completion: 50, total: 150 },
    costUsd: 0.0005,
  });

  // turn 2 mock: decision to CLASSIFY_ARCHETYPE
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      confidenceScore: 75,
      label: "MEDIUM",
      reasoning: "Retrieved metrics show low predecessor entropy.",
      selfCritique: "Need to classify technology archetype.",
      selectedTool: "CLASSIFY_ARCHETYPE",
      requestedMetrics: [],
    }),
    latencyMs: 600,
    tokens: { prompt: 150, completion: 60, total: 210 },
    costUsd: 0.0006,
  });

  // tool execution mock: archetype classification
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      rpaArchetype: "API_INTEGRATION",
      rpaArchetypeLabel: "API-Based Direct Integration",
      implementationEffort: "LOW",
      effortRationale: "ERP endpoint available.",
      estimatedMonthlyHoursSaved: 50,
    }),
    latencyMs: 500,
    tokens: { prompt: 100, completion: 40, total: 140 },
    costUsd: 0.0004,
  });

  // turn 3 mock: decision to FINAL_SYNTHESIS
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      confidenceScore: 88,
      label: "HIGH",
      reasoning: "Archetype classified and metrics retrieved. Ready for synthesis.",
      selfCritique: "All critical proofs gathered.",
      selectedTool: "FINAL_SYNTHESIS",
      requestedMetrics: [],
    }),
    latencyMs: 400,
    tokens: { prompt: 120, completion: 30, total: 150 },
    costUsd: 0.0003,
  });

  // final synthesis mock
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      score: 88,
      label: "HIGH",
      reasoning: "Retrieved metrics and neighbor context confirm low predecessor entropy (0.2) and API integration feasibility.",
      risks: ["OCR misreads on non-standard invoice formats"],
      missingInfo: ["Standard Operating Procedure for handling missing tax numbers"],
    }),
    latencyMs: 1200,
    tokens: { prompt: 250, completion: 90, total: 340 },
    costUsd: 0.0012,
  });

  // critique verification mock
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      calibratedScore: 88,
      calibratedLabel: "HIGH",
      critiqueNotes: "Verified with high confidence. Low predecessor entropy confirms straight-through flow.",
      calibrationRationale: "Retrieved metrics and neighbor context confirm low predecessor entropy (0.2) and API integration feasibility.",
      risks: ["OCR misreads on non-standard invoice formats"],
      missingInfo: ["Standard Operating Procedure for handling missing tax numbers"],
    }),
    latencyMs: 500,
    tokens: { prompt: 150, completion: 50, total: 200 },
    costUsd: 0.0005,
  });

  const result = await evaluateActivityWithLLMAgentic(
    testActivityId,
    "~google/gemini-pro-latest"
  );

  expect(result).toBeDefined();
  expect(result.type).toBe("LLM_AGENTIC");
  expect(result.score).toBe(88);
  expect(result.label).toBe("HIGH");

  const raw = result.rawResponse as any;
  expect(raw).toBeDefined();
  expect(raw.turnsExecuted).toBe(3);
  expect(raw.confidenceScore).toBe(88);
  expect(raw.rpaArchetype).toBe("API_INTEGRATION");
  expect(raw.implementationEffort).toBe("LOW");
  expect(raw.thinkingTrace).toBeDefined();
  expect(Array.isArray(raw.thinkingTrace)).toBe(true);
  expect(raw.thinkingTrace.length).toBe(7);
});

test("evaluateActivityWithLLMAgentic executes new tools (INSPECT_TRACE_VARIANTS, ANALYZE_REWORK_LOOPS, SIMULATE_RPA_ROI)", async () => {
  const mockedCall = vi.mocked(callOpenRouter);

  // turn 1: decision to INSPECT_TRACE_VARIANTS
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      confidenceScore: 50,
      label: "MEDIUM",
      reasoning: "Checking trace variants to determine Happy Path alignment.",
      selfCritique: "Need process variant proof.",
      selectedTool: "INSPECT_TRACE_VARIANTS",
      requestedMetrics: [],
    }),
    latencyMs: 500,
    tokens: { prompt: 100, completion: 40, total: 140 },
    costUsd: 0.0004,
  });

  // turn 2: decision to ANALYZE_REWORK_LOOPS
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      confidenceScore: 65,
      label: "MEDIUM",
      reasoning: "Trace variant checked. Now checking rework self-loops.",
      selfCritique: "Need rework repetition proof.",
      selectedTool: "ANALYZE_REWORK_LOOPS",
      requestedMetrics: [],
    }),
    latencyMs: 500,
    tokens: { prompt: 100, completion: 40, total: 140 },
    costUsd: 0.0004,
  });

  // turn 3: decision to SIMULATE_RPA_ROI
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      confidenceScore: 78,
      label: "HIGH",
      reasoning: "Rework loops checked. Now running ROI simulation.",
      selfCritique: "Need payback calculation.",
      selectedTool: "SIMULATE_RPA_ROI",
      requestedMetrics: [],
    }),
    latencyMs: 500,
    tokens: { prompt: 100, completion: 40, total: 140 },
    costUsd: 0.0004,
  });

  // turn 4: decision to FINAL_SYNTHESIS
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      confidenceScore: 90,
      label: "HIGH",
      reasoning: "All tools executed. Ready for synthesis.",
      selfCritique: "Complete evidence gathered.",
      selectedTool: "FINAL_SYNTHESIS",
      requestedMetrics: [],
    }),
    latencyMs: 400,
    tokens: { prompt: 100, completion: 30, total: 130 },
    costUsd: 0.0003,
  });

  // final synthesis mock
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      score: 92,
      label: "HIGH",
      reasoning: "High ROI and happy path alignment confirm top feasibility.",
      risks: [],
      missingInfo: [],
    }),
    latencyMs: 1000,
    tokens: { prompt: 200, completion: 70, total: 270 },
    costUsd: 0.0010,
  });

  // critique verification mock
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      calibratedScore: 92,
      calibratedLabel: "HIGH",
      critiqueNotes: "Confirmed 92% HIGH feasibility based on payback simulation.",
      calibrationRationale: "High ROI and happy path alignment confirm top feasibility.",
      risks: [],
      missingInfo: [],
    }),
    latencyMs: 500,
    tokens: { prompt: 150, completion: 50, total: 200 },
    costUsd: 0.0005,
  });

  const result = await evaluateActivityWithLLMAgentic(
    testActivityId,
    "~google/gemini-pro-latest"
  );

  expect(result).toBeDefined();
  expect(result.score).toBe(92);
  const raw = result.rawResponse as any;
  expect(raw.thinkingTrace).toBeDefined();
  const stepTypes = raw.thinkingTrace.map((s: any) => s.type);
  expect(stepTypes).toContain("variants");
  expect(stepTypes).toContain("rework");
  expect(stepTypes).toContain("roi");
  expect(stepTypes).toContain("critique");
});
