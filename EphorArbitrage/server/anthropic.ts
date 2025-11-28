import type { ChatMessage, ChatCompletionResult } from "./types";

export interface AnthropicChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

export async function createAnthropicChatCompletion(
  request: AnthropicChatCompletionRequest
): Promise<ChatCompletionResult> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const endpoint = "https://api.anthropic.com/v1/messages";
  console.log(`[Anthropic] Streaming API call to: ${endpoint}`);
  console.log(`[Anthropic] Model: ${request.model}`);

  try {
    const timeoutMs = request.timeoutMs || 90000;
    const startTime = Date.now();
    
    const anthropicMessages = request.messages.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        messages: anthropicMessages,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Anthropic] API error: ${response.status} - ${errorText}`);
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let ttftMs = 0;
    let content = "";
    let firstChunkReceived = false;
    let inputTokens = 0;
    let outputTokens = 0;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          
          try {
            const parsed = JSON.parse(data);
            
            // Capture TTFT on first content
            if (!firstChunkReceived && parsed.type === "content_block_delta") {
              ttftMs = Date.now() - startTime;
              firstChunkReceived = true;
              console.log(`[Anthropic] TTFT: ${ttftMs}ms`);
            }
            
            // Collect content
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              content += parsed.delta.text;
            }
            
            // Get usage from message_delta
            if (parsed.type === "message_delta" && parsed.usage) {
              outputTokens = parsed.usage.output_tokens || 0;
            }
            
            // Get input tokens from message_start
            if (parsed.type === "message_start" && parsed.message?.usage) {
              inputTokens = parsed.message.usage.input_tokens || 0;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    const totalTimeMs = Date.now() - startTime;
    const tokensPerSecond = totalTimeMs > 0 ? Math.round((outputTokens / (totalTimeMs / 1000))) : 0;
    
    console.log(`[Anthropic] TTFT: ${ttftMs}ms, Total: ${totalTimeMs}ms, tokens: ${inputTokens}/${outputTokens}, throughput: ${tokensPerSecond} tok/s`);

    return {
      content,
      inputTokens,
      outputTokens,
      responseTimeMs: ttftMs,
      totalTimeMs,
      tokensPerSecond,
    };
  } catch (error: any) {
    console.error("[Anthropic] API error:", error.message);
    
    if (error.name === "AbortError" || error.message?.includes("timed out") || error.message?.includes("timeout")) {
      throw new Error("⏱️ Response timed out (query too complex)");
    }
    
    throw new Error(`Failed to get Anthropic response: ${error.message}`);
  }
}

export const ANTHROPIC_MODEL_ID = "claude-sonnet-4-5-20250929";
