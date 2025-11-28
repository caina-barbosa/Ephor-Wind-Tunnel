import { 
  type Chat, 
  type InsertChat, 
  type Message, 
  type InsertMessage,
  type CostStats,
  chats,
  messages
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
}

export const storage = new DatabaseStorage();
