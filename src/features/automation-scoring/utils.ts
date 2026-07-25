export interface ModelRates {
  inputRate: number;
  outputRate: number;
}

/**
 * resolves input and output token rates (per 1M tokens) for a given model ID
 */
export function getModelRates(modelId: string): ModelRates {
  const model = modelId.startsWith("~") ? modelId.slice(1) : modelId;
  let inputRate = 0;
  let outputRate = 0;

  if (model.includes("gemini-pro") || model.includes("gemini-flash")) {
    inputRate = 0.075;
    outputRate = 0.30;
  } else if (model.includes("claude-sonnet") || model.includes("claude-3-5-sonnet")) {
    inputRate = 3.00;
    outputRate = 15.00;
  } else if (model.includes("gpt-latest") || model.includes("gpt-4o")) {
    inputRate = 5.00;
    outputRate = 15.00;
  } else if (model.includes("gpt-mini") || model.includes("gpt-4o-mini")) {
    inputRate = 0.15;
    outputRate = 0.60;
  } else if (model.includes("claude-3-haiku")) {
    inputRate = 0.25;
    outputRate = 1.25;
  }

  return { inputRate, outputRate };
}

/**
 * calculates the USD token cost of an LLM completion request
 */
export function calculateLlmCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const { inputRate, outputRate } = getModelRates(modelId);
  return (promptTokens * inputRate + completionTokens * outputRate) / 1_000_000;
}
