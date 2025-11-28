import OpenAI from "openai";
import type { ChatMessage, ChatCompletionResult } from "./types";

export interface GroqChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

export async function createGroqChatCompletion(
  request: GroqChatCompletionRequest
): Promise<ChatCompletionResult> {
  const groqApiKey = process.env.GROQ_API_KEY;
  
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  try {
    const timeoutMs = request.timeoutMs || 90000;
    const startTime = Date.now();
    
    const client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: groqApiKey,
      timeout: timeoutMs,
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
        console.log(`[Groq] TTFT: ${ttftMs}ms`);
      }
      
      const delta = chunk.choices[0]?.delta?.content || "";
      content += delta;
    }
    
    // Estimate tokens (Groq streaming doesn't provide usage in chunks)
    const inputTokens = Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    
    const totalTimeMs = Date.now() - startTime;
    const tokensPerSecond = totalTimeMs > 0 ? Math.round((outputTokens / (totalTimeMs / 1000))) : 0;
    
    console.log(`[Groq] TTFT: ${ttftMs}ms, Total: ${totalTimeMs}ms, tokens: ${inputTokens}/${outputTokens}, throughput: ${tokensPerSecond} tok/s`);

    return {
      content,
      inputTokens,
      outputTokens,
      responseTimeMs: ttftMs,
      totalTimeMs,
      tokensPerSecond,
    };
  } catch (error: any) {
    console.error("Groq API error:", error);
    
    if (error.message?.includes("timed out") || error.message?.includes("timeout")) {
      throw new Error("⏱️ Response timed out (query too complex)");
    }
    
    throw new Error(`Failed to get Groq response: ${error.message}`);
  }
}

export const GROQ_MODEL_ID = "llama-3.3-70b-versatile";
