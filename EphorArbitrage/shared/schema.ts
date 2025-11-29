import { sql, relations } from "drizzle-orm";
import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  modelId: text("model_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Routing info for auto-router mode
export interface RoutingInfo {
  route: "ultra-fast" | "fast" | "premium" | "code";
  routeLabel: string;
  routeIcon: string;
  score: number;
  signalsDetected: string[];
  modelName: string;
}

// Cost stats interface for type safety
export interface CostStats {
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;
  totalTimeMs?: number;
  tokensPerSecond?: number;
  cost: number;
  claudeCost: number;
  saved: number;
  savedPercent: number;
  routingInfo?: RoutingInfo;
}

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  modelName: text("model_name"),
  competeResults: jsonb("compete_results"),
  costStats: jsonb("cost_stats").$type<CostStats>(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
  competeResults: true,
});

export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chats.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ============================================
// BENCHMARK TABLES (Model Council Feature)
// ============================================

// Saved benchmark prompts that can be rerun
export const benchmarks = pgTable("benchmarks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Types for JSONB columns
export interface BenchmarkSettings {
  contextSize: string;
  costCap: number;
  reasoningEnabled: boolean;
}

export interface ModelResponseData {
  content: string;
  latency: number;
  cost: number;
  modelId: string;
  modelName: string;
}

export interface CouncilEvaluation {
  judgeColumn: string;
  judgeName: string;
  rankings: { column: string; rank: number; critique: string }[];
}

// Each run of a benchmark (or ad-hoc council run)
export const benchmarkRuns = pgTable("benchmark_runs", {
  id: text("id").primaryKey(),
  benchmarkId: text("benchmark_id").references(() => benchmarks.id, { onDelete: "set null" }),
  prompt: text("prompt").notNull(),
  runAt: timestamp("run_at").notNull().defaultNow(),
  settings: jsonb("settings").$type<BenchmarkSettings>(),
  responses: jsonb("responses").$type<Record<string, ModelResponseData>>(),
  councilEvaluations: jsonb("council_evaluations").$type<CouncilEvaluation[]>(),
  consensusRankings: jsonb("consensus_rankings").$type<string[]>(),
  chairmanSynthesis: text("chairman_synthesis"),
});

// Relations
export const benchmarksRelations = relations(benchmarks, ({ many }) => ({
  runs: many(benchmarkRuns),
}));

export const benchmarkRunsRelations = relations(benchmarkRuns, ({ one }) => ({
  benchmark: one(benchmarks, {
    fields: [benchmarkRuns.benchmarkId],
    references: [benchmarks.id],
  }),
}));

// Insert schemas
export const insertBenchmarkSchema = createInsertSchema(benchmarks).omit({
  id: true,
  createdAt: true,
});

export const insertBenchmarkRunSchema = createInsertSchema(benchmarkRuns).omit({
  id: true,
  runAt: true,
});

// Types
export type InsertBenchmark = z.infer<typeof insertBenchmarkSchema>;
export type Benchmark = typeof benchmarks.$inferSelect;
export type InsertBenchmarkRun = z.infer<typeof insertBenchmarkRunSchema>;
export type BenchmarkRun = typeof benchmarkRuns.$inferSelect;

// ============================================
// PUBLIC LEADERBOARD
// ============================================

// Type for leaderboard result data
export interface LeaderboardResult {
  latency: number;
  cost: number;
  modelName: string;
  modelId: string;
}

// Public leaderboard entries - shared benchmark results
export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  prompt: text("prompt").notNull(),
  recommendedModel: text("recommended_model"),
  settings: jsonb("settings").$type<BenchmarkSettings>(),
  results: jsonb("results").$type<Record<string, LeaderboardResult>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for leaderboard
export const insertLeaderboardEntrySchema = createInsertSchema(leaderboardEntries).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;

// ============================================

export const AVAILABLE_MODELS = [
  { id: "auto-router", name: "Auto Router" },
  { id: "all-models", name: "All Models" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Cerebras: Llama 3.3 70B" },
  { id: "meta-llama/llama-4-maverick:groq", name: "Groq: Llama 4 Maverick" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek-V3" },
  { id: "minimax/minimax-m2", name: "MiniMax M2" },
  { id: "moonshotai/kimi-k2", name: "Kimi K2 (Moonshot)" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B (Alibaba)" },
  { id: "z-ai/glm-4-32b", name: "GLM-4.6 (Zhipu)" },
  { id: "together/qwen-2.5-3b-instruct", name: "Qwen 2.5 3B (3B)" },
  { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B Turbo (7B)" },
  { id: "together/qwen-2.5-14b-instruct", name: "Qwen 2.5 14B (14B)" },
  { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B (70B, reasoning)" },
  { id: "together/deepseek-r1", name: "DeepSeek R1 (Frontier, reasoning)" },
  { id: "together/qwq-32b", name: "QwQ 32B (Frontier, reasoning)" },
] as const;

export const INDIVIDUAL_MODELS = [
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Cerebras: Llama 3.3 70B" },
  { id: "meta-llama/llama-4-maverick:groq", name: "Groq: Llama 4 Maverick" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek-V3" },
  { id: "minimax/minimax-m2", name: "MiniMax M2" },
  { id: "moonshotai/kimi-k2", name: "Kimi K2 (Moonshot)" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B (Alibaba)" },
  { id: "z-ai/glm-4-32b", name: "GLM-4.6 (Zhipu)" },
  { id: "together/qwen-2.5-3b-instruct", name: "Qwen 2.5 3B (3B)" },
  { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B Turbo (7B)" },
  { id: "together/qwen-2.5-14b-instruct", name: "Qwen 2.5 14B (14B)" },
  { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B (70B, reasoning)" },
  { id: "together/deepseek-r1", name: "DeepSeek R1 (Frontier, reasoning)" },
  { id: "together/qwq-32b", name: "QwQ 32B (Frontier, reasoning)" },
] as const;

// Model pricing per 1M tokens (USD)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-4.5": { input: 3.00, output: 15.00 },
  "meta-llama/llama-3.3-70b-instruct:cerebras": { input: 0.60, output: 0.60 },
  "meta-llama/llama-4-maverick:groq": { input: 0.11, output: 0.34 },
  "deepseek/deepseek-chat": { input: 0.14, output: 0.56 },
  "minimax/minimax-m2": { input: 0.30, output: 1.20 },
  "moonshotai/kimi-k2": { input: 0.14, output: 2.49 },
  "qwen/qwen-2.5-72b-instruct": { input: 0.27, output: 0.27 },
  "z-ai/glm-4-32b": { input: 0.10, output: 0.10 },
  "together/qwen-2.5-3b-instruct": { input: 0.06, output: 0.06 },
  "together/qwen-2.5-7b-instruct-turbo": { input: 0.30, output: 0.30 },
  "together/qwen-2.5-14b-instruct": { input: 0.18, output: 0.18 },
  "together/deepseek-r1-distill-llama-70b": { input: 2.00, output: 2.00 },
  "together/deepseek-r1": { input: 3.00, output: 7.00 },
  "together/qwq-32b": { input: 1.20, output: 1.20 },
};

// Helper to calculate cost from token counts
export function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return 0;
  return (inputTokens * pricing.input / 1_000_000) + (outputTokens * pricing.output / 1_000_000);
}

// Calculate what the same tokens would cost using Claude (baseline)
export function calculateClaudeCost(inputTokens: number, outputTokens: number): number {
  const claudePricing = MODEL_PRICING["anthropic/claude-sonnet-4.5"];
  return (inputTokens * claudePricing.input / 1_000_000) + (outputTokens * claudePricing.output / 1_000_000);
}
