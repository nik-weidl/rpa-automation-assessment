export interface XesEvent {
  activity: string;
  resource?: string;
  timestamp: Date;
  attributes: Record<string, unknown>;
}

export interface XesTrace {
  caseId: string;
  events: XesEvent[];
}

export interface XesLog {
  name: string;
  traces: XesTrace[];
}

export interface ActivityProfile {
  name: string;
  frequency: number;
  caseCoverage: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  resourceCount: number;
  resources: string[];
  predecessors: string[];
  successors: string[];
  durationVariance: number;
  resourceEntropy: number;
  predecessorEntropy: number;
  successorEntropy: number;
}

export type AutomationLabel = "LOW" | "MEDIUM" | "HIGH";

export interface AutomationScore {
  score: number;
  label: AutomationLabel;
  reasoning: string;
  risks?: string[];
  missingInformation?: string[];
}
