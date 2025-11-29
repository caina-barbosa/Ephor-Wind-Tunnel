import { 
  type Chat, 
  type InsertChat, 
  type Message, 
  type InsertMessage,
  type CostStats,
  type Benchmark,
  type InsertBenchmark,
  type BenchmarkRun,
  type InsertBenchmarkRun,
  type LeaderboardEntry,
  type InsertLeaderboardEntry,
  chats,
  messages,
  benchmarks,
  benchmarkRuns,
  leaderboardEntries
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";

// Extended message data type that includes optional costStats
export interface CreateMessageData extends InsertMessage {
  costStats?: CostStats | null;
}

export interface IStorage {
  getChats(): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChatTitle(id: string, title: string): Promise<Chat | undefined>;
  updateChatModel(id: string, modelId: string): Promise<Chat | undefined>;
  deleteChat(id: string): Promise<boolean>;
  
  getMessages(chatId: string): Promise<Message[]>;
  createMessage(message: CreateMessageData): Promise<Message>;
  updateMessageCompeteResults(messageId: string, competeResults: any): Promise<Message | undefined>;
  
  getBenchmarks(): Promise<Benchmark[]>;
  getBenchmark(id: string): Promise<Benchmark | undefined>;
  createBenchmark(benchmark: InsertBenchmark): Promise<Benchmark>;
  deleteBenchmark(id: string): Promise<boolean>;
  
  getBenchmarkRuns(benchmarkId: string): Promise<BenchmarkRun[]>;
  getBenchmarkRun(id: string): Promise<BenchmarkRun | undefined>;
  createBenchmarkRun(run: InsertBenchmarkRun): Promise<BenchmarkRun>;
  updateBenchmarkRun(id: string, data: Partial<BenchmarkRun>): Promise<BenchmarkRun | undefined>;
  
  getLeaderboardEntries(): Promise<LeaderboardEntry[]>;
  createLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;
}

export class DatabaseStorage implements IStorage {
  async getChats(): Promise<Chat[]> {
    return await db.select().from(chats).orderBy(desc(chats.createdAt));
  }

  async getChat(id: string): Promise<Chat | undefined> {
    const [result] = await db.select().from(chats).where(eq(chats.id, id));
    return result || undefined;
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    const id = randomUUID();
    const [chat] = await db.insert(chats).values({
      ...insertChat,
      id,
      createdAt: new Date(),
    }).returning();
    return chat;
  }

  async updateChatTitle(id: string, title: string): Promise<Chat | undefined> {
    const [result] = await db.update(chats).set({ title }).where(eq(chats.id, id)).returning();
    return result || undefined;
  }

  async updateChatModel(id: string, modelId: string): Promise<Chat | undefined> {
    const [result] = await db.update(chats).set({ modelId }).where(eq(chats.id, id)).returning();
    return result || undefined;
  }

  async deleteChat(id: string): Promise<boolean> {
    console.log(`[DELETE] Deleting chat from PostgreSQL: ${id}`);
    const result = await db.delete(chats).where(eq(chats.id, id)).returning();
    return result.length > 0;
  }

  async getMessages(chatId: string): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(asc(messages.timestamp));
  }

  async createMessage(insertMessage: CreateMessageData): Promise<Message> {
    const id = randomUUID();
    const { costStats, ...messageData } = insertMessage;
    const [message] = await db.insert(messages).values({
      ...messageData,
      modelName: messageData.modelName ?? null,
      costStats: costStats ?? null,
      id,
      timestamp: new Date(),
    }).returning();
    return message;
  }

  async updateMessageCompeteResults(messageId: string, competeResults: any): Promise<Message | undefined> {
    const [result] = await db.update(messages)
      .set({ competeResults })
      .where(eq(messages.id, messageId))
      .returning();
    return result || undefined;
  }

  async getBenchmarks(): Promise<Benchmark[]> {
    return await db.select().from(benchmarks).orderBy(desc(benchmarks.createdAt));
  }

  async getBenchmark(id: string): Promise<Benchmark | undefined> {
    const [result] = await db.select().from(benchmarks).where(eq(benchmarks.id, id));
    return result || undefined;
  }

  async createBenchmark(insertBenchmark: InsertBenchmark): Promise<Benchmark> {
    const id = randomUUID();
    const [benchmark] = await db.insert(benchmarks).values({
      ...insertBenchmark,
      id,
      createdAt: new Date(),
    }).returning();
    return benchmark;
  }

  async deleteBenchmark(id: string): Promise<boolean> {
    const result = await db.delete(benchmarks).where(eq(benchmarks.id, id)).returning();
    return result.length > 0;
  }

  async getBenchmarkRuns(benchmarkId: string): Promise<BenchmarkRun[]> {
    return await db.select().from(benchmarkRuns)
      .where(eq(benchmarkRuns.benchmarkId, benchmarkId))
      .orderBy(desc(benchmarkRuns.runAt));
  }

  async getBenchmarkRun(id: string): Promise<BenchmarkRun | undefined> {
    const [result] = await db.select().from(benchmarkRuns).where(eq(benchmarkRuns.id, id));
    return result || undefined;
  }

  async createBenchmarkRun(insertRun: InsertBenchmarkRun): Promise<BenchmarkRun> {
    const id = randomUUID();
    const [run] = await db.insert(benchmarkRuns).values({
      ...insertRun,
      id,
      runAt: new Date(),
    }).returning();
    return run;
  }

  async updateBenchmarkRun(id: string, data: Partial<BenchmarkRun>): Promise<BenchmarkRun | undefined> {
    const [result] = await db.update(benchmarkRuns)
      .set(data)
      .where(eq(benchmarkRuns.id, id))
      .returning();
    return result || undefined;
  }

  async getLeaderboardEntries(): Promise<LeaderboardEntry[]> {
    return await db.select().from(leaderboardEntries).orderBy(desc(leaderboardEntries.createdAt));
  }

  async createLeaderboardEntry(insertEntry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const id = randomUUID();
    const [entry] = await db.insert(leaderboardEntries).values({
      ...insertEntry,
      id,
      createdAt: new Date(),
    }).returning();
    return entry;
  }
}

export const storage = new DatabaseStorage();
