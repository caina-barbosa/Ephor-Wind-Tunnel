import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { ChatMessage, ChatCompletionResult } from "./types";
import { createGroqChatCompletion, GROQ_MODEL_ID } from "./groq";
import { createCerebrasChatCompletion, CEREBRAS_MODEL_ID } from "./cerebras";
import { createDeepSeekChatCompletion, DEEPSEEK_MODEL_ID } from "./deepseek";
import { createMiniMaxChatCompletion, MINIMAX_MODEL_ID } from "./minimax";
import { createAnthropicChatCompletion, ANTHROPIC_MODEL_ID } from "./anthropic";
import { createOpenRouterChatCompletion, KIMI_K2_MODEL_ID } from "./openrouter";
import { 
  createTogetherChatCompletion, 
  TOGETHER_QWEN_MODEL_ID, 
  TOGETHER_GLM_MODEL_ID,
  TOGETHER_LLAMA_3B_MODEL_ID,
  TOGETHER_QWEN_7B_MODEL_ID,
  TOGETHER_DEEPSEEK_R1_DISTILL_70B_MODEL_ID,
  TOGETHER_DEEPSEEK_R1_MODEL_ID,
  TOGETHER_QWQ_32B_MODEL_ID
} from "./together";
import { insertChatSchema, insertMessageSchema, calculateCost, calculateClaudeCost } from "@shared/schema";
import { routeQuery, logRoutingDecision, type RoutingDecision } from "./auto-router";
import OpenAI from "openai";

const CLAUDE_MODEL_ID = "anthropic/claude-sonnet-4.5";
const GROQ_MODEL_SELECTOR_ID = "meta-llama/llama-4-maverick:groq";
const CEREBRAS_MODEL_SELECTOR_ID = "meta-llama/llama-3.3-70b-instruct:cerebras";
const TOGETHER_LLAMA4_MAVERICK_SELECTOR_ID = "together/llama-4-maverick-17b";
const DEEPSEEK_MODEL_SELECTOR_ID = "deepseek/deepseek-chat";
const MINIMAX_MODEL_SELECTOR_ID = "minimax/minimax-m2";
const KIMI_K2_MODEL_SELECTOR_ID = "moonshotai/kimi-k2";
const QWEN_72B_MODEL_SELECTOR_ID = "qwen/qwen-2.5-72b-instruct";
const GLM_4_32B_MODEL_SELECTOR_ID = "z-ai/glm-4-32b";
const TOGETHER_LLAMA_3B_SELECTOR_ID = "together/llama-3.2-3b-instruct-turbo";
const TOGETHER_QWEN_7B_SELECTOR_ID = "together/qwen-2.5-7b-instruct-turbo";
const TOGETHER_DEEPSEEK_R1_DISTILL_70B_SELECTOR_ID = "together/deepseek-r1-distill-llama-70b";
const TOGETHER_DEEPSEEK_R1_SELECTOR_ID = "together/deepseek-r1";
const TOGETHER_QWQ_32B_SELECTOR_ID = "together/qwq-32b";
const TOGETHER_QWEN3_4B_SELECTOR_ID = "together/Qwen/Qwen3-4B";
const TOGETHER_QWEN3_A3B_SELECTOR_ID = "together/Qwen/Qwen3-Next-80B-A3B-Instruct";
const OPENROUTER_QWEN25_3B_SELECTOR_ID = "openrouter/qwen/qwen2.5-vl-3b-instruct";

interface UnifiedChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

