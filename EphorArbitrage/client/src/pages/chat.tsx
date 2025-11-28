import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Plus, Loader2, Zap, Trash2, ChevronRight, ChevronLeft, BarChart3, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Chat, Message } from "@shared/schema";
import { AVAILABLE_MODELS, INDIVIDUAL_MODELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface CompeteResult {
  place: number;
  modelName: string;
  averageRank?: number;
  qualityScore?: number; // Legacy field for backwards compatibility
  isOriginal?: boolean;
  costStats?: {
    inputTokens: number;
    outputTokens: number;
    responseTimeMs: number;
    cost: number;
    claudeCost: number;
    saved: number;
    savedPercent: number;
  } | null;
}

interface BetterResponse {
  place: number;
  modelName: string;
  averageRank?: number;
  qualityScore?: number; // Legacy field for backwards compatibility
  content: string;
}

interface CompeteResults {
  mode: "single" | "all";
  results: CompeteResult[];
  originalPlacement?: number | null;
  originalModelId?: string | null;
  betterResponses?: BetterResponse[];
  chairmanSynthesis?: string | null;
  judgments: Array<{
    modelName: string;
    reasoning: string;
    error: string | null;
  }>;
}

import type { CostStats, RoutingInfo } from "@shared/schema";

interface SessionStats {
  totalQueries: number;
  totalCost: number;
  totalClaudeCost: number;
  totalSaved: number;
  savedPercent: number;
  avgTTFT: number;
  totalTTFT: number;
  avgThroughput: number;
  totalThroughput: number;
  throughputCount: number;
  fastPathQueries: number;
  premiumPathQueries: number;
  codePathQueries: number;
  fastPathTTFTSum: number;
  premiumPathTTFTSum: number;
  codePathTTFTSum: number;
  fastPathAvgTTFT: number;
  premiumPathAvgTTFT: number;
  codePathAvgTTFT: number;
}

export default function ChatPage() {
  const params = useParams<{ chatId?: string }>();
  const [, setLocation] = useLocation();
  const [selectedModel, setSelectedModel] = useState<string>("auto-router");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [competeLoadingForGroup, setCompeteLoadingForGroup] = useState<string | null>(null);
  const [competeResults, setCompeteResults] = useState<Map<string, CompeteResults>>(new Map());
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [costStatsMap, setCostStatsMap] = useState<Map<string, CostStats>>(new Map());
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalQueries: 0,
    totalCost: 0,
    totalClaudeCost: 0,
    totalSaved: 0,
    savedPercent: 0,
    avgTTFT: 0,
    totalTTFT: 0,
    avgThroughput: 0,
    totalThroughput: 0,
    throughputCount: 0,
    fastPathQueries: 0,
    premiumPathQueries: 0,
    codePathQueries: 0,
    fastPathTTFTSum: 0,
    premiumPathTTFTSum: 0,
    codePathTTFTSum: 0,
    fastPathAvgTTFT: 0,
    premiumPathAvgTTFT: 0,
    codePathAvgTTFT: 0,
  });
  const [sessionStatsExpanded, setSessionStatsExpanded] = useState(false);
  const { toast } = useToast();

  // Helper to format cost with proper precision
  const formatCost = (cost: number): string => {
    if (cost < 0.0001) return "$0.0000";
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(4)}`;
  };

  // Helper to format TTFT (Time to First Token) in milliseconds
  const formatTTFT = (ms: number): string => {
    return `${Math.round(ms).toLocaleString()}ms`;
  };

  // Get speed ranking info (medals for top 3, percentage relative to Claude)
  const getSpeedRanking = (
    responseTimeMs: number,
    allResponseTimes: Array<{ modelName: string; responseTimeMs: number }>
  ): { medal: string; speedMultiplier: string; color: string } => {
    const sortedBySpeed = [...allResponseTimes].sort((a, b) => a.responseTimeMs - b.responseTimeMs);
    const rank = sortedBySpeed.findIndex(r => r.responseTimeMs === responseTimeMs) + 1;
    
    const claudeTime = allResponseTimes.find(r => 
      r.modelName === "anthropic/claude-sonnet-4.5" || r.modelName === "Claude Sonnet 4.5"
    )?.responseTimeMs || responseTimeMs;
    
    let speedText = "";
    let color = "text-gray-600";
    
    if (responseTimeMs < claudeTime * 0.95) {
      // Faster: ((Claude_ms - Model_ms) / Claude_ms) × 100
      const fasterPercent = Math.round(((claudeTime - responseTimeMs) / claudeTime) * 100);
      speedText = `⚡ ${fasterPercent}% faster`;
      color = "text-green-600";
    } else if (responseTimeMs > claudeTime * 1.05) {
      // Slower: ((Model_ms - Claude_ms) / Claude_ms) × 100
      const slowerPercent = Math.round(((responseTimeMs - claudeTime) / claudeTime) * 100);
      speedText = `🐢 ${slowerPercent}% slower`;
      color = "text-red-500";
    } else {
      speedText = "Baseline";
      color = "text-blue-600";
    }
    
    // Medal for speed ranking (top 3 fastest) - don't override color
    let medal = "";
    if (rank === 1) { medal = "🥇"; }
    else if (rank === 2) { medal = "🥈"; }
    else if (rank === 3) { medal = "🥉"; }
    
    return { medal, speedMultiplier: speedText, color };
  };

  // Helper: Map model ID to human-friendly name
  const getModelDisplayName = (modelId: string): string => {
    const allModels = [
      { id: "all-models", name: "All Models" },
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
      { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Cerebras: Llama 3.3 70B" },
      { id: "meta-llama/llama-4-maverick:groq", name: "Groq: Llama 4 Maverick" },
      { id: "deepseek/deepseek-chat", name: "DeepSeek-V3" },
      { id: "minimax/minimax-m2", name: "MiniMax M2" },
      { id: "moonshotai/kimi-k2", name: "Kimi K2 (Moonshot)" },
      { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B (Alibaba)" },
      { id: "z-ai/glm-4-32b", name: "GLM-4-32B (Zhipu)" },
      { id: "together/qwen-2.5-3b-instruct", name: "Qwen 2.5 3B (3B)" },
      { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B Turbo (7B)" },
      { id: "together/qwen-2.5-14b-instruct", name: "Qwen 2.5 14B (14B)" },
      { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B (70B, reasoning)" },
      { id: "together/deepseek-r1", name: "DeepSeek R1 (Frontier, reasoning)" },
      { id: "together/qwq-32b", name: "QwQ 32B (Frontier, reasoning)" },
    ];
    const model = allModels.find((m) => m.id === modelId);
    return model?.name || modelId;
  };

  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/chats", currentChatId, "messages"],
    enabled: !!currentChatId,
  });

  // Load chat from URL parameter on initial mount
  useEffect(() => {
    if (params.chatId && chats.length > 0) {
      const chatExists = chats.find((c) => c.id === params.chatId);
      if (chatExists) {
        setCurrentChatId(params.chatId);
        setSelectedModel(chatExists.modelId);
      }
    }
  }, [params.chatId, chats]);

  // Hydrate compete results from loaded messages
  useEffect(() => {
    const newCompeteResults = new Map<string, CompeteResults>();
    
    if (messages && messages.length > 0) {
      messages.forEach((msg) => {
        if (msg.competeResults) {
          // competeResults is stored on user messages
          newCompeteResults.set(msg.id, msg.competeResults as CompeteResults);
        }
      });
    }
    
    // Always set state, even if empty, to clear stale data when switching chats
    setCompeteResults(newCompeteResults);
  }, [messages]);

  // Hydrate cost stats from loaded messages
  useEffect(() => {
    const newCostStatsMap = new Map<string, CostStats>();
    let totalCost = 0;
    let totalClaudeCost = 0;
    let queryCount = 0;
    let totalTTFT = 0;
    let totalThroughput = 0;
    let throughputCount = 0;
    let fastPathQueries = 0;
    let premiumPathQueries = 0;
    let codePathQueries = 0;
    let fastPathTTFTSum = 0;
    let premiumPathTTFTSum = 0;
    let codePathTTFTSum = 0;
    
    if (messages && messages.length > 0) {
      messages.forEach((msg) => {
        if (msg.role === 'assistant' && msg.costStats) {
          const stats = msg.costStats as CostStats;
          newCostStatsMap.set(msg.id, stats);
          totalCost += stats.cost;
          totalClaudeCost += stats.claudeCost;
          totalTTFT += stats.responseTimeMs;
          queryCount++;
          
          // Track throughput
          if (stats.tokensPerSecond && stats.tokensPerSecond > 0) {
            totalThroughput += stats.tokensPerSecond;
            throughputCount++;
          }
          
          const route = stats.routingInfo?.route;
          if (route === 'ultra-fast' || route === 'fast') {
            fastPathQueries++;
            fastPathTTFTSum += stats.responseTimeMs;
          } else if (route === 'premium') {
            premiumPathQueries++;
            premiumPathTTFTSum += stats.responseTimeMs;
          } else if (route === 'code') {
            codePathQueries++;
            codePathTTFTSum += stats.responseTimeMs;
          }
        }
      });
    }
    
    setCostStatsMap(newCostStatsMap);
    
    const totalSaved = totalClaudeCost - totalCost;
    const savedPercent = totalClaudeCost > 0 ? (totalSaved / totalClaudeCost) * 100 : 0;
    const avgTTFT = queryCount > 0 ? Math.round(totalTTFT / queryCount) : 0;
    const avgThroughput = throughputCount > 0 ? Math.round(totalThroughput / throughputCount) : 0;
    const fastPathAvgTTFT = fastPathQueries > 0 ? Math.round(fastPathTTFTSum / fastPathQueries) : 0;
    const premiumPathAvgTTFT = premiumPathQueries > 0 ? Math.round(premiumPathTTFTSum / premiumPathQueries) : 0;
    const codePathAvgTTFT = codePathQueries > 0 ? Math.round(codePathTTFTSum / codePathQueries) : 0;
    
    setSessionStats({
      totalQueries: queryCount,
      totalCost,
      totalClaudeCost,
      totalSaved,
      savedPercent,
      avgTTFT,
      totalTTFT,
      avgThroughput,
      totalThroughput,
      throughputCount,
      fastPathQueries,
      premiumPathQueries,
      codePathQueries,
      fastPathTTFTSum,
      premiumPathTTFTSum,
      codePathTTFTSum,
      fastPathAvgTTFT,
      premiumPathAvgTTFT,
      codePathAvgTTFT,
    });
  }, [messages]);

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chats", {
        title: "New Chat",
        modelId: selectedModel || AVAILABLE_MODELS[0].id,
      });
      return await response.json();
    },
    onSuccess: (newChat: Chat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setCurrentChatId(newChat.id);
      setLocation(`/chat/${newChat.id}`);
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      if (!currentChatId) return;
      const response = await apiRequest("PATCH", "/api/chats/" + currentChatId + "/model", {
        modelId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, content }: { chatId: string; content: string }) => {
      const response = await apiRequest("POST", "/api/chats/" + chatId + "/chat", {
        message: content,
      });
      
      return { data: await response.json(), chatId };
    },
    onMutate: async () => {
      // Clear input immediately for better UX
      setMessageInput("");
    },
    onSuccess: ({ data, chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      
      // Capture cost stats from response
      if (data?.message?.costStats) {
        // Single model response
        const stats = data.message.costStats as CostStats;
        setCostStatsMap(prev => new Map(prev).set(data.message.id, stats));
        
        // Update session stats with routing breakdown using cumulative sums
        setSessionStats(prev => {
          const newTotal = prev.totalCost + stats.cost;
          const newClaudeTotal = prev.totalClaudeCost + stats.claudeCost;
          const newSaved = newClaudeTotal - newTotal;
          const newQueryCount = prev.totalQueries + 1;
          const newTotalTTFT = prev.totalTTFT + stats.responseTimeMs;
          
          // Track throughput
          const throughput = stats.tokensPerSecond || 0;
          const newThroughputCount = throughput > 0 ? prev.throughputCount + 1 : prev.throughputCount;
          const newTotalThroughput = throughput > 0 ? prev.totalThroughput + throughput : prev.totalThroughput;
          
          const route = stats.routingInfo?.route;
          let newFastPathQueries = prev.fastPathQueries;
          let newPremiumPathQueries = prev.premiumPathQueries;
          let newCodePathQueries = prev.codePathQueries;
          let newFastPathTTFTSum = prev.fastPathTTFTSum;
          let newPremiumPathTTFTSum = prev.premiumPathTTFTSum;
          let newCodePathTTFTSum = prev.codePathTTFTSum;
          
          if (route === 'ultra-fast' || route === 'fast') {
            newFastPathQueries++;
            newFastPathTTFTSum += stats.responseTimeMs;
          } else if (route === 'premium') {
            newPremiumPathQueries++;
            newPremiumPathTTFTSum += stats.responseTimeMs;
          } else if (route === 'code') {
            newCodePathQueries++;
            newCodePathTTFTSum += stats.responseTimeMs;
          }
          
          return {
            totalQueries: newQueryCount,
            totalCost: newTotal,
            totalClaudeCost: newClaudeTotal,
            totalSaved: newSaved,
            savedPercent: newClaudeTotal > 0 ? (newSaved / newClaudeTotal) * 100 : 0,
            avgTTFT: newQueryCount > 0 ? Math.round(newTotalTTFT / newQueryCount) : 0,
            totalTTFT: newTotalTTFT,
            avgThroughput: newThroughputCount > 0 ? Math.round(newTotalThroughput / newThroughputCount) : 0,
            totalThroughput: newTotalThroughput,
            throughputCount: newThroughputCount,
            fastPathQueries: newFastPathQueries,
            premiumPathQueries: newPremiumPathQueries,
            codePathQueries: newCodePathQueries,
            fastPathTTFTSum: newFastPathTTFTSum,
            premiumPathTTFTSum: newPremiumPathTTFTSum,
            codePathTTFTSum: newCodePathTTFTSum,
            fastPathAvgTTFT: newFastPathQueries > 0 ? Math.round(newFastPathTTFTSum / newFastPathQueries) : 0,
            premiumPathAvgTTFT: newPremiumPathQueries > 0 ? Math.round(newPremiumPathTTFTSum / newPremiumPathQueries) : 0,
            codePathAvgTTFT: newCodePathQueries > 0 ? Math.round(newCodePathTTFTSum / newCodePathQueries) : 0,
          };
        });
      } else if (data?.messages) {
        // All models response
        const newStatsMap = new Map(costStatsMap);
        let queryCost = 0;
        let queryClaudeCost = 0;
        let queryLatencySum = 0;
        let queryThroughputSum = 0;
        let throughputResponses = 0;
        let responseCount = 0;
        
        data.messages.forEach((msg: { id: string; costStats?: CostStats }) => {
          if (msg.costStats) {
            newStatsMap.set(msg.id, msg.costStats);
            queryCost += msg.costStats.cost;
            queryClaudeCost += msg.costStats.claudeCost;
            queryLatencySum += msg.costStats.responseTimeMs;
            responseCount++;
            if (msg.costStats.tokensPerSecond && msg.costStats.tokensPerSecond > 0) {
              queryThroughputSum += msg.costStats.tokensPerSecond;
              throughputResponses++;
            }
          }
        });
        
        setCostStatsMap(newStatsMap);
        
        // Update session stats (count each response for latency stats)
        if (responseCount > 0) {
          setSessionStats(prev => {
            const newTotal = prev.totalCost + queryCost;
            const newClaudeTotal = prev.totalClaudeCost + queryClaudeCost;
            const newSaved = newClaudeTotal - newTotal;
            const newQueryCount = prev.totalQueries + responseCount;
            const newTotalTTFT = prev.totalTTFT + queryLatencySum;
            const newTotalThroughput = prev.totalThroughput + queryThroughputSum;
            const newThroughputCount = prev.throughputCount + throughputResponses;
            return {
              ...prev,
              totalQueries: newQueryCount,
              totalCost: newTotal,
              totalClaudeCost: newClaudeTotal,
              totalSaved: newSaved,
              savedPercent: newClaudeTotal > 0 ? (newSaved / newClaudeTotal) * 100 : 0,
              avgTTFT: newQueryCount > 0 ? Math.round(newTotalTTFT / newQueryCount) : 0,
              totalTTFT: newTotalTTFT,
              avgThroughput: newThroughputCount > 0 ? Math.round(newTotalThroughput / newThroughputCount) : 0,
              totalThroughput: newTotalThroughput,
              throughputCount: newThroughputCount,
            };
          });
        }
      }
      
      // Show notification if conversation was trimmed
      if (data?.wasTrimmed) {
        toast({
          title: "Long Conversation Detected",
          description: "Older messages were excluded to stay within token limits. Full history is still saved.",
          variant: "default",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNewChat = () => {
    // Don't create chat yet - just clear current selection
    // Chat will be created when user sends first message
    setCurrentChatId(null);
    setSelectedModel("auto-router");
    setMessageInput("");
    setLocation("/");
    setSessionStatsExpanded(false);
    // Reset session stats - they will be rehydrated from messages when a new chat is loaded
    setSessionStats({
      totalQueries: 0,
      totalCost: 0,
      totalClaudeCost: 0,
      totalSaved: 0,
      savedPercent: 0,
      avgTTFT: 0,
      totalTTFT: 0,
      avgThroughput: 0,
      totalThroughput: 0,
      throughputCount: 0,
      fastPathQueries: 0,
      premiumPathQueries: 0,
      codePathQueries: 0,
      fastPathTTFTSum: 0,
      premiumPathTTFTSum: 0,
      codePathTTFTSum: 0,
      fastPathAvgTTFT: 0,
      premiumPathAvgTTFT: 0,
      codePathAvgTTFT: 0,
    });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    if (createChatMutation.isPending || sendMessageMutation.isPending) return;
    
    const message = messageInput;
    
    if (!currentChatId) {
      // Create chat first, then send message via mutation
      try {
        const newChat = await createChatMutation.mutateAsync();
        
        if (!newChat || !newChat.id) {
          console.error("Chat creation failed - no valid chat object returned");
          return;
        }
        
        // Set the new chat as current and update URL
        setCurrentChatId(newChat.id);
        setLocation(`/chat/${newChat.id}`);
        
        // Now send the message using the standard mutation with explicit chatId
        sendMessageMutation.mutate({ chatId: newChat.id, content: message });
      } catch (error) {
        console.error("Failed to create chat:", error);
      }
    } else {
      sendMessageMutation.mutate({ chatId: currentChatId, content: message });
    }
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setLocation(`/chat/${chatId}`);
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      setSelectedModel(chat.modelId);
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    if (currentChatId) {
      updateModelMutation.mutate(modelId);
    }
  };

  const competeMutation = useMutation({
    mutationFn: async ({ userMessageId }: { userMessageId: string }) => {
      if (!currentChatId) throw new Error("No chat selected");
      const response = await apiRequest("POST", `/api/chats/${currentChatId}/compete`, {
        userMessageId,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Compete analysis failed");
      }
      return await response.json();
    },
    onSuccess: (data: CompeteResults, variables) => {
      console.log('[Compete] Received results:', data);
      console.log('[Compete] Results with costStats:', data.results.map(r => ({
        model: r.modelName,
        hasCostStats: !!r.costStats,
        ttft: r.costStats?.responseTimeMs
      })));
      setCompeteResults(prev => new Map(prev).set(variables.userMessageId, data));
      setCompeteLoadingForGroup(null);
    },
    onError: (error: any) => {
      console.error("Compete error:", error);
      toast({
        title: "Compete Analysis Failed",
        description: error.message || "Unable to complete peer review analysis",
        variant: "destructive",
      });
      setCompeteLoadingForGroup(null);
    },
  });

  const handleCompete = (userMessageId: string, isAllModels: boolean) => {
    console.log('[Compete] Requesting compete analysis for user message ID:', userMessageId);
    console.log('[Compete] Current messages in state:', messages.map(m => ({ id: m.id, role: m.role })));
    setCompeteLoadingForGroup(userMessageId);
    competeMutation.mutate({ userMessageId });
  };

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await apiRequest("DELETE", `/api/chats/${chatId}`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete chat");
      }
      return await response.json();
    },
    onSuccess: (_data, deletedChatId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      
      // If we deleted the current chat, clear selection
      if (currentChatId === deletedChatId) {
        setCurrentChatId(null);
        setSelectedModel("auto-router");
        setLocation("/");
      }
      
      setChatToDelete(null);
      toast({
        title: "Chat deleted",
        description: "The chat has been removed.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete chat",
        description: error.message || "An error occurred while deleting the chat.",
        variant: "destructive",
      });
      setChatToDelete(null);
    },
  });

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent chat selection when clicking delete
    setChatToDelete(chatId);
  };

  const confirmDeleteChat = () => {
    if (chatToDelete) {
      deleteChatMutation.mutate(chatToDelete);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-[280px] border-r border-gray-200 flex flex-col p-4">
        <h1 className="text-xl font-semibold mb-6 text-foreground" data-testid="text-app-title">
          EPHOR
        </h1>
        
        <Button
          onClick={handleNewChat}
          className="w-full mb-4 bg-gray-100 text-foreground hover:bg-gray-200 rounded-lg"
          variant="ghost"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>

        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group relative flex w-full items-center text-left text-sm py-2 px-3 rounded hover:bg-gray-50 transition-colors ${
                  currentChatId === chat.id ? "bg-gray-100" : ""
                }`}
              >
                <button
                  onClick={() => handleSelectChat(chat.id)}
                  className="min-w-0 w-full whitespace-normal break-words pr-10 text-left"
                  data-testid={`button-chat-${chat.id}`}
                >
                  {chat.title}
                </button>
                <button
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-opacity absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded focus-visible:ring-2 focus-visible:ring-gray-400"
                  data-testid={`button-delete-chat-${chat.id}`}
                  aria-label="Delete chat"
                >
                  <Trash2 className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>

      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!currentChatId ? (
          // Welcome State
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-3xl mx-auto px-8">
              <div className="mb-8">
                <h2 className="text-3xl font-medium mb-2 text-foreground" data-testid="text-welcome-heading">
                  Welcome to EPHOR WIND TUNNEL
                </h2>
              </div>

              <div className="flex justify-center">
                <Select value={selectedModel} onValueChange={handleModelChange}>
                  <SelectTrigger className="w-[240px]" data-testid="select-model">
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          // Chat Messages
          <div className="flex-1 flex flex-col relative">
            {/* Top Bar - Model Selector & Session Stats */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex-1" />
              
              {/* Session Stats Summary - Always visible when there are queries */}
              {sessionStats.totalQueries > 0 && (
                <button
                  onClick={() => setSessionStatsExpanded(!sessionStatsExpanded)}
                  className="flex items-center gap-2 px-3 py-1.5 mr-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-sm"
                >
                  <span className="text-green-700 font-medium">
                    Total Saved: {formatCost(sessionStats.totalSaved)}
                  </span>
                  <span className="text-green-600">|</span>
                  <span className="text-green-600 font-semibold">
                    {Math.round(sessionStats.savedPercent)}% saved
                  </span>
                  <BarChart3 className="w-4 h-4 text-green-600 ml-1" />
                </button>
              )}
              
              <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="w-[200px]" data-testid="select-model-chat">
                  <SelectValue placeholder="All Models" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-8 py-8">
              <div className="max-w-5xl mx-auto space-y-4">
                {(() => {
                  // Group messages: user messages and their corresponding assistant responses
                  const groupedMessages: Array<{ user: Message; assistants: Message[] }> = [];
                  let currentGroup: { user: Message; assistants: Message[] } | null = null;

                  messages.forEach((msg) => {
                    if (msg.role === "user") {
                      if (currentGroup) {
                        groupedMessages.push(currentGroup);
                      }
                      currentGroup = { user: msg, assistants: [] };
                    } else if (msg.role === "assistant" && currentGroup) {
                      currentGroup.assistants.push(msg);
                    }
                  });

                  if (currentGroup) {
                    groupedMessages.push(currentGroup);
                  }

                  return groupedMessages.map((group, groupIndex) => (
                    <div key={group.user.id} className="space-y-4">
                      {/* User Message */}
                      <div className="flex justify-end" data-testid={`message-${group.user.id}`}>
                        <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
                          <div className="text-base leading-relaxed whitespace-pre-wrap" data-testid={`message-content-${group.user.id}`}>
                            {group.user.content}
                          </div>
                        </div>
                      </div>

                      {/* Assistant Responses */}
                      {group.assistants.length > 1 ? (
                        // Grid layout for multiple responses (All Models)
                        // Sort by speed (fastest first)
                        (() => {
                          const allResponseTimes = group.assistants.map(a => ({
                            modelName: a.modelName || '',
                            responseTimeMs: costStatsMap.get(a.id)?.responseTimeMs || 999999
                          }));
                          const sortedAssistants = [...group.assistants].sort((a, b) => {
                            const aTime = costStatsMap.get(a.id)?.responseTimeMs || 999999;
                            const bTime = costStatsMap.get(b.id)?.responseTimeMs || 999999;
                            return aTime - bTime;
                          });
                          // Calculate summary stats for All Models mode
                          const allStats = sortedAssistants.map(a => costStatsMap.get(a.id)).filter(Boolean);
                          const claudeStats = sortedAssistants.find(a => a.modelName?.includes('claude'))
                            ? costStatsMap.get(sortedAssistants.find(a => a.modelName?.includes('claude'))!.id)
                            : null;
                          const budgetStats = allStats.filter(s => s && !sortedAssistants.find(a => costStatsMap.get(a.id) === s && a.modelName?.includes('claude')));
                          const avgSavingsPercent = budgetStats.length > 0 
                            ? budgetStats.reduce((sum, s) => sum + (s?.savedPercent || 0), 0) / budgetStats.length
                            : 0;
                          const totalBudgetCost = budgetStats.reduce((sum, s) => sum + (s?.cost || 0), 0);
                          const claudeEquivalentCost = budgetStats.reduce((sum, s) => sum + (s?.claudeCost || 0), 0);
                          
                          return (
                        <div className="space-y-4">
                          {/* Speed Arbitrage Summary Bar */}
                          {allStats.length > 1 && avgSavingsPercent > 0 && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">💰</span>
                                  <span className="font-semibold text-green-800">Speed Arbitrage Summary</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">Avg savings:</span>
                                    <span className="font-bold text-green-700">{avgSavingsPercent.toFixed(0)}% vs Claude</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">7 models cost:</span>
                                    <span className="font-bold text-green-700">${totalBudgetCost.toFixed(6)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">vs Claude equivalent:</span>
                                    <span className="font-bold text-gray-700">${claudeEquivalentCost.toFixed(6)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sortedAssistants.map((message) => {
                              const stats = costStatsMap.get(message.id);
                              const speedRanking = stats ? getSpeedRanking(stats.responseTimeMs, allResponseTimes) : null;
                              return (
                              <Card key={message.id} className="p-4" data-testid={`message-${message.id}`}>
                                {message.modelName && (
                                  <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2" data-testid={`model-label-${message.id}`}>
                                    {speedRanking?.medal && <span className="text-base">{speedRanking.medal}</span>}
                                    {getModelDisplayName(message.modelName)}
                                  </div>
                                )}
                                <div className="text-sm leading-relaxed mb-3 prose prose-sm max-w-none prose-table:border prose-table:border-collapse prose-td:border prose-td:p-2 prose-th:border prose-th:p-2" data-testid={`message-content-${message.id}`}>
                                  <ReactMarkdown>{message.content}</ReactMarkdown>
                                </div>
                                {stats && (
                                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs space-y-1" data-testid={`cost-stats-${message.id}`}>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className={`font-medium ${speedRanking?.color || 'text-gray-600'}`}>
                                        ⚡ {formatTTFT(stats.responseTimeMs)} TTFT
                                      </span>
                                      {stats.tokensPerSecond !== undefined && (
                                        <span className="font-medium text-purple-600">
                                          📊 {stats.tokensPerSecond.toLocaleString()} tok/s
                                        </span>
                                      )}
                                      {stats.saved > 0 && (
                                        <span className="font-medium text-green-600">
                                          💰 {stats.savedPercent.toFixed(0)}% saved
                                        </span>
                                      )}
                                    </div>
                                    {speedRanking && (
                                      <div className={`flex items-center gap-1 font-medium ${speedRanking.color}`}>
                                        <span>{speedRanking.speedMultiplier}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Card>
                              );
                            })}
                          </div>
                          
                          {/* Compete Button for All Models (only show if exactly 8 responses and no results yet) */}
                          {group.assistants.length === 8 && !competeResults.get(group.user.id) && (
                            <div className="flex justify-center">
                              <Button
                                onClick={() => handleCompete(group.user.id, true)}
                                disabled={competeLoadingForGroup === group.user.id}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                data-testid="button-compete-all"
                              >
                                {competeLoadingForGroup === group.user.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Running peer review...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-4 h-4 mr-2" />
                                    Run Compete Analysis
                                  </>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Compete Results */}
                          {competeResults.get(group.user.id) && (
                            <div className="space-y-4">
                              {/* Chairman's Synthesis (STAGE 3) */}
                              {competeResults.get(group.user.id)!.chairmanSynthesis && (
                                <Card className="p-6 bg-purple-50 border-purple-200" data-testid="card-chairman-synthesis">
                                  <h3 className="text-lg font-semibold mb-3 text-purple-900 flex items-center gap-2">
                                    📋 Chairman's Synthesis
                                  </h3>
                                  <div className="text-base leading-relaxed prose prose-sm max-w-none text-gray-900" data-testid="text-synthesis-content">
                                    <ReactMarkdown>{competeResults.get(group.user.id)!.chairmanSynthesis}</ReactMarkdown>
                                  </div>
                                </Card>
                              )}

                              {/* Compete Rankings Table */}
                              {(() => {
                                const results = competeResults.get(group.user.id)!.results;
                                // Build comparison data by matching model display names to assistant messages
                                const comparisonData = results.map((result) => {
                                  // Match using display name conversion since result.modelName is display name and assistant.modelName is ID
                                  const assistantMsg = group.assistants.find(a => getModelDisplayName(a.modelName || '') === result.modelName);
                                  const stats = assistantMsg ? costStatsMap.get(assistantMsg.id) : null;
                                  // Handle both new averageRank and legacy qualityScore
                                  const rankValue = result.averageRank ?? (result.qualityScore ? (11 - result.qualityScore) : result.place);
                                  // Value rating based on average rank (lower rank is better)
                                  const valueRating = stats && stats.cost > 0 
                                    ? Math.min(5, Math.max(1, Math.round((9 - rankValue) / (stats.cost * 100) * 2)))
                                    : 3;
                                  return {
                                    ...result,
                                    stats,
                                    valueRating,
                                    displayRank: rankValue,
                                  };
                                });
                                
                                // Find fastest and slowest
                                const withStats = comparisonData.filter(d => d.stats);
                                const fastestTime = withStats.length > 0 ? Math.min(...withStats.map(d => d.stats!.responseTimeMs)) : 0;
                                const slowestTime = withStats.length > 0 ? Math.max(...withStats.map(d => d.stats!.responseTimeMs)) : 0;
                                
                                // Generate key insight
                                const claudeResult = results.find(r => r.modelName === "Claude Sonnet 4.5");
                                const claudeRank = claudeResult?.place || 6;
                                const cheapModels = results.filter(r => r.modelName !== "Claude Sonnet 4.5");
                                const cheapModelsBetterThanClaude = cheapModels.filter(r => r.place < claudeRank);
                                const topCheapModel = cheapModels.sort((a, b) => a.place - b.place)[0];
                                const topCheapModelStats = topCheapModel ? comparisonData.find(d => d.modelName === topCheapModel.modelName)?.stats : null;
                                const savingsPercent = topCheapModelStats?.savedPercent || 0;
                                
                                return (
                                  <>
                                    <Card className="p-6 bg-white border-gray-200" data-testid="model-comparison-table">
                                      <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                        {"\ud83c\udfc6"} Compete Rankings
                                      </h3>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b-2 border-gray-200">
                                              <th className="text-left py-3 px-2 font-semibold text-gray-700">Model</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Avg Rank</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">TTFT</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Throughput</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Cost</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Savings</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {comparisonData.map((item, idx) => {
                                              const latencyMs = item.stats?.responseTimeMs || 0;
                                              const throughput = item.stats?.tokensPerSecond || 0;
                                              const allTimes = comparisonData.filter(d => d.stats).map(d => ({ modelName: d.modelName, responseTimeMs: d.stats!.responseTimeMs }));
                                              const speedRank = allTimes.sort((a, b) => a.responseTimeMs - b.responseTimeMs).findIndex(t => t.modelName === item.modelName) + 1;
                                              const speedMedal = speedRank === 1 ? "🥇" : speedRank === 2 ? "🥈" : speedRank === 3 ? "🥉" : "";
                                              const claudeTime = allTimes.find(t => t.modelName === "Claude Sonnet 4.5")?.responseTimeMs || latencyMs;
                                              const isClaude = item.modelName === "Claude Sonnet 4.5";
                                              const isFaster = latencyMs < claudeTime * 0.95;
                                              const isSlower = latencyMs > claudeTime * 1.05;
                                              const fasterPercent = Math.round(((claudeTime - latencyMs) / claudeTime) * 100);
                                              const slowerPercent = Math.round(((latencyMs - claudeTime) / claudeTime) * 100);
                                              return (
                                              <tr 
                                                key={item.place} 
                                                className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                                data-testid={`comparison-row-${item.place}`}
                                              >
                                                <td className="py-3 px-2">
                                                  <div className="flex items-center gap-2">
                                                    <span className="w-6">
                                                      {item.place === 1 ? "\ud83e\udd47" : item.place === 2 ? "\ud83e\udd48" : item.place === 3 ? "\ud83e\udd49" : ""}
                                                    </span>
                                                    <span className="font-medium text-gray-900">{item.modelName}</span>
                                                  </div>
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  <span className={`font-semibold ${item.displayRank <= 2 ? 'text-green-600' : item.displayRank <= 4 ? 'text-blue-600' : 'text-gray-600'}`}>
                                                    {item.displayRank.toFixed(1)}
                                                  </span>
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  {item.stats ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                      <span className="flex items-center gap-1 font-medium text-gray-700">
                                                        {speedMedal && <span>{speedMedal}</span>}
                                                        {formatTTFT(latencyMs)}
                                                      </span>
                                                      {isClaude ? (
                                                        <span className="text-xs text-blue-600">Baseline</span>
                                                      ) : isFaster ? (
                                                        <span className="text-xs text-green-600">⚡ {fasterPercent}% faster</span>
                                                      ) : isSlower ? (
                                                        <span className="text-xs text-red-500">🐢 {slowerPercent}% slower</span>
                                                      ) : null}
                                                    </div>
                                                  ) : "-"}
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  {throughput > 0 ? (
                                                    <span className="font-medium text-purple-600">
                                                      📊 {throughput.toLocaleString()} tok/s
                                                    </span>
                                                  ) : "-"}
                                                </td>
                                                <td className="text-center py-3 px-2 font-medium">
                                                  {item.stats ? formatCost(item.stats.cost) : "-"}
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  {item.stats && item.stats.savedPercent > 0 ? (
                                                    <span className="text-green-600 font-medium">
                                                      {item.stats.savedPercent.toFixed(0)}%
                                                    </span>
                                                  ) : item.stats ? (
                                                    <span className="text-gray-400">--</span>
                                                  ) : "-"}
                                                </td>
                                              </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </Card>

                                    {/* Speed Arbitrage Analysis */}
                                    {(() => {
                                      const claudeData = comparisonData.find(d => d.modelName === "Claude Sonnet 4.5");
                                      const claudeLatency = claudeData?.stats?.responseTimeMs || 0;
                                      
                                      // Sort all models by speed (fastest first)
                                      const sortedBySpeed = [...withStats].sort((a, b) => a.stats!.responseTimeMs - b.stats!.responseTimeMs);
                                      
                                      const fastestModel = sortedBySpeed.length > 0 ? sortedBySpeed[0] : null;
                                      const fastestLatency = fastestModel?.stats?.responseTimeMs || 0;
                                      const fastestPercent = claudeLatency > 0 && fastestLatency > 0 
                                        ? Math.round(((claudeLatency - fastestLatency) / claudeLatency) * 100) : 0;
                                      
                                      // Count models faster than Claude
                                      const modelsFasterThanClaude = sortedBySpeed.filter(m => 
                                        claudeLatency > 0 && m.stats!.responseTimeMs < claudeLatency
                                      );
                                      
                                      return (
                                        <Card className="p-6 bg-gray-900 border-gray-700" data-testid="speed-arbitrage-analysis">
                                          <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                            ⚡ SPEED WIND TUNNEL ANALYSIS
                                          </h3>
                                          
                                          {/* Speed Rankings */}
                                          <div className="space-y-2 mb-4">
                                            {sortedBySpeed.map((m, idx) => {
                                              const latency = m.stats!.responseTimeMs;
                                              const isClaude = m.modelName === "Claude Sonnet 4.5";
                                              const isFaster = claudeLatency > 0 && latency < claudeLatency * 0.95;
                                              const isSlower = claudeLatency > 0 && latency > claudeLatency * 1.05;
                                              const fasterPercent = Math.round(((claudeLatency - latency) / claudeLatency) * 100);
                                              const slowerPercent = Math.round(((latency - claudeLatency) / claudeLatency) * 100);
                                              
                                              // Medal for top 3
                                              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
                                              
                                              return (
                                                <div key={m.modelName} className="text-sm text-white flex items-center gap-2">
                                                  <span className="w-6 text-center">{medal}</span>
                                                  <span className="font-medium">{m.modelName}</span>
                                                  <span className="text-gray-400">-</span>
                                                  <span className="text-gray-300">{formatTTFT(latency)}</span>
                                                  {isClaude ? (
                                                    <span className="text-blue-400">(Baseline)</span>
                                                  ) : isFaster ? (
                                                    <span className="text-green-400">⚡ {fasterPercent}% faster</span>
                                                  ) : isSlower ? (
                                                    <span className="text-red-400">🐢 {slowerPercent}% slower</span>
                                                  ) : (
                                                    <span className="text-gray-400">(~same as Claude)</span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                          
                                          {/* Key Insight */}
                                          {fastestModel && (
                                            <div className="mt-4 pt-4 border-t border-gray-700">
                                              <div className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-1">
                                                💡 KEY INSIGHT:
                                              </div>
                                              <div className="text-base text-white leading-relaxed">
                                                <span className="font-bold text-green-400">{fastestModel.modelName}</span> ranked{" "}
                                                <span className="font-bold text-amber-400">#{fastestModel.place} in quality</span>
                                                {fastestPercent > 0 && (
                                                  <> while being <span className="font-bold text-green-400">{fastestPercent}% faster</span> than Claude</>
                                                )}.
                                                {modelsFasterThanClaude.length > 0 && (
                                                  <> <span className="font-semibold">{modelsFasterThanClaude.length} of {withStats.length}</span> models outpaced the premium baseline.</>
                                                )}
                                                {savingsPercent > 0 && (
                                                  <> Speed advantage: <span className="font-bold text-green-400">{fastestPercent}% faster</span> at <span className="font-bold text-green-400">{savingsPercent.toFixed(0)}% lower cost</span>.</>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </Card>
                                      );
                                    })()}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                          );
                        })()
                      ) : group.assistants.length === 1 ? (
                        // Single response
                        (() => {
                          const singleStats = costStatsMap.get(group.assistants[0].id);
                          const routingInfo = singleStats?.routingInfo;
                          
                          return (
                          <div className="space-y-4">
                          <Card className="p-6 bg-white border-gray-200" data-testid={`message-${group.assistants[0].id}`}>
                              {group.assistants[0].modelName && (
                                <div className="text-xs text-gray-500 mb-1" data-testid={`model-label-${group.assistants[0].id}`}>
                                  {getModelDisplayName(group.assistants[0].modelName)}
                                </div>
                              )}
                              <div className="text-base leading-relaxed prose prose-sm max-w-none prose-table:border prose-table:border-collapse prose-td:border prose-td:p-2 prose-th:border prose-th:p-2" data-testid={`message-content-${group.assistants[0].id}`}>
                                <ReactMarkdown>{group.assistants[0].content}</ReactMarkdown>
                              </div>
                              {singleStats && (
                                <div className="mt-3 pt-3 border-t border-gray-100 text-xs space-y-1" data-testid={`cost-stats-${group.assistants[0].id}`}>
                                  {routingInfo ? (
                                    <div className="flex flex-wrap items-center gap-2 text-gray-600 font-medium">
                                      <span>⚡ {formatTTFT(singleStats.responseTimeMs)} TTFT</span>
                                      {singleStats.tokensPerSecond && (
                                        <>
                                          <span className="text-gray-300">|</span>
                                          <span className="text-purple-600">📊 {singleStats.tokensPerSecond.toLocaleString()} tok/s</span>
                                        </>
                                      )}
                                      <span className="text-gray-300">|</span>
                                      {routingInfo.route === "premium" ? (
                                        <span className="text-purple-600">💎 Premium</span>
                                      ) : (
                                        <span className="text-green-600">💰 {singleStats.savedPercent.toFixed(0)}% saved</span>
                                      )}
                                      <span className="text-gray-300">|</span>
                                      <span>
                                        {routingInfo.route === "ultra-fast" && "Simple query"}
                                        {routingInfo.route === "fast" && "Moderate query"}
                                        {routingInfo.route === "premium" && "Complex analysis"}
                                        {routingInfo.route === "code" && "Code detected"}
                                        {" → "}{routingInfo.modelName.split(":")[0].split(" ")[0]}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="font-medium text-gray-600">
                                        ⚡ {formatTTFT(singleStats.responseTimeMs)} TTFT
                                      </span>
                                      {singleStats.tokensPerSecond && (
                                        <span className="font-medium text-purple-600">
                                          📊 {singleStats.tokensPerSecond.toLocaleString()} tok/s
                                        </span>
                                      )}
                                      {singleStats.saved > 0 && (
                                        <span className="font-medium text-green-600">
                                          💰 {singleStats.savedPercent.toFixed(0)}% saved
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                          </Card>
                          
                          {/* Compete Button for Single Model (only show if no results yet) */}
                          {!competeResults.get(group.user.id) && (
                            <div className="flex justify-start">
                              <Button
                                onClick={() => handleCompete(group.user.id, false)}
                                disabled={competeLoadingForGroup === group.user.id}
                                variant="outline"
                                className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium"
                                data-testid="button-compete-single"
                              >
                                {competeLoadingForGroup === group.user.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Checking other models...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-4 h-4 mr-2" />
                                    Compete
                                  </>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Compete Results for Single Model */}
                          {competeResults.get(group.user.id)?.mode === "single" && (
                            <div className="space-y-4">
                              {/* Chairman's Synthesis */}
                              {competeResults.get(group.user.id)!.chairmanSynthesis && (
                                <Card className="p-6 bg-purple-50 border-purple-200" data-testid="card-chairman-synthesis">
                                  <h3 className="text-lg font-semibold mb-3 text-purple-900 flex items-center gap-2">
                                    📋 Chairman's Synthesis
                                  </h3>
                                  <div className="text-base leading-relaxed prose prose-sm max-w-none text-gray-900" data-testid="text-synthesis-content">
                                    <ReactMarkdown>{competeResults.get(group.user.id)!.chairmanSynthesis}</ReactMarkdown>
                                  </div>
                                </Card>
                              )}

                              {/* Compete Rankings Table - Single Model Mode */}
                              {(() => {
                                const results = competeResults.get(group.user.id)!.results;
                                const originalModel = competeResults.get(group.user.id)!.originalModelId;
                                
                                // Build comparison data with costStats from compete results
                                const comparisonData = results.map((result: any) => {
                                  const isOriginal = result.isOriginal || result.modelName === getModelDisplayName(originalModel || '');
                                  const stats = result.costStats || null;
                                  const rankValue = result.averageRank ?? (result.qualityScore ? (11 - result.qualityScore) : result.place);
                                  const valueRating = stats && stats.cost > 0 
                                    ? Math.min(5, Math.max(1, Math.round((9 - rankValue) / (stats.cost * 100) * 2)))
                                    : 3;
                                  return {
                                    ...result,
                                    stats,
                                    valueRating,
                                    isOriginal,
                                    displayRank: rankValue,
                                  };
                                });
                                
                                // Generate key insight for single mode
                                const claudeResult = results.find(r => r.modelName === "Claude Sonnet 4.5");
                                const claudeRank = claudeResult?.place || 6;
                                const originalResult = results.find(r => r.modelName === getModelDisplayName(originalModel || ''));
                                const originalRank = originalResult?.place || 6;
                                const cheapModels = results.filter(r => r.modelName !== "Claude Sonnet 4.5");
                                const cheapModelsBetterThanClaude = cheapModels.filter(r => r.place < claudeRank);
                                const topCheapModel = cheapModels.sort((a, b) => a.place - b.place)[0];
                                
                                return (
                                  <>
                                    <Card className="p-6 bg-white border-gray-200" data-testid="model-comparison-table-single">
                                      <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                                        {"\ud83c\udfc6"} Compete Rankings
                                      </h3>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b-2 border-gray-200">
                                              <th className="text-left py-3 px-2 font-semibold text-gray-700">Model</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Avg Rank</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">TTFT</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Throughput</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Cost</th>
                                              <th className="text-center py-3 px-2 font-semibold text-gray-700">Savings</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {comparisonData.map((item, idx) => {
                                              const latencyMs = item.stats?.responseTimeMs || 0;
                                              const throughput = item.stats?.tokensPerSecond || 0;
                                              const allTimes = comparisonData.filter(d => d.stats).map(d => ({ modelName: d.modelName, responseTimeMs: d.stats!.responseTimeMs }));
                                              const speedRank = allTimes.sort((a, b) => a.responseTimeMs - b.responseTimeMs).findIndex(t => t.modelName === item.modelName) + 1;
                                              const speedMedal = speedRank === 1 ? "🥇" : speedRank === 2 ? "🥈" : speedRank === 3 ? "🥉" : "";
                                              const claudeTime = allTimes.find(t => t.modelName === "Claude Sonnet 4.5")?.responseTimeMs || latencyMs;
                                              const isClaude = item.modelName === "Claude Sonnet 4.5";
                                              const isFaster = latencyMs < claudeTime * 0.95;
                                              const isSlower = latencyMs > claudeTime * 1.05;
                                              const fasterPercent = Math.round(((claudeTime - latencyMs) / claudeTime) * 100);
                                              const slowerPercent = Math.round(((latencyMs - claudeTime) / claudeTime) * 100);
                                              return (
                                              <tr 
                                                key={item.place} 
                                                className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${item.isOriginal ? 'ring-2 ring-blue-300 ring-inset' : ''}`}
                                                data-testid={`comparison-row-single-${item.place}`}
                                              >
                                                <td className="py-3 px-2">
                                                  <div className="flex items-center gap-2">
                                                    <span className="w-6">
                                                      {item.place === 1 ? "\ud83e\udd47" : item.place === 2 ? "\ud83e\udd48" : item.place === 3 ? "\ud83e\udd49" : ""}
                                                    </span>
                                                    <span className={`font-medium ${item.isOriginal ? 'text-blue-700' : 'text-gray-900'}`}>
                                                      {item.modelName}
                                                      {item.isOriginal && <span className="text-xs ml-1">(yours)</span>}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  <span className={`font-semibold ${item.displayRank <= 2 ? 'text-green-600' : item.displayRank <= 4 ? 'text-blue-600' : 'text-gray-600'}`}>
                                                    {item.displayRank.toFixed(1)}
                                                  </span>
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  {item.stats ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                      <span className="flex items-center gap-1 font-medium text-gray-700">
                                                        {speedMedal && <span>{speedMedal}</span>}
                                                        {formatTTFT(latencyMs)}
                                                      </span>
                                                      {isClaude ? (
                                                        <span className="text-xs text-blue-600">Baseline</span>
                                                      ) : isFaster ? (
                                                        <span className="text-xs text-green-600">⚡ {fasterPercent}% faster</span>
                                                      ) : isSlower ? (
                                                        <span className="text-xs text-red-500">🐢 {slowerPercent}% slower</span>
                                                      ) : null}
                                                    </div>
                                                  ) : "-"}
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  {throughput > 0 ? (
                                                    <span className="font-medium text-purple-600">
                                                      📊 {throughput.toLocaleString()} tok/s
                                                    </span>
                                                  ) : "-"}
                                                </td>
                                                <td className="text-center py-3 px-2 font-medium">
                                                  {item.stats ? formatCost(item.stats.cost) : "-"}
                                                </td>
                                                <td className="text-center py-3 px-2">
                                                  {item.stats && item.stats.savedPercent > 0 ? (
                                                    <span className="text-green-600 font-medium">
                                                      {item.stats.savedPercent.toFixed(0)}%
                                                    </span>
                                                  ) : item.stats ? (
                                                    <span className="text-gray-400">--</span>
                                                  ) : "-"}
                                                </td>
                                              </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </Card>

                                    {/* Key Insight Box - Single Mode */}
                                    {topCheapModel && (
                                      <Card className="p-6 bg-gradient-to-r from-amber-50 to-green-50 border-amber-200" data-testid="key-insight-box-single">
                                        <h3 className="text-lg font-semibold mb-3 text-amber-900 flex items-center gap-2">
                                          💡 Key Insight
                                        </h3>
                                        <div className="text-base leading-relaxed text-gray-800">
                                          {originalResult && originalRank === 1 ? (
                                            <>Your choice of <span className="font-semibold text-blue-700">{originalResult.modelName}</span> ranked <span className="font-bold text-amber-700">#1 in quality</span>!</>
                                          ) : originalResult && originalRank <= 3 ? (
                                            <>Your <span className="font-semibold text-blue-700">{originalResult.modelName}</span> ranked <span className="font-bold text-amber-700">#{originalRank}</span>. </>
                                          ) : (
                                            <><span className="font-semibold text-green-700">{topCheapModel.modelName}</span> ranked <span className="font-bold text-amber-700">#{topCheapModel.place} in quality</span>. </>
                                          )}
                                          {cheapModelsBetterThanClaude.length > 0 && (
                                            <><span className="font-semibold">{cheapModelsBetterThanClaude.length} of 7</span> budget models outranked Claude in blind peer review.</>
                                          )}
                                          {cheapModelsBetterThanClaude.length === 0 && claudeRank === 1 && (
                                            <>Claude ranked #1 in this comparison.</>
                                          )}
                                        </div>
                                      </Card>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                          );
                        })()
                      ) : null}
                    </div>
                  ));
                })()}
                
                {sendMessageMutation.isPending && selectedModel === "all-models" && (
                  // Loading state for All Models - show 6 cards
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {INDIVIDUAL_MODELS.map((model) => (
                      <Card key={model.id} className="p-4" data-testid={`loading-card-${model.id}`}>
                        <div className="text-xs font-semibold text-gray-700 mb-2">
                          {model.name}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {sendMessageMutation.isPending && selectedModel !== "all-models" && (
                  // Loading state for single model
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-[80%]">
                      <div className="text-xs text-gray-500 mb-1">
                        {getModelDisplayName(selectedModel) || "AI"}
                      </div>
                      <div className="flex items-center gap-2 text-base text-gray-400" data-testid="text-loading">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Input Area - Always at Bottom */}
        <div className="border-t border-gray-200 p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 border-gray-200 rounded-lg px-4 py-3"
              disabled={sendMessageMutation.isPending}
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              className="bg-gray-600 text-white hover:bg-gray-700 rounded-lg px-6 py-3"
              data-testid="button-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Session Stats Side Panel - Collapsible */}
      {sessionStatsExpanded && sessionStats.totalQueries > 0 && (
        <div className="w-[280px] border-l border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-gray-700">
                <BarChart3 className="w-4 h-4" />
                Session Stats
              </div>
              <button
                onClick={() => setSessionStatsExpanded(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label="Close stats panel"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-4 space-y-4">
            {/* Total Queries */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Queries</div>
              <div className="text-2xl font-bold text-gray-800">{sessionStats.totalQueries}</div>
            </div>
            
            {/* Avg TTFT */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg TTFT</div>
              <div className="text-2xl font-bold text-blue-600">{sessionStats.avgTTFT.toLocaleString()}ms</div>
            </div>
            
            {/* Avg Throughput */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Throughput</div>
              <div className="text-2xl font-bold text-purple-600">📊 {sessionStats.avgThroughput.toLocaleString()} tok/s</div>
            </div>
            
            {/* Total Cost */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Cost</div>
              <div className="text-2xl font-bold text-gray-800">{formatCost(sessionStats.totalCost)}</div>
            </div>
            
            {/* If All Claude */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">If All Claude</div>
              <div className="text-2xl font-bold text-gray-400">{formatCost(sessionStats.totalClaudeCost)}</div>
            </div>
            
            {/* Total Saved */}
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-600 uppercase tracking-wide mb-1">Total Saved</div>
              <div className="text-2xl font-bold text-green-600">{formatCost(sessionStats.totalSaved)}</div>
              <div className="text-lg font-semibold text-green-500">{Math.round(sessionStats.savedPercent)}% saved</div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-chat">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteChat}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
