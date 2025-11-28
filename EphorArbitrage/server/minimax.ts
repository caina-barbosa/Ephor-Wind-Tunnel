import type { ChatMessage, ChatCompletionResult } from "./types";

export interface MiniMaxChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

export async function createMiniMaxChatCompletion(
  request: MiniMaxChatCompletionRequest
): Promise<ChatCompletionResult> {
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  const minimaxGroupId = process.env.MINIMAX_GROUP_ID;
  
  if (!minimaxApiKey) {
    throw new Error("MINIMAX_API_KEY not configured");
  }
  
  if (!minimaxGroupId) {
    throw new Error("MINIMAX_GROUP_ID not configured");
  }

  const endpoint = `https://api.minimax.io/v1/text/chatcompletion_v2?GroupId=${minimaxGroupId}`;
  console.log(`[MiniMax] Streaming API call to: ${endpoint}`);
  console.log(`[MiniMax] Model: ${request.model}`);

  try {
    const timeoutMs = request.timeoutMs || 90000;
    const startTime = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${minimaxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens || 4096,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let ttftMs = 0;
    let content = "";
    let firstChunkReceived = false;
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
            if (!firstChunkReceived) {
              // Check for content in various MiniMax formats
              const deltaContent = parsed.choices?.[0]?.delta?.content || parsed.delta?.content;
              if (deltaContent) {
                ttftMs = Date.now() - startTime;
                firstChunkReceived = true;
                console.log(`[MiniMax] TTFT: ${ttftMs}ms`);
              }
            }
            
            // Collect content from various formats
            const deltaContent = parsed.choices?.[0]?.delta?.content || parsed.delta?.content;
            if (deltaContent) {
              content += deltaContent;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    // Estimate tokens
    const inputTokens = Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    
    const totalTimeMs = Date.now() - startTime;
    const tokensPerSecond = totalTimeMs > 0 ? Math.round((outputTokens / (totalTimeMs / 1000))) : 0;
    
    console.log(`[MiniMax] TTFT: ${ttftMs}ms, Total: ${totalTimeMs}ms, tokens: ${inputTokens}/${outputTokens}, throughput: ${tokensPerSecond} tok/s`);

    return {
      content,
      inputTokens,
      outputTokens,
      responseTimeMs: ttftMs,
      totalTimeMs,
      tokensPerSecond,
    };
  } catch (error: any) {
    console.error("MiniMax API error:", error);
    
    if (error.name === "AbortError" || error.message?.includes("timed out") || error.message?.includes("timeout")) {
      throw new Error("⏱️ Response timed out (query too complex)");
    }
    
    throw new Error(`Failed to get MiniMax response: ${error.message}`);
  }
}

export const MINIMAX_MODEL_ID = "MiniMax-Text-01";