async function getModelCompletion(request: UnifiedChatRequest): Promise<ChatCompletionResult> {
  if (request.model === CLAUDE_MODEL_ID) {
    console.log("[API] Using direct Anthropic API for Claude Sonnet 4.5");
    return createAnthropicChatCompletion({
      model: ANTHROPIC_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === GROQ_MODEL_SELECTOR_ID) {
    console.log("[API] Using direct Groq API for Llama 4 Maverick");
    return createGroqChatCompletion({
      model: GROQ_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === CEREBRAS_MODEL_SELECTOR_ID) {
    console.log("[API] Using direct Cerebras API for Llama 3.3 70B");
    return createCerebrasChatCompletion({
      model: CEREBRAS_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === TOGETHER_LLAMA4_MAVERICK_SELECTOR_ID) {
    console.log("[API] Using Together AI for Llama 4 Maverick 17B");
    return createTogetherChatCompletion({
      model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === DEEPSEEK_MODEL_SELECTOR_ID) {
    console.log("[API] Using direct DeepSeek API for DeepSeek-V3");
    return createDeepSeekChatCompletion({
      model: DEEPSEEK_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === MINIMAX_MODEL_SELECTOR_ID) {
    console.log("[API] Using direct MiniMax API for MiniMax M2");
    return createMiniMaxChatCompletion({
      model: MINIMAX_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === KIMI_K2_MODEL_SELECTOR_ID) {
    console.log("[API] Using OpenRouter for Kimi K2");
    return createOpenRouterChatCompletion({
      model: KIMI_K2_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === QWEN_72B_MODEL_SELECTOR_ID) {
    console.log("[API] Using Together AI for Qwen 2.5 72B Turbo");
    return createTogetherChatCompletion({
      model: TOGETHER_QWEN_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === GLM_4_32B_MODEL_SELECTOR_ID) {
    console.log("[API] Using Together AI for GLM-4.6");
    return createTogetherChatCompletion({
      model: TOGETHER_GLM_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === TOGETHER_LLAMA_3B_SELECTOR_ID) {
    console.log("[API] Using Together AI for Llama 3.2 3B");
    return createTogetherChatCompletion({
      model: TOGETHER_LLAMA_3B_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === TOGETHER_QWEN_7B_SELECTOR_ID) {
    console.log("[API] Using Together AI for Qwen 2.5 7B Turbo");
    return createTogetherChatCompletion({
      model: TOGETHER_QWEN_7B_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  
  if (request.model === TOGETHER_DEEPSEEK_R1_DISTILL_70B_SELECTOR_ID) {
    console.log("[API] Using Together AI for DeepSeek R1 Distill 70B");
    return createTogetherChatCompletion({
      model: TOGETHER_DEEPSEEK_R1_DISTILL_70B_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === TOGETHER_DEEPSEEK_R1_SELECTOR_ID) {
    console.log("[API] Using Together AI for DeepSeek R1");
    return createTogetherChatCompletion({
      model: TOGETHER_DEEPSEEK_R1_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === TOGETHER_QWQ_32B_SELECTOR_ID) {
    console.log("[API] Using Together AI for QwQ 32B");
    return createTogetherChatCompletion({
      model: TOGETHER_QWQ_32B_MODEL_ID,
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === TOGETHER_QWEN3_4B_SELECTOR_ID) {
    console.log("[API] Using Together AI for Qwen3-4B");
    return createTogetherChatCompletion({
      model: "Qwen/Qwen3-4B",
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === TOGETHER_QWEN3_A3B_SELECTOR_ID) {
    console.log("[API] Using Together AI for Qwen3-Next-80B-A3B");
    return createTogetherChatCompletion({
      model: "Qwen/Qwen3-Next-80B-A3B-Instruct",
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  if (request.model === OPENROUTER_QWEN25_3B_SELECTOR_ID) {
    console.log("[API] Using OpenRouter for Qwen2.5-3B");
    return createOpenRouterChatCompletion({
      model: "qwen/qwen2.5-vl-3b-instruct:free",
      messages: request.messages,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    });
  }
  
  throw new Error(`Unknown model: ${request.model}`);
}

// Model ID to display name mapping
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "anthropic/claude-sonnet-4.5": "Claude Sonnet 4.5",
  "meta-llama/llama-3.3-70b-instruct:cerebras": "Cerebras: Llama 3.3 70B",
  "meta-llama/llama-4-maverick:groq": "Groq: Llama 4 Maverick",
  "deepseek/deepseek-chat": "DeepSeek-V3",
  "minimax/minimax-m2": "MiniMax M2",
  "moonshotai/kimi-k2": "Kimi K2 (Moonshot)",
  "qwen/qwen-2.5-72b-instruct": "Qwen 2.5 72B (Alibaba)",
  "z-ai/glm-4-32b": "GLM-4.6 (Zhipu)",
  "together/qwen-2.5-3b-instruct": "Qwen 2.5 3B (3B)",
  "together/qwen-2.5-7b-instruct-turbo": "Qwen 2.5 7B Turbo (7B)",
  "together/llama-4-maverick-17b": "Llama 4 Maverick 17B (17B)",
  "together/deepseek-r1-distill-llama-70b": "DeepSeek R1 Distill 70B (70B, reasoning)",
  "together/deepseek-r1": "DeepSeek R1 (Frontier, reasoning)",
  "together/qwq-32b": "QwQ 32B (Frontier, reasoning)",
  "together/Qwen/Qwen3-4B": "Qwen3-4B (3B, Chinese)",
  "together/Qwen/Qwen3-Next-80B-A3B-Instruct": "Qwen3-A3B (3B active, Chinese)",
  "openrouter/qwen/qwen2.5-vl-3b-instruct": "Qwen2.5-3B (3B, Chinese)",
};

function getModelDisplayName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] || modelId;
}

// Helper to get streaming client for a model
function getStreamingClient(modelId: string): OpenAI {
  if (modelId === "anthropic/claude-sonnet-4.5") {
    return new OpenAI({
      baseURL: "https://api.anthropic.com/v1",
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultHeaders: { "anthropic-version": "2023-06-01" },
    });
  }
  
  // All Cerebras models (fast inference)
  if (modelId.startsWith("cerebras/") || modelId === "meta-llama/llama-3.3-70b-instruct:cerebras") {
    return new OpenAI({
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: process.env.CEREBRAS_API_KEY,
    });
  }
  
  if (modelId.startsWith("openrouter/")) {
    return new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
    });
  }
  
  // Default: Together AI
  return new OpenAI({
    baseURL: "https://api.together.xyz/v1",
    apiKey: process.env.TOGETHER_API_KEY,
  });
}

// Get the actual model ID to send to the provider
function getActualModelId(modelId: string): string {
  const modelMap: Record<string, string> = {
    "anthropic/claude-sonnet-4.5": "claude-sonnet-4-20250514",
    // Cerebras models (super fast)
    "cerebras/llama-3.1-8b": "llama3.1-8b",
    "cerebras/qwen-3-32b": "qwen-3-32b",
    "cerebras/gpt-oss-120b": "gpt-oss-120b",
    "meta-llama/llama-3.3-70b-instruct:cerebras": "llama-3.3-70b",
    // Together models
    "together/llama-3.2-3b-instruct-turbo": "meta-llama/Llama-3.2-3B-Instruct-Turbo",
    "together/qwen-2.5-7b-instruct-turbo": "Qwen/Qwen2.5-7B-Instruct-Turbo",
    "together/llama-4-maverick-17b": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "together/deepseek-r1-distill-llama-70b": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    "together/deepseek-r1": "deepseek-ai/DeepSeek-R1",
    "together/Qwen/Qwen3-4B": "Qwen/Qwen3-4B",
    "together/Qwen/Qwen3-Next-80B-A3B-Instruct": "Qwen/Qwen3-Next-80B-A3B-Instruct",
    "together/Qwen/Qwen2.5-72B-Instruct-Turbo": "Qwen/Qwen2.5-72B-Instruct-Turbo",
    // OpenRouter
    "openrouter/qwen/qwen3-14b": "qwen/qwen3-14b",
    "openrouter/moonshotai/kimi-k2-instruct": "moonshotai/kimi-k2-instruct",
    "openrouter/qwen/qwen3-4b": "qwen/qwen3-4b",
    "openrouter/qwen/qwen3-4b:free": "qwen/qwen3-4b:free",
    "openrouter/qwen/qwen3-30b-a3b": "qwen/qwen3-30b-a3b",
    "openrouter/qwen/qwen3-8b": "qwen/qwen3-8b",
    "openrouter/deepseek/deepseek-r1-distill-qwen-7b": "deepseek/deepseek-r1-distill-qwen-7b",
    "openrouter/deepseek/deepseek-r1-distill-qwen-14b": "deepseek/deepseek-r1-distill-qwen-14b",
    "openrouter/qwen/qwen-2-72b-instruct": "qwen/qwen-2-72b-instruct",
  };
  return modelMap[modelId] || modelId;
}

// Token estimation: rough approximation of ~4 characters = 1 token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Trim conversation history to stay within token limits
// Iteratively drops oldest messages until under limit
function trimConversationHistory(
  messages: ChatMessage[],
  maxTokens: number = 8000
): { trimmedMessages: ChatMessage[]; wasTrimmed: boolean } {
  // Calculate total tokens
  const calculateTokens = (msgs: ChatMessage[]) => 
    msgs.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  
  let totalTokens = calculateTokens(messages);
  
  // If under limit, return as-is
  if (totalTokens <= maxTokens) {
    return { trimmedMessages: messages, wasTrimmed: false };
  }

  // Iteratively drop oldest messages until we're under the limit
  // Always keep at least the most recent message
  let trimmedMessages = [...messages];
  let wasTrimmed = false;
  
  while (calculateTokens(trimmedMessages) > maxTokens && trimmedMessages.length > 1) {
    // Remove oldest message
    trimmedMessages.shift();
    wasTrimmed = true;
  }
  
  // If even the last message exceeds the limit, we still keep it
  // (truncating a single message is beyond scope - handled by each direct API)
  return { trimmedMessages, wasTrimmed };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all chats
  app.get("/api/chats", async (_req, res) => {
    try {
      const chats = await storage.getChats();
      res.json(chats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new chat
  app.post("/api/chats", async (req, res) => {
    try {
      const validatedData = insertChatSchema.parse(req.body);
      const chat = await storage.createChat(validatedData);
      res.json(chat);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update chat model
  app.patch("/api/chats/:chatId/model", async (req, res) => {
    try {
      const { chatId } = req.params;
      const { modelId } = req.body;

      if (!modelId || typeof modelId !== "string") {
        return res.status(400).json({ error: "Model ID is required" });
      }

      const chat = await storage.updateChatModel(chatId, modelId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      res.json(chat);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a chat
  app.delete("/api/chats/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      console.log(`[DELETE] Deleting chat: ${chatId}`);
      const deleted = await storage.deleteChat(chatId);
      
      if (!deleted) {
        console.log(`[DELETE] Chat not found: ${chatId}`);
        return res.status(404).json({ error: "Chat not found" });
      }

      console.log(`[DELETE] Successfully deleted chat: ${chatId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[DELETE] Error deleting chat:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get messages for a chat
  app.get("/api/chats/:chatId/messages", async (req, res) => {
    try {
      const { chatId } = req.params;
      const messages = await storage.getMessages(chatId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add a message to a chat
  app.post("/api/chats/:chatId/messages", async (req, res) => {
    try {
      const { chatId } = req.params;
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        chatId,
      });
      const message = await storage.createMessage(validatedData);
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Send a message and get AI response
  app.post("/api/chats/:chatId/chat", async (req, res) => {
    try {
      const { chatId } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const chat = await storage.getChat(chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Get chat history
      const messages = await storage.getMessages(chatId);
      
      // Build conversation history for AI (including new user message)
      const fullConversationHistory = [
        ...messages.map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        })),
        { role: "user" as const, content: message },
      ];

      // Apply smart trimming to stay within token limits
      const { trimmedMessages: conversationHistory, wasTrimmed } = trimConversationHistory(fullConversationHistory);

      // Save user message to database (full history always saved)
      await storage.createMessage({
        chatId,
        role: "user",
        content: message,
      });

      // Update chat title with first user message if still "New Chat"
      // Do this BEFORE API call to ensure persistence even if AI call fails
      if (chat.title === "New Chat" && messages.length === 0) {
        const truncatedTitle = message.slice(0, 50);
        await storage.updateChatTitle(chatId, truncatedTitle);
      }

      // Check if "All Models" is selected
      if (chat.modelId === "all-models") {
        // Call all 8 models in parallel
        const modelCalls = [
          { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
          { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Cerebras: Llama 3.3 70B" },
          { id: "meta-llama/llama-4-maverick:groq", name: "Groq: Llama 4 Maverick" },
          { id: "deepseek/deepseek-chat", name: "DeepSeek-V3" },
          { id: "minimax/minimax-m2", name: "MiniMax M2" },
          { id: "moonshotai/kimi-k2", name: "Kimi K2 (Moonshot)" },
          { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B (Alibaba)" },
          { id: "z-ai/glm-4-32b", name: "GLM-4-32B (Zhipu)" },
        ].map(async (model) => {
          try {
            const result = await getModelCompletion({
              model: model.id,
              messages: conversationHistory,
            });
            
            // Calculate costs
            const cost = calculateCost(model.id, result.inputTokens, result.outputTokens);
            const claudeCost = calculateClaudeCost(result.inputTokens, result.outputTokens);
            const saved = claudeCost - cost;
            const savedPercent = claudeCost > 0 ? (saved / claudeCost) * 100 : 0;
            
            return {
              modelId: model.id,
              modelName: model.name,
              content: result.content,
              error: null,
              costStats: {
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                responseTimeMs: result.responseTimeMs,
                totalTimeMs: result.totalTimeMs,
                tokensPerSecond: result.tokensPerSecond,
                cost,
                claudeCost,
                saved,
                savedPercent,
              },
            };
          } catch (error: any) {
            // For timeout errors, show user-friendly message without "Error:" prefix
            const isTimeout = error.message?.includes("timed out") || error.message?.includes("timeout");
            return {
              modelId: model.id,
              modelName: model.name,
              content: isTimeout ? error.message : `Error: ${error.message}`,
              error: error.message,
              costStats: null,
            };
          }
        });

        // Wait for all responses
        const responses = await Promise.all(modelCalls);

        // Save all responses as separate messages (including costStats)
        const savedMessages = await Promise.all(
          responses.map((response) =>
            storage.createMessage({
              chatId,
              role: "assistant",
              content: response.content,
              modelName: response.modelName,
              costStats: response.costStats ?? undefined,
            })
          )
        );

        res.json({ messages: savedMessages, wasTrimmed });
      } else if (chat.modelId === "auto-router") {
        // Auto Router mode - intelligently route based on query complexity
        const routingDecision = routeQuery(message);
        
        console.log(`[Auto Router] Routing to: ${routingDecision.modelName}`);
        
        const result = await getModelCompletion({
          model: routingDecision.modelId,
          messages: conversationHistory,
        });

        // Log the routing decision with TTFT
        logRoutingDecision(message, routingDecision, result.responseTimeMs);

        // Calculate costs
        const cost = calculateCost(routingDecision.modelId, result.inputTokens, result.outputTokens);
        const claudeCost = calculateClaudeCost(result.inputTokens, result.outputTokens);
        const saved = claudeCost - cost;
        const savedPercent = claudeCost > 0 ? (saved / claudeCost) * 100 : 0;

        // Save AI response with routing info in costStats
        const costStats = {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          responseTimeMs: result.responseTimeMs,
          totalTimeMs: result.totalTimeMs,
          tokensPerSecond: result.tokensPerSecond,
          cost,
          claudeCost,
          saved,
          savedPercent,
          routingInfo: {
            route: routingDecision.route,
            routeLabel: routingDecision.routeLabel,
            routeIcon: routingDecision.routeIcon,
            score: routingDecision.score,
            signalsDetected: routingDecision.signalsDetected,
            modelName: routingDecision.modelName,
          },
        };
        
        const aiMessage = await storage.createMessage({
          chatId,
          role: "assistant",
          content: result.content,
          modelName: routingDecision.modelName,
          costStats,
        });

        // Return message with routing info
        res.json({ 
          message: aiMessage, 
          wasTrimmed,
          routingDecision: {
            route: routingDecision.route,
            routeLabel: routingDecision.routeLabel,
            routeIcon: routingDecision.routeIcon,
            score: routingDecision.score,
            signalsDetected: routingDecision.signalsDetected,
            modelName: routingDecision.modelName,
          }
        });
      } else {
        // Single model response
        const result = await getModelCompletion({
          model: chat.modelId,
          messages: conversationHistory,
        });

        // Calculate costs
        const cost = calculateCost(chat.modelId, result.inputTokens, result.outputTokens);
        const claudeCost = calculateClaudeCost(result.inputTokens, result.outputTokens);
        const saved = claudeCost - cost;
        const savedPercent = claudeCost > 0 ? (saved / claudeCost) * 100 : 0;

        // Save AI response (including costStats)
        const costStats = {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          responseTimeMs: result.responseTimeMs,
          totalTimeMs: result.totalTimeMs,
          tokensPerSecond: result.tokensPerSecond,
          cost,
          claudeCost,
          saved,
          savedPercent,
        };
        
        const aiMessage = await storage.createMessage({
          chatId,
          role: "assistant",
          content: result.content,
          modelName: chat.modelId,
          costStats,
        });

        // Return message with cost stats
        res.json({ 
          message: aiMessage, 
          wasTrimmed 
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Run compete analysis (peer review)
  app.post("/api/chats/:chatId/compete", async (req, res) => {
    try {
      const { chatId } = req.params;
      const { userMessageId } = req.body;

      if (!userMessageId || typeof userMessageId !== "string") {
        return res.status(400).json({ error: "User message ID is required" });
      }

      // Get all messages for this chat
      const allMessages = await storage.getMessages(chatId);
      
      // Debug logging
      console.log(`[Compete] Looking for user message ID: ${userMessageId}`);
      console.log(`[Compete] Total messages in chat: ${allMessages.length}`);
      console.log(`[Compete] Message IDs in chat:`, allMessages.map(m => ({ id: m.id, role: m.role })));
      
      // Find the user message
      const userMessage = allMessages.find((m) => m.id === userMessageId);
      if (!userMessage || userMessage.role !== "user") {
        console.error(`[Compete] User message not found! Requested ID: ${userMessageId}`);
        return res.status(404).json({ error: "User message not found" });
      }

      // Find all assistant responses between this user message and the next user message
      const userMessageIndex = allMessages.indexOf(userMessage);
      const messagesAfterUser = allMessages.slice(userMessageIndex + 1);
      
      // Stop at the next user message (if any)
      const nextUserIndex = messagesAfterUser.findIndex((m) => m.role === "user");
      const relevantMessages = nextUserIndex >= 0 
        ? messagesAfterUser.slice(0, nextUserIndex)
        : messagesAfterUser;
      
      const assistantResponses = relevantMessages.filter((m) => m.role === "assistant");

      // Determine mode: single-model (1 response) or all-models (8 responses)
      const isSingleModelMode = assistantResponses.length === 1;
      const isAllModelsMode = assistantResponses.length === 8;
      
      console.log(`[Compete] Mode detection: ${assistantResponses.length} responses found`);
      console.log(`[Compete] isSingleModelMode: ${isSingleModelMode}, isAllModelsMode: ${isAllModelsMode}`);

      if (!isSingleModelMode && !isAllModelsMode) {
        return res.status(400).json({ 
          error: `Expected 1 response (single model) or 8 responses (all models), found ${assistantResponses.length}` 
        });
      }

      let allResponses: Array<{ 
        content: string; 
        modelId: string; 
        modelName: string; 
        isOriginal: boolean;
        costStats?: {
          inputTokens: number;
          outputTokens: number;
          responseTimeMs: number;
          cost: number;
          claudeCost: number;
          saved: number;
          savedPercent: number;
        } | null;
      }> = [];
      let originalModelId: string | null = null;

      if (isSingleModelMode) {
        // SINGLE MODEL MODE: Query ALL 8 models fresh for complete comparison
        const storedModelName = assistantResponses[0].modelName || "Unknown";

        // Get conversation history up to (but not including) the user message
        const fullHistory = allMessages
          .slice(0, userMessageIndex)
          .map((msg) => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
          }));

        // Add the current user message
        fullHistory.push({
          role: "user",
          content: userMessage.content,
        });

        // Apply smart trimming to stay within token limits
        const { trimmedMessages: conversationHistory } = trimConversationHistory(fullHistory);

        // All 8 models with both ID and human-friendly name
        const allModels = [
          { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
          { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Cerebras: Llama 3.3 70B" },
          { id: "meta-llama/llama-4-maverick:groq", name: "Groq: Llama 4 Maverick" },
          { id: "deepseek/deepseek-chat", name: "DeepSeek-V3" },
          { id: "minimax/minimax-m2", name: "MiniMax M2" },
          { id: "moonshotai/kimi-k2", name: "Kimi K2 (Moonshot)" },
          { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B (Alibaba)" },
          { id: "z-ai/glm-4-32b", name: "GLM-4-32B (Zhipu)" },
        ];

        // Find the original model by matching on name (handles both ID and display name storage)
        const originalModel = allModels.find((m) => 
          m.id === storedModelName || m.name === storedModelName
        );
        originalModelId = originalModel?.name || storedModelName;

        console.log(`[Compete] Single model mode - original model: ${originalModelId}`);

        // Query ALL 8 models fresh for complete cost/speed comparison
        const allModelCalls = allModels.map(async (model) => {
          const isOriginal = model.name === originalModelId || model.id === storedModelName;
          try {
            const result = await getModelCompletion({
              model: model.id,
              messages: conversationHistory,
            });
            
            // Calculate costs
            const cost = calculateCost(model.id, result.inputTokens, result.outputTokens);
            const claudeCost = calculateClaudeCost(result.inputTokens, result.outputTokens);
            const saved = claudeCost - cost;
            const savedPercent = claudeCost > 0 ? (saved / claudeCost) * 100 : 0;
            
            return {
              content: result.content,
              modelId: model.id,
              modelName: model.name,
              isOriginal,
              error: null,
              costStats: {
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                responseTimeMs: result.responseTimeMs,
                totalTimeMs: result.totalTimeMs,
                tokensPerSecond: result.tokensPerSecond,
                cost,
                claudeCost,
                saved,
                savedPercent,
              },
            };
          } catch (error: any) {
            console.error(`[Compete] Error from ${model.name} (${model.id}):`, error.message);
            return {
              content: `Error: ${error.message}`,
              modelId: model.id,
              modelName: model.name,
              isOriginal,
              error: error.message,
              costStats: null,
            };
          }
        });

        const responses = await Promise.all(allModelCalls);
        console.log(`[Compete] Got ${responses.length} responses with costStats:`, 
          responses.map(r => ({ model: r.modelName, hasCostStats: !!r.costStats, ttft: r.costStats?.responseTimeMs })));
        allResponses = responses;
      } else {
        // ALL MODELS MODE: Use existing 8 responses with their costStats
        allResponses = assistantResponses.map((response) => {
          // Parse costStats from stored message (it's stored as JSONB)
          const storedCostStats = response.costStats as any;
          const modelId = response.modelName || "Unknown";
          // Convert model ID to display name for consistency
          const displayName = getModelDisplayName(modelId);
          return {
            content: response.content,
            modelId: modelId,
            modelName: displayName,
            isOriginal: false,
            costStats: storedCostStats || null,
          };
        });
        console.log(`[Compete] ALL MODELS MODE: Loaded ${allResponses.length} responses with costStats:`,
          allResponses.map(r => ({ model: r.modelName, hasCostStats: !!r.costStats, ttft: r.costStats?.responseTimeMs })));
      }

      // Randomize order and create anonymized labels
      const shuffled = [...allResponses].sort(() => Math.random() - 0.5);
      const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
      const anonymizedResponses = shuffled.map((response, index) => ({
        label: labels[index],
        content: response.content,
        modelName: response.modelName,
        isOriginal: response.isOriginal,
        originalIndex: allResponses.indexOf(response),
        costStats: response.costStats,
      }));

      // Create judging prompt for democratic peer review
      const responsesText = anonymizedResponses
        .map((r) => `Response ${r.label}: ${r.content}`)
        .join("\n\n");

      const judgingPrompt = `You are a judge evaluating AI responses. Below are 8 anonymous responses (A, B, C, D, E, F, G, H) to the question: "${userMessage.content}"

${responsesText}

Rank these responses from best (1) to worst (8) based on accuracy and insight.
Respond with ONLY a JSON object: {"rankings": [3,1,5,2,4,6,7,8], "reasoning": "brief explanation"}

The rankings array should contain 8 numbers representing the rank position for responses A, B, C, D, E, F, G, H in that order.`;

      // Send to all 8 models for democratic peer review
      const judgeModels = [
        { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
        { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Cerebras: Llama 3.3 70B" },
        { id: "meta-llama/llama-4-maverick:groq", name: "Groq: Llama 4 Maverick" },
        { id: "deepseek/deepseek-chat", name: "DeepSeek-V3" },
        { id: "minimax/minimax-m2", name: "MiniMax M2" },
        { id: "moonshotai/kimi-k2", name: "Kimi K2 (Moonshot)" },
        { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B (Alibaba)" },
        { id: "z-ai/glm-4-32b", name: "GLM-4-32B (Zhipu)" },
      ];

      console.log("[Compete] Starting democratic peer review with all 8 models");

      const judgingCalls = judgeModels.map(async (model) => {
        try {
          const result = await getModelCompletion({
            model: model.id,
            messages: [{ role: "user", content: judgingPrompt }],
          });

          // Parse JSON from response
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in response");
          }

          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.rankings || !Array.isArray(parsed.rankings) || parsed.rankings.length !== 8) {
            throw new Error("Invalid rankings format");
          }

          return {
            modelName: model.name,
            rankings: parsed.rankings as number[],
            reasoning: parsed.reasoning || "",
            error: null,
          };
        } catch (error: any) {
          console.error(`Error getting judgment from ${model.name}:`, error);
          return {
            modelName: model.name,
            rankings: [4, 4, 4, 4, 4, 4, 4, 4], // Neutral ranking on error
            reasoning: "",
            error: error.message,
          };
        }
      });

      const judgments = await Promise.all(judgingCalls);

      // Calculate average rank for each response (in original order)
      // Lower average rank = better (rank 1 is best)
      const rankedResponses = allResponses.map((response, originalIndex) => {
        // Find which anonymized label this response got
        const anonymized = anonymizedResponses.find((a) => a.originalIndex === originalIndex);
        if (!anonymized) return { 
          modelName: response.modelName || "Unknown", 
          averageRank: 8,
          isOriginal: response.isOriginal,
          content: response.content,
          costStats: response.costStats,
        };

        const labelIndex = labels.indexOf(anonymized.label);
        
        // Collect all rankings for this response from all judges
        const ranks = judgments
          .filter((j) => !j.error)
          .map((j) => j.rankings[labelIndex]);

        const avgRank = ranks.length > 0
          ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length
          : 4.5;

        return {
          modelName: response.modelName || "Unknown",
          averageRank: avgRank,
          isOriginal: response.isOriginal,
          content: response.content,
          costStats: response.costStats,
        };
      });

      // Sort by average rank (lower is better)
      const sortedResults = rankedResponses
        .map((result, index) => ({ ...result, originalIndex: index }))
        .sort((a, b) => a.averageRank - b.averageRank)
        .map((result, index) => ({
          place: index + 1,
          modelName: result.modelName,
          averageRank: Math.round(result.averageRank * 10) / 10,
          isOriginal: result.isOriginal,
          content: result.content,
          costStats: result.costStats,
        }));

      // For single-model mode, find original placement and better responses
      let originalPlacement = null;
      let betterResponses: Array<{ place: number; modelName: string; averageRank: number; content: string }> = [];

      if (isSingleModelMode) {
        const originalResult = sortedResults.find((r) => r.isOriginal);
        if (originalResult) {
          originalPlacement = originalResult.place;
          // Get responses that ranked better than the original
          betterResponses = sortedResults
            .filter((r) => r.place < originalPlacement! && !r.isOriginal)
            .map((r) => ({
              place: r.place,
              modelName: r.modelName,
              averageRank: r.averageRank,
              content: r.content,
            }));
        }
      }

      // Chairman Synthesis - Claude combines insights from all responses
      let chairmanSynthesis: string | null = null;
      try {
        const synthesisPrompt = `You are the Chairman synthesizing a council's collective wisdom.

Original question: ${userMessage.content}

Here are 8 AI responses ranked by democratic peer review (lowest average rank = best):
${sortedResults.map((r, i) => `${i + 1}. ${r.modelName} (avg rank: ${r.averageRank}): ${r.content}`).join('\n\n')}

Peer critiques from the judges:
${judgments.filter(j => !j.error).map(j => `${j.modelName}: ${j.reasoning}`).join('\n')}

Create a final synthesized answer that:
- Incorporates the best insights from top-ranked responses
- Cites which model contributed each key point using brackets: [Model Name]
- Is better than any single response

Format: Natural flowing answer with inline citations like [Cerebras: Llama 3.3 70B].`;

        const synthesisResult = await getModelCompletion({
          model: "anthropic/claude-sonnet-4.5",
          messages: [{ role: "user", content: synthesisPrompt }],
          timeoutMs: 120000, // 120s for chairman synthesis (longer than default)
        });
        chairmanSynthesis = synthesisResult.content;
      } catch (error: any) {
        console.error("Chairman synthesis error:", error);
        chairmanSynthesis = null; // Continue without synthesis if it fails
      }

      // Build the compete results object
      const competeResults = {
        mode: isSingleModelMode ? "single" : "all",
        results: sortedResults.map((r) => ({
          place: r.place,
          modelName: r.modelName,
          averageRank: r.averageRank,
          isOriginal: r.isOriginal,
          costStats: r.costStats,
        })),
        originalPlacement,
        originalModelId,
        betterResponses: betterResponses.map((r) => ({
          place: r.place,
          modelName: r.modelName,
          averageRank: r.averageRank,
          content: r.content,
        })),
        chairmanSynthesis,
        judgments: judgments.map((j) => ({
          modelName: j.modelName,
          reasoning: j.reasoning,
          error: j.error,
        })),
      };

      // Debug: Log the final compete results with costStats
      console.log(`[Compete] Final results with costStats:`, 
        competeResults.results.map((r: any) => ({ 
          model: r.modelName, 
          hasCostStats: !!r.costStats, 
          ttft: r.costStats?.responseTimeMs 
        })));

      // Persist compete results to the user message
      await storage.updateMessageCompeteResults(userMessageId, competeResults);

      res.json(competeResults);
    } catch (error: any) {
      console.error("Compete analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Wind Tunnel: Run a single model with streaming
  app.post("/api/wind-tunnel/stream", async (req, res) => {
    const { modelId, prompt, files } = req.body;

    if (!modelId || typeof modelId !== "string") {
      return res.status(400).json({ error: "Model ID is required" });
    }
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Set up SSE headers with better connection handling
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    console.log(`[Wind Tunnel Stream] Running model: ${modelId}, files: ${files?.length || 0}`);

    try {
      const messages: ChatMessage[] = [{ role: "user", content: prompt }];
      const startTime = Date.now();
      
      // Anthropic with streaming for real-time progress
      if (modelId === "anthropic/claude-sonnet-4.5") {
        console.log("[Wind Tunnel] Claude path - streaming");
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicApiKey) {
          throw new Error("ANTHROPIC_API_KEY not configured");
        }
        
        // Build multimodal content for Claude if there are files
        let messageContent: any = prompt;
        
        if (files && Array.isArray(files) && files.length > 0) {
          const contentParts: any[] = [];
          
          // Add images first
          for (const file of files) {
            if (file.type === 'image' && file.dataUrl) {
              // Extract base64 data from data URL (format: data:image/png;base64,XXXXX)
              const matches = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                const mediaType = matches[1];
                const base64Data = matches[2];
                contentParts.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Data
                  }
                });
                console.log(`[Wind Tunnel] Added image to Claude request: ${file.name} (${mediaType})`);
              }
            } else if (file.type === 'text' && file.textContent) {
              // Add text file content as text block
              contentParts.push({
                type: "text",
                text: `[File: ${file.name}]\n${file.textContent}`
              });
            }
          }
          
          // Add the prompt text last
          contentParts.push({
            type: "text",
            text: prompt
          });
          
          messageContent = contentParts;
        }
        
        const anthropicMessages = [{
          role: "user" as const,
          content: messageContent,
        }];

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 512,
            messages: anthropicMessages,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let content = "";
        let tokenCount = 0;
        let inputTokens = 0;
        let outputTokens = 0;
        let buffer = "";
        let firstTokenTime = 0;

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
                
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  if (firstTokenTime === 0) {
                    firstTokenTime = Date.now() - startTime;
                  }
                  content += parsed.delta.text;
                  tokenCount++;
                  
                  res.write(`data: ${JSON.stringify({ 
                    type: 'token', 
                    content: parsed.delta.text,
                    tokenCount,
                    elapsed: Date.now() - startTime
                  })}\n\n`);
                }
                
                if (parsed.type === "message_delta" && parsed.usage) {
                  outputTokens = parsed.usage.output_tokens || 0;
                }
                if (parsed.type === "message_start" && parsed.message?.usage) {
                  inputTokens = parsed.message.usage.input_tokens || 0;
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        const latency = Date.now() - startTime;
        const cost = calculateCost(modelId, inputTokens, outputTokens);
        
        res.write(`data: ${JSON.stringify({ 
          type: 'complete',
          content,
          inputTokens,
          outputTokens,
          latency,
          cost
        })}\n\n`);
        res.end();
        console.log(`[Wind Tunnel] Claude complete in ${latency}ms - ${outputTokens} tokens`);
        return;
      }
      
      // Stream using OpenAI-compatible clients (Together, Cerebras, OpenRouter)
      const client = getStreamingClient(modelId);
      const actualModelId = getActualModelId(modelId);
      
      // Build prompt with text files included (non-Claude models mostly don't support vision)
      let enhancedPrompt = prompt;
      let hasImages = false;
      
      if (files && Array.isArray(files) && files.length > 0) {
        const textParts: string[] = [];
        
        for (const file of files) {
          if (file.type === 'text' && file.textContent) {
            textParts.push(`[File: ${file.name}]\n${file.textContent}\n`);
          } else if (file.type === 'image') {
            hasImages = true;
          }
        }
        
        if (textParts.length > 0) {
          enhancedPrompt = textParts.join('\n') + '\n' + prompt;
        }
        
        if (hasImages) {
          console.log(`[Wind Tunnel] Warning: ${modelId} does not support vision - images will be ignored`);
          enhancedPrompt = `[Note: ${files.filter(f => f.type === 'image').length} image(s) were uploaded but this model does not support vision]\n\n` + enhancedPrompt;
        }
      }
      
      // Update messages with enhanced prompt
      const enhancedMessages: ChatMessage[] = [{ role: "user", content: enhancedPrompt }];
      
      // For Qwen3 models, disable thinking mode by appending /no_think to prompt
      // Qwen3 in thinking mode returns empty content and puts response in reasoning field
      const isQwen3 = actualModelId.includes('qwen3');
      const streamMessages = isQwen3 
        ? enhancedMessages.map((m, i) => 
            i === enhancedMessages.length - 1 && m.role === 'user'
              ? { ...m, content: m.content + ' /no_think' }
              : m
          )
        : enhancedMessages;
      
      const stream = await client.chat.completions.create({
        model: actualModelId,
        messages: streamMessages,
        max_tokens: 1024,
        stream: true,
      });

      let content = "";
      let tokenCount = 0;
      let firstTokenTime = 0;
      
      for await (const chunk of stream) {
        if (firstTokenTime === 0) {
          firstTokenTime = Date.now() - startTime;
        }
        
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          content += delta;
          tokenCount += 1;
          
          // Send progress update
          res.write(`data: ${JSON.stringify({ 
            type: 'token', 
            content: delta,
            tokenCount,
            elapsed: Date.now() - startTime
          })}\n\n`);
        }
      }

      const latency = Date.now() - startTime;
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(content.length / 4);
      const cost = calculateCost(modelId, inputTokens, outputTokens);

      // Send final complete message
      res.write(`data: ${JSON.stringify({ 
        type: 'complete',
        content,
        inputTokens,
        outputTokens,
        latency,
        cost
      })}\n\n`);
      
      res.end();
      console.log(`[Wind Tunnel Stream] ${modelId} completed in ${latency}ms`);
      
    } catch (error: any) {
      console.error(`[Wind Tunnel Stream] Error:`, error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  });

  // Wind Tunnel: Run a single model (non-streaming fallback)
  app.post("/api/wind-tunnel/run", async (req, res) => {
    try {
      const { modelId, prompt } = req.body;

      if (!modelId || typeof modelId !== "string") {
        return res.status(400).json({ error: "Model ID is required" });
      }
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      console.log(`[Wind Tunnel] Running model: ${modelId}`);

      const messages: ChatMessage[] = [
        { role: "user", content: prompt }
      ];

      const startTime = Date.now();
      const result = await getModelCompletion({
        model: modelId,
        messages,
        maxTokens: 1024,
        timeoutMs: 60000,
      });
      const latency = Date.now() - startTime;

      // Calculate cost
      const cost = calculateCost(modelId, result.inputTokens, result.outputTokens);

      console.log(`[Wind Tunnel] Model ${modelId} responded in ${latency}ms, cost: $${cost.toFixed(6)}`);

      res.json({
        content: result.content,
        modelId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latency,
        cost,
      });
    } catch (error: any) {
      console.error(`[Wind Tunnel] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // BENCHMARK LIBRARY API
  // ============================================

  // Get all benchmarks
  app.get("/api/benchmarks", async (_req, res) => {
    try {
      const benchmarkList = await storage.getBenchmarks();
      res.json(benchmarkList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new benchmark
  app.post("/api/benchmarks", async (req, res) => {
    try {
      const { name, description, prompt } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Name is required" });
      }
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const benchmark = await storage.createBenchmark({
        name,
        description: description || null,
        prompt,
      });

      console.log(`[Benchmark] Created: ${benchmark.name}`);
      res.json(benchmark);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get a single benchmark with its runs
  app.get("/api/benchmarks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const benchmark = await storage.getBenchmark(id);

      if (!benchmark) {
        return res.status(404).json({ error: "Benchmark not found" });
      }

      const runs = await storage.getBenchmarkRuns(id);

      res.json({ benchmark, runs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a benchmark
  app.delete("/api/benchmarks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBenchmark(id);

      if (!deleted) {
        return res.status(404).json({ error: "Benchmark not found" });
      }

      console.log(`[Benchmark] Deleted: ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single benchmark run
  app.get("/api/benchmark-runs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const run = await storage.getBenchmarkRun(id);

      if (!run) {
        return res.status(404).json({ error: "Benchmark run not found" });
      }

      res.json(run);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Link a run to a benchmark (for saving ad-hoc runs)
  app.post("/api/benchmark-runs/:runId/link", async (req, res) => {
    try {
      const { runId } = req.params;
      const { benchmarkId } = req.body;

      if (!benchmarkId) {
        return res.status(400).json({ error: "Benchmark ID is required" });
      }

      const run = await storage.updateBenchmarkRun(runId, { benchmarkId });

      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }

      console.log(`[Benchmark] Linked run ${runId} to benchmark ${benchmarkId}`);
      res.json(run);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // PUBLIC LEADERBOARD API
  // ============================================

  // Get all leaderboard entries (newest first)
  app.get("/api/leaderboard", async (_req, res) => {
    try {
      const entries = await storage.getLeaderboardEntries();
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Submit a new leaderboard entry
  app.post("/api/leaderboard", async (req, res) => {
    try {
      const { displayName, prompt, recommendedModel, settings, results } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const entry = await storage.createLeaderboardEntry({
        displayName: displayName || null,
        prompt,
        recommendedModel: recommendedModel || null,
        settings: settings || null,
        results: results || null,
      });

      console.log(`[Leaderboard] New entry from: ${displayName || "Anonymous"}`);
      res.json(entry);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
