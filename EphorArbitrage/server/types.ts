export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;  // TTFT (Time to First Token)
  totalTimeMs: number;     // Total generation time
  tokensPerSecond: number; // Throughput: outputTokens / (totalTimeMs / 1000)
}
