import OpenAI from "openai";
import type { ChatMessage, ChatCompletionResult } from "./types";

export interface TogetherChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

export async function createTogetherChatCompletion(
  request: TogetherChatCompletionRequest
): Promise<ChatCompletionResult> {
  const togetherApiKey = process.env.TOGETHER_API_KEY;
  
  if (!togetherApiKey) {
    throw new Error("TOGETHER_API_KEY not configured");
  }

  try {
    const timeoutMs = request.timeoutMs || 90000;
    const startTime = Date.now();
    
    const client = new OpenAI({
      baseURL: "https://api.together.xyz/v1",
      apiKey: togetherApiKey,
      timeout: timeoutMs,
    });

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
        console.log(`[Together] ${request.model} TTFT: ${ttftMs}ms`);
      }
      
      const delta = chunk.choices[0]?.delta?.content || "";
      content += delta;
    }
    
    console.log(`[Together] ${request.model} content length: ${content.length} chars`);
    
    const inputTokens = Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    
    const totalTimeMs = Date.now() - startTime;
    const tokensPerSecond = totalTimeMs > 0 ? Math.round((outputTokens / (totalTimeMs / 1000))) : 0;
    
    console.log(`[Together] Model: ${request.model}, TTFT: ${ttftMs}ms, Total: ${totalTimeMs}ms, tokens: ${inputTokens}/${outputTokens}, throughput: ${tokensPerSecond} tok/s`);

    return {
      content,
      inputTokens,
      outputTokens,
      responseTimeMs: ttftMs,
      totalTimeMs,
      tokensPerSecond,
    };
  } catch (error: any) {
    console.error("Together API error:", error);
    
    if (error.message?.includes("timed out") || error.message?.includes("timeout")) {
      throw new Error("⏱️ Response timed out (query too complex)");
    }
    
    throw new Error(`Failed to get Together response: ${error.message}`);
  }
}

export const TOGETHER_QWEN_MODEL_ID = "Qwen/Qwen2.5-72B-Instruct-Turbo";
export const TOGETHER_GLM_MODEL_ID = "zai-org/GLM-4.6";
export const TOGETHER_QWEN_3B_MODEL_ID = "Qwen/Qwen2.5-3B-Instruct-Turbo";
export const TOGETHER_QWEN_7B_MODEL_ID = "Qwen/Qwen2.5-7B-Instruct-Turbo";
export const TOGETHER_QWEN_14B_MODEL_ID = "Qwen/Qwen2.5-14B-Instruct-Turbo";
export const TOGETHER_DEEPSEEK_V3_THINKING_MODEL_ID = "deepseek-ai/DeepSeek-V3-0324";
export const TOGETHER_DEEPSEEK_R1_DISTILL_70B_MODEL_ID = "deepseek-ai/DeepSeek-R1-Distill-Llama-70B";
export const TOGETHER_DEEPSEEK_R1_MODEL_ID = "deepseek-ai/DeepSeek-R1";
export const TOGETHER_QWQ_32B_MODEL_ID = "Qwen/QwQ-32B";
