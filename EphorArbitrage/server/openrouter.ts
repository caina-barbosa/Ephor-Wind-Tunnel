import OpenAI from "openai";
import type { ChatMessage, ChatCompletionResult } from "./types";

export interface OpenRouterChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

export async function createOpenRouterChatCompletion(
  request: OpenRouterChatCompletionRequest
): Promise<ChatCompletionResult> {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  try {
    const timeoutMs = request.timeoutMs || 90000;
    const startTime = Date.now();
    
    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openRouterApiKey,
      timeout: timeoutMs,
      defaultHeaders: {
        "HTTP-Referer": "https://ephor.replit.app",
        "X-Title": "EPHOR ARBITRAGE",
      },
    });

    // Use streaming to measure TTFT (Time to First Token)
    const stream = await client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 4096,
      stream: true,
    });

    let ttftMs = 0;
    let content = "";
    let firstChunkReceived = false;
    
    for await (const chunk of stream) {
      if (!firstChunkReceived) {
        ttftMs = Date.now() - startTime;
        firstChunkReceived = true;
        console.log(`[OpenRouter] ${request.model} TTFT: ${ttftMs}ms`);
      }
      
      const delta = chunk.choices[0]?.delta?.content || "";
      content += delta;
    }
    
    // Estimate tokens (streaming doesn't provide usage in chunks)
    const inputTokens = Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    
    const totalTimeMs = Date.now() - startTime;
    const tokensPerSecond = totalTimeMs > 0 ? Math.round((outputTokens / (totalTimeMs / 1000))) : 0;
    
    console.log(`[OpenRouter] Model: ${request.model}, TTFT: ${ttftMs}ms, Total: ${totalTimeMs}ms, tokens: ${inputTokens}/${outputTokens}, throughput: ${tokensPerSecond} tok/s`);

    return {
      content,
      inputTokens,
      outputTokens,
      responseTimeMs: ttftMs,
      totalTimeMs,
      tokensPerSecond,
    };
  } catch (error: any) {
    console.error("OpenRouter API error:", error);
    
    if (error.message?.includes("timed out") || error.message?.includes("timeout")) {
      throw new Error("⏱️ Response timed out (query too complex)");
    }
    
    throw new Error(`Failed to get OpenRouter response: ${error.message}`);
  }
}

export const KIMI_K2_MODEL_ID = "moonshotai/kimi-k2";
