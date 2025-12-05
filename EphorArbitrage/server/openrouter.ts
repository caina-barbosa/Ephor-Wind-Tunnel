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
  // Using Replit's AI Integrations service for OpenRouter access
  const baseURL = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  
  if (!baseURL || !apiKey) {
    throw new Error("Replit AI Integration for OpenRouter not configured");
  }

  try {
    const timeoutMs = request.timeoutMs || 90000;
    const startTime = Date.now();
    
    const client = new OpenAI({
      baseURL: baseURL,
      apiKey: apiKey,
      timeout: timeoutMs,
    });

    // For Qwen3 models, disable thinking mode by appending /no_think to prompt
    // Qwen3 in thinking mode returns empty content and puts response in reasoning field
    const isQwen3 = request.model.includes('qwen3');
    const messages = isQwen3 
      ? request.messages.map((m, i) => 
          i === request.messages.length - 1 && m.role === 'user'
            ? { ...m, content: m.content + ' /no_think' }
            : m
        )
      : request.messages;
    
    // Check if this is a search-enabled model (:online suffix)
    const isSearchModel = request.model.endsWith(':online');
    
    // Use streaming to measure TTFT (Time to First Token)
    // Add provider preferences to optimize for lowest latency
    const stream = await client.chat.completions.create({
      model: request.model,
      messages: messages,
      max_tokens: request.maxTokens || 4096,
      stream: true,
      // @ts-ignore - OpenRouter-specific parameter for provider selection
      provider: {
        order: ["Latency"],      // Prioritize fastest providers
        allow_fallbacks: true    // Fall back if preferred provider unavailable
      }
    } as any);

    let ttftMs = 0;
    let content = "";
    let firstChunkReceived = false;
    let toolCallContent = ""; // Capture tool call outputs for :online models
    
    for await (const chunk of stream) {
      if (!firstChunkReceived) {
        ttftMs = Date.now() - startTime;
        firstChunkReceived = true;
        console.log(`[OpenRouter] ${request.model} TTFT: ${ttftMs}ms`);
      }
      
      // Primary: regular content delta
      const delta = chunk.choices[0]?.delta?.content || "";
      content += delta;
      
      // For :online search models, also check for tool call outputs
      // Some models return search results via tool_calls instead of content
      if (isSearchModel && chunk.choices[0]?.delta) {
        const deltaAny = chunk.choices[0].delta as any;
        
        // Check for tool call output text (some models use this for search results)
        if (deltaAny.tool_calls) {
          for (const tc of deltaAny.tool_calls) {
            if (tc.output_text) {
              toolCallContent += tc.output_text;
            }
            // Also check function arguments (some models embed response here)
            if (tc.function?.arguments) {
              try {
                const args = JSON.parse(tc.function.arguments);
                if (args.response) toolCallContent += args.response;
                if (args.content) toolCallContent += args.content;
              } catch {}
            }
          }
        }
        
        // Check message-level content as fallback
        if (deltaAny.message?.content) {
          toolCallContent += deltaAny.message.content;
        }
      }
    }
    
    // For :online models, prefer tool call content if main content is empty
    if (isSearchModel && !content.trim() && toolCallContent.trim()) {
      console.log(`[OpenRouter] ${request.model}: Using tool call content (${toolCallContent.length} chars)`);
      content = toolCallContent;
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
export const QWEN3_14B_MODEL_ID = "qwen/qwen3-14b";
