import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Play, Loader2, Lock, Zap, Clock, DollarSign, Brain, Info, CheckCircle2, XCircle, Target, TrendingUp, AlertTriangle, Users, Trophy, MessageSquare, Bookmark, Library, Trash2, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Model {
  id: string;
  name: string;
  costPer1k: number;
  expectedLatency: "fast" | "medium" | "slow";
  reasoningDepth: "none" | "shallow" | "deep";
  expectedAccuracy: "basic" | "good" | "strong" | "excellent";
}

interface ModelResponse {
  content: string;
  loading: boolean;
  error: string | null;
  latency: number | null;
  cost: number | null;
  progress: number;
}

const COLUMNS = ["3B", "7B", "17B", "70B", "Frontier"] as const;

const NON_REASONING_MODELS: Record<string, Model> = {
  "3B": { id: "together/llama-3.2-3b-instruct-turbo", name: "Llama 3.2 3B", costPer1k: 0.00006, expectedLatency: "fast", reasoningDepth: "none", expectedAccuracy: "basic" },
  "7B": { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B", costPer1k: 0.0001, expectedLatency: "fast", reasoningDepth: "none", expectedAccuracy: "good" },
  "17B": { id: "together/llama-4-maverick-17b", name: "Llama 4 Maverick 17B", costPer1k: 0.0002, expectedLatency: "fast", reasoningDepth: "none", expectedAccuracy: "good" },
  "70B": { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Llama 3.3 70B", costPer1k: 0.0006, expectedLatency: "medium", reasoningDepth: "none", expectedAccuracy: "strong" },
  "Frontier": { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", costPer1k: 0.015, expectedLatency: "slow", reasoningDepth: "none", expectedAccuracy: "excellent" },
};

const REASONING_MODELS: Record<string, Model | null> = {
  "3B": null,
  "7B": null,
  "17B": null,
  "70B": { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", costPer1k: 0.002, expectedLatency: "slow", reasoningDepth: "deep", expectedAccuracy: "strong" },
  "Frontier": { id: "together/deepseek-r1", name: "DeepSeek R1", costPer1k: 0.003, expectedLatency: "slow", reasoningDepth: "deep", expectedAccuracy: "excellent" },
};

const CONTEXT_SIZES = [
  { value: "8k", tokens: 8000, label: "8K" },
  { value: "32k", tokens: 32000, label: "32K" },
  { value: "128k", tokens: 128000, label: "128K" },
  { value: "1m", tokens: 1000000, label: "1M" },
] as const;

const COLUMN_VISUALS: Record<string, {
  headerSize: string;
  headerBg: string;
  cardStyle: string;
  prominence: "small" | "medium" | "large";
  accentBorder: string;
}> = {
  "3B": {
    headerSize: "text-xl font-bold text-[#A3316F]",
    headerBg: "bg-[#fdf2f8]",
    cardStyle: "bg-white",
    prominence: "small",
    accentBorder: "border-t-[6px] border-t-[#A3316F]"
  },
  "7B": {
    headerSize: "text-xl font-bold text-blue-700",
    headerBg: "bg-blue-50",
    cardStyle: "bg-white",
    prominence: "small",
    accentBorder: "border-t-[6px] border-t-[#2563EB]"
  },
  "17B": {
    headerSize: "text-2xl font-extrabold text-blue-800",
    headerBg: "bg-blue-50",
    cardStyle: "bg-white",
    prominence: "medium",
    accentBorder: "border-t-[6px] border-t-[#2563EB]"
  },
  "70B": {
    headerSize: "text-2xl font-extrabold text-emerald-700",
    headerBg: "bg-emerald-50",
    cardStyle: "bg-white",
    prominence: "medium",
    accentBorder: "border-t-[6px] border-t-[#16A34A]"
  },
  "Frontier": {
    headerSize: "text-3xl font-black text-[#EA580C]",
    headerBg: "bg-orange-50",
    cardStyle: "bg-white",
    prominence: "large",
    accentBorder: "border-t-[6px] border-t-[#EA580C]"
  }
};

const getLatencyBarConfig = (latency: "fast" | "medium" | "slow") => {
  switch (latency) {
    case "fast": return { width: "w-full", color: "bg-emerald-500", label: "Fast" };
    case "medium": return { width: "w-[50%]", color: "bg-orange-400", label: "Medium" };
    case "slow": return { width: "w-[20%]", color: "bg-red-500", label: "Slow" };
  }
};

const getLatencyCategory = (latency: number): "fast" | "medium" | "slow" => {
  if (latency < 500) return "fast";
  if (latency < 2000) return "medium";
  return "slow";
};

const getCostVisuals = (_cost: number) => {
  return { size: "text-xs", color: "text-gray-500", style: "font-mono" };
};

const getCapabilityVisuals = (accuracy: "basic" | "good" | "strong" | "excellent") => {
  switch (accuracy) {
    case "basic": return { bars: 1, color: "bg-[#A3316F]", textColor: "text-[#A3316F]", label: "Basic" };
    case "good": return { bars: 2, color: "bg-blue-400", textColor: "text-blue-600", label: "Good" };
    case "strong": return { bars: 3, color: "bg-emerald-500", textColor: "text-emerald-600", label: "Strong" };
    case "excellent": return { bars: 4, color: "bg-[#f5a623]", textColor: "text-[#f5a623]", label: "Excellent" };
  }
};

const getCapabilityDescription = (accuracy: "basic" | "good" | "strong" | "excellent") => {
  switch (accuracy) {
    case "basic": return "Simple Q&A, basic tasks";
    case "good": return "Most everyday tasks";
    case "strong": return "Complex reasoning";
    case "excellent": return "Hardest problems";
  }
};

const getLatencyColor = (_latency?: "fast" | "medium" | "slow") => "text-gray-600";
const getLatencyLabel = (latency: "fast" | "medium" | "slow") => getLatencyBarConfig(latency).label;
const getCapabilityColor = (_accuracy?: "basic" | "good" | "strong" | "excellent") => "text-gray-600";
const getCapabilityLabel = (accuracy: "basic" | "good" | "strong" | "excellent") => getCapabilityVisuals(accuracy).label;

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ col: string; model: Model; response: ModelResponse } | null>(null);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [testRunCount, setTestRunCount] = useState(0);
  
  const [councilRunning, setCouncilRunning] = useState(false);
  const [councilResults, setCouncilResults] = useState<{
    consensusRankings: string[];
    councilEvaluations: Array<{
      judgeColumn: string;
      judgeName: string;
      rankings: Array<{ column: string; rank: number; critique: string }>;
      error?: string;
    }>;
    chairmanSynthesis: string | null;
    runId?: string;
  } | null>(null);
  const [showCouncilModal, setShowCouncilModal] = useState(false);
  const [showSaveBenchmarkModal, setShowSaveBenchmarkModal] = useState(false);
  const [benchmarkName, setBenchmarkName] = useState("");
  const [benchmarkDescription, setBenchmarkDescription] = useState("");
  
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [benchmarks, setBenchmarks] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    prompt: string;
    createdAt: string;
  }>>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareNickname, setShareNickname] = useState("");
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<Array<{
    id: string;
    displayName: string | null;
    prompt: string;
    recommendedModel: string | null;
    settings: { contextSize: string; costCap: number; reasoningEnabled: boolean } | null;
    results: Record<string, { latency: number; cost: number; modelName: string; modelId: string }> | null;
    createdAt: string;
  }>>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  
  const [contextSize, setContextSize] = useState<string>("128k");
  const [costCap, setCostCap] = useState<number>(0.25);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [expertMode, setExpertMode] = useState(false);

  const inputTokenEstimate = useMemo(() => {
    return Math.ceil(prompt.length / 4);
  }, [prompt]);

  const selectedContextTokens = CONTEXT_SIZES.find(c => c.value === contextSize)?.tokens || 128000;
  const inputPercentage = Math.min((inputTokenEstimate / selectedContextTokens) * 100, 100);

  const getModelForColumn = (col: string): Model | null => {
    if (reasoningEnabled) {
      return REASONING_MODELS[col];
    }
    return NON_REASONING_MODELS[col];
  };

  const estimateCost = (model: Model): number => {
    const estimatedTokens = Math.max(inputTokenEstimate, 100) + 500;
    return (estimatedTokens / 1000) * model.costPer1k;
  };

  const isModelDisabled = (col: string): { disabled: boolean; reason: string; warning?: string } => {
    const model = getModelForColumn(col);
    
    // Reasoning mode on small models truly doesn't work - can't override this
    if (!model) {
      return { disabled: true, reason: "Reasoning requires 70B+" };
    }
    
    // Check if input exceeds selected context window
    if (inputTokenEstimate > selectedContextTokens) {
      if (expertMode) {
        return { disabled: false, reason: "", warning: `Input exceeds ${contextSize.toUpperCase()} context` };
      }
      return { disabled: true, reason: `Input exceeds ${contextSize.toUpperCase()} context` };
    }
    
    // Check cost cap
    const cost = estimateCost(model);
    if (cost > costCap) {
      if (expertMode) {
        return { disabled: false, reason: "", warning: `Exceeds $${costCap.toFixed(2)} cap` };
      }
      return { disabled: true, reason: `Exceeds $${costCap.toFixed(2)} cap` };
    }
    
    return { disabled: false, reason: "" };
  };

  const getRecommendationReason = (col: string): React.ReactNode => {
    const model = getModelForColumn(col);
    if (!model) return "";
    
    const resp = responses[col];
    const actualCost = resp?.cost ?? 0;
    const actualLatency = resp?.latency ?? 0;
    const capability = getCapabilityVisuals(model.expectedAccuracy).label;
    
    // Get all completed models' costs rounded to display precision
    const completedModels = COLUMNS.filter(c => {
      const r = responses[c];
      const { disabled } = isModelDisabled(c);
      return !disabled && r && !r.loading && r.content && !r.error;
    });
    
    // Count how many models have the same rounded cost
    const roundedCost = Math.round(actualCost * 10000) / 10000;
    const modelsAtSameCost = completedModels.filter(c => {
      const r = responses[c];
      const cost = r?.cost ?? 0;
      return Math.round(cost * 10000) / 10000 === roundedCost;
    });
    
    const wasTieBreaker = modelsAtSameCost.length > 1;
    
    if (reasoningEnabled) {
      return (
        <div className="space-y-2">
          <p className="font-semibold">{model.name} is recommended because:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Cost: ${actualCost.toFixed(4)} (within your budget)</li>
            <li>Speed: {actualLatency}ms</li>
            <li>Capability: {capability}</li>
            <li>Reasoning Mode requires 70B+ parameters</li>
          </ul>
          <p className="text-sm text-gray-600 mt-2 italic">
            {col === "70B" 
              ? "This is the most affordable reasoning-capable model."
              : "70B was filtered out by your cost cap, so Frontier is the only reasoning option."}
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        <p className="font-semibold">{model.name} is recommended because:</p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Cost: ${actualCost.toFixed(4)} (within your budget)</li>
          <li>Speed: {actualLatency}ms{wasTieBreaker ? " (fastest at this price)" : ""}</li>
          <li>Capability: {capability}</li>
        </ul>
        <p className="text-sm text-gray-600 mt-2 italic">
          {wasTieBreaker 
            ? `${modelsAtSameCost.length} models cost $${roundedCost.toFixed(4)}, so we picked the fastest one.`
            : "This is the most affordable model that meets your constraints."}
        </p>
      </div>
    );
  };

  // Check if all models have completed running
  const allModelsComplete = useMemo(() => {
    if (!showResults) return false;
    const responseCols = Object.keys(responses);
    if (responseCols.length === 0) return false;
    
    // All models must have finished loading (not loading and either have content or error)
    return responseCols.every(col => {
      const resp = responses[col];
      return resp && !resp.loading && (resp.content || resp.error);
    });
  }, [showResults, responses]);

  // Recommendation logic: find the CHEAPEST model that fits constraints, tie-break by FASTEST latency
  // ONLY shows after all models have completed
  const recommendedModel = useMemo(() => {
    // Don't show recommendation until all models have completed
    if (!allModelsComplete) return null;
    
    // Get all columns that have successful responses
    const completedModels = COLUMNS.filter(col => {
      const resp = responses[col];
      const { disabled } = isModelDisabled(col);
      // Must not be disabled, must have a response, must not have error
      return !disabled && resp && !resp.loading && resp.content && !resp.error;
    });
    
    if (completedModels.length === 0) return null;
    
    // If Reasoning Mode is ON, only consider 70B and Frontier
    let candidates = completedModels;
    if (reasoningEnabled) {
      candidates = completedModels.filter(m => m === "70B" || m === "Frontier");
      if (candidates.length === 0) return null;
    }
    
    // Sort by actual cost (ascending), then by actual latency (ascending) to break ties
    // Round costs to 4 decimal places (what's displayed) so visually-equal costs trigger latency tie-break
    const sorted = [...candidates].sort((a, b) => {
      const respA = responses[a];
      const respB = responses[b];
      const costA = respA?.cost ?? Infinity;
      const costB = respB?.cost ?? Infinity;
      
      // Round to 4 decimal places (display precision) for comparison
      const roundedCostA = Math.round(costA * 10000) / 10000;
      const roundedCostB = Math.round(costB * 10000) / 10000;
      
      // First sort by rounded cost
      if (roundedCostA !== roundedCostB) {
        return roundedCostA - roundedCostB;
      }
      
      // If costs are equal at display precision, sort by latency (faster is better)
      const latencyA = respA?.latency ?? Infinity;
      const latencyB = respB?.latency ?? Infinity;
      return latencyA - latencyB;
    });
    
    return sorted[0] || null;
  }, [allModelsComplete, responses, reasoningEnabled, costCap, contextSize, inputTokenEstimate]);

  const handleRunAll = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setShowResults(true);

    const modelsToRun: { col: string; model: Model }[] = [];
    COLUMNS.forEach(col => {
      const model = getModelForColumn(col);
      if (model && !isModelDisabled(col).disabled) {
        modelsToRun.push({ col, model });
      }
    });

    const initialResponses: Record<string, ModelResponse> = {};
    modelsToRun.forEach(({ col }) => {
      initialResponses[col] = { content: "", loading: true, error: null, latency: null, cost: null, progress: 0 };
    });
    setResponses(initialResponses);

    const runModel = async (col: string, model: Model) => {
      try {
        const response = await fetch("/api/wind-tunnel/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: model.id, prompt: prompt }),
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let tokenCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "token") {
                accumulatedContent += data.content;
                tokenCount = data.tokenCount;
                
                const estimatedProgress = Math.min((tokenCount / 100) * 100, 95);
                
                setResponses((prev) => ({
                  ...prev,
                  [col]: {
                    ...prev[col],
                    content: accumulatedContent,
                    progress: estimatedProgress,
                  },
                }));
              } else if (data.type === "complete") {
                setResponses((prev) => ({
                  ...prev,
                  [col]: {
                    content: data.content,
                    loading: false,
                    error: null,
                    latency: data.latency,
                    cost: data.cost,
                    progress: 100,
                  },
                }));
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      } catch (err: any) {
        setResponses((prev) => ({
          ...prev,
          [col]: {
            content: "",
            loading: false,
            error: err.message || "Failed",
            latency: null,
            cost: null,
            progress: 0,
          },
        }));
      }
    };

    await Promise.all(modelsToRun.map(({ col, model }) => runModel(col, model)));
    setIsRunning(false);
    setTestRunCount(prev => prev + 1);
  };

  const openModal = (col: string, model: Model, response: ModelResponse) => {
    if (response.content || response.error) {
      setSelectedModel({ col, model, response });
    }
  };

  const handleRunCouncil = async () => {
    if (!allModelsComplete || councilRunning) return;
    
    setCouncilRunning(true);
    setCouncilResults(null);
    
    try {
      const responseData: Record<string, { content: string; modelId: string; modelName: string; latency: number; cost: number }> = {};
      
      COLUMNS.forEach(col => {
        const model = getModelForColumn(col);
        const resp = responses[col];
        if (model && resp?.content && !resp.error) {
          responseData[col] = {
            content: resp.content,
            modelId: model.id,
            modelName: model.name,
            latency: resp.latency || 0,
            cost: resp.cost || 0,
          };
        }
      });
      
      const response = await apiRequest("POST", "/api/council/run", {
        prompt,
        responses: responseData,
        settings: {
          contextSize,
          costCap,
          reasoningEnabled,
        },
      });
      
      const result = await response.json();
      setCouncilResults(result);
      setShowCouncilModal(true);
    } catch (err: any) {
      console.error("Council error:", err);
      alert("Failed to run council: " + err.message);
    } finally {
      setCouncilRunning(false);
    }
  };

  const handleSaveBenchmark = async () => {
    if (!benchmarkName.trim()) {
      alert("Please enter a name for the benchmark");
      return;
    }
    
    try {
      await apiRequest("POST", "/api/benchmarks", {
        name: benchmarkName,
        description: benchmarkDescription || null,
        prompt,
      });
      
      setShowSaveBenchmarkModal(false);
      setBenchmarkName("");
      setBenchmarkDescription("");
      alert("Benchmark saved successfully!");
    } catch (err: any) {
      console.error("Save benchmark error:", err);
      alert("Failed to save benchmark: " + err.message);
    }
  };

  const loadBenchmarks = async () => {
    setLibraryLoading(true);
    try {
      const response = await apiRequest("GET", "/api/benchmarks");
      const data = await response.json();
      setBenchmarks(data);
    } catch (err: any) {
      console.error("Load benchmarks error:", err);
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleOpenLibrary = async () => {
    setShowLibraryModal(true);
    await loadBenchmarks();
  };

  const handleLoadBenchmark = (benchmarkPrompt: string) => {
    setPrompt(benchmarkPrompt);
    setShowLibraryModal(false);
    setShowResults(false);
    setResponses({});
    setCouncilResults(null);
  };

  const handleDeleteBenchmark = async (id: string) => {
    if (!confirm("Delete this benchmark?")) return;
    
    try {
      await apiRequest("DELETE", `/api/benchmarks/${id}`);
      await loadBenchmarks();
    } catch (err: any) {
      console.error("Delete benchmark error:", err);
      alert("Failed to delete benchmark: " + err.message);
    }
  };

  const handleShareToLeaderboard = async () => {
    if (!allModelsComplete || shareSubmitting) return;
    
    setShareSubmitting(true);
    
    try {
      const resultsData: Record<string, { latency: number; cost: number; modelName: string; modelId: string }> = {};
      
      COLUMNS.forEach(col => {
        const model = getModelForColumn(col);
        const resp = responses[col];
        if (model && resp?.content && !resp.error) {
          resultsData[col] = {
            latency: resp.latency || 0,
            cost: resp.cost || 0,
            modelName: model.name,
            modelId: model.id,
          };
        }
      });
      
      await apiRequest("POST", "/api/leaderboard", {
        displayName: shareNickname.trim() || null,
        prompt,
        recommendedModel,
        settings: {
          contextSize,
          costCap,
          reasoningEnabled,
        },
        results: resultsData,
      });
      
      setShowShareModal(false);
      setShareNickname("");
      alert("Shared to leaderboard!");
    } catch (err: any) {
      console.error("Share to leaderboard error:", err);
      alert("Failed to share: " + err.message);
    } finally {
      setShareSubmitting(false);
    }
  };

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const response = await apiRequest("GET", "/api/leaderboard");
      const data = await response.json();
      setLeaderboardEntries(data);
    } catch (err: any) {
      console.error("Load leaderboard error:", err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleOpenLeaderboard = async () => {
    setShowLeaderboardModal(true);
    await loadLeaderboard();
  };

  const getReasoningDepthLabel = (depth: "none" | "shallow" | "deep") => {
    switch (depth) {
      case "none": return "No Reasoning";
      case "shallow": return "Shallow";
      case "deep": return "Deep Reasoning";
    }
  };

  return (
    <TooltipProvider>
      <div className="bg-white text-gray-900">
        <div className="w-full px-4 sm:px-[72px] pt-4 sm:pt-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-[#1a3a8f] tracking-tight">
                EPHOR WIND TUNNEL
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Learn to think like an AI engineer: balance speed, cost, and capability.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenLeaderboard}
                className="w-[130px] px-4 py-2 bg-[#f5a623] text-white rounded-lg text-sm font-bold hover:bg-[#e09000] flex items-center justify-center gap-2 shadow-sm"
              >
                <span className="text-lg">🏆</span>
                Leaderboard
              </button>
              <button
                onClick={handleOpenLibrary}
                className="w-[130px] px-4 py-2 bg-[#1a3a8f] text-white rounded-lg text-sm font-bold hover:bg-[#2a4a9f] flex items-center justify-center gap-2 shadow-sm"
              >
                <Library className="w-4 h-4" />
                Library
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-2 mb-6 border border-gray-200 shadow-sm">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt to test across all model sizes..."
              className="w-full h-[60px] resize-none bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm"
              disabled={isRunning}
            />
            
            <div className={`mt-2 p-2.5 rounded-lg border ${
              inputTokenEstimate > selectedContextTokens 
                ? 'bg-red-50 border-red-300' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-900">INPUT GAUGE</span>
                  {inputTokenEstimate > selectedContextTokens && (
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold">
                      OVERFLOW
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm font-bold ${
                    inputTokenEstimate > selectedContextTokens ? 'text-red-600' : 'text-gray-900'
                  }`}>{inputTokenEstimate.toLocaleString()}</span>
                  <span className="text-gray-400">/</span>
                  <span className="font-mono text-sm text-gray-600">{selectedContextTokens.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">tokens</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    inputTokenEstimate > selectedContextTokens ? 'bg-red-500 text-white' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {inputTokenEstimate > selectedContextTokens ? 'OVERFLOW!' : `${inputPercentage.toFixed(1)}%`}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    inputTokenEstimate > selectedContextTokens ? 'bg-red-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(inputPercentage, 2), 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-gray-500" />
                  <span className="font-bold text-gray-900 text-sm">Context Window</span>
                </div>
                {(contextSize === "128k" || contextSize === "1m") && (
                  <span className="text-xs px-2 py-0.5 rounded font-medium border border-gray-300 text-gray-600">
                    {contextSize === "1m" ? "Max Cost" : "Higher Cost"}
                  </span>
                )}
              </div>
              <Select value={contextSize} onValueChange={setContextSize} disabled={isRunning}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {CONTEXT_SIZES.map(size => (
                    <SelectItem key={size.value} value={size.value} className="text-gray-900 hover:bg-gray-100">
                      {size.label} tokens
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="font-bold text-gray-900 text-sm">Max Cost Per Query</span>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[costCap]}
                  onValueChange={([val]) => setCostCap(val)}
                  min={0}
                  max={0.25}
                  step={0.01}
                  className="flex-1"
                  disabled={isRunning}
                />
                <span className="font-mono text-sm font-bold text-gray-900">
                  ${costCap.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-500" />
                  <span className="font-bold text-gray-900 text-sm">Reasoning Mode</span>
                </div>
                {reasoningEnabled && (
                  <span className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 font-medium">
                    3-5x Cost
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={reasoningEnabled}
                  onCheckedChange={setReasoningEnabled}
                  disabled={isRunning}
                />
                <span className={`text-sm font-bold ${reasoningEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                  {reasoningEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={expertMode}
                    onCheckedChange={setExpertMode}
                    disabled={isRunning}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <span className={`text-sm font-medium ${expertMode ? 'text-amber-600' : 'text-gray-400'}`}>
                    Expert Mode
                  </span>
                  {expertMode && (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-white border-gray-200 text-gray-700 max-w-xs">
                <p className="font-bold">Override Constraints</p>
                <p className="text-xs mt-1">Run models even if they exceed your cost cap or context limit. Helps you see what happens when you ignore the rules!</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <button
            onClick={handleRunAll}
            disabled={!prompt.trim() || isRunning}
            className="w-full py-3 text-sm sm:text-base font-bold mb-6 rounded-lg flex items-center justify-center gap-2 text-white disabled:cursor-not-allowed hover:brightness-110 transition-all"
            style={{ backgroundColor: (!prompt.trim() || isRunning) ? '#2a4a9f' : '#1a3a8f' }}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 animate-spin" />
                Testing All Models...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Run Wind Tunnel Test
              </>
            )}
          </button>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[700px] sm:min-w-0">
                <div className="grid grid-cols-5 border-b border-gray-200">
                  {COLUMNS.map(col => {
                    const model = getModelForColumn(col);
                    const isRecommended = showResults && col === recommendedModel;
                    const visuals = COLUMN_VISUALS[col];
                    return (
                      <div 
                        key={col} 
                        className={`p-3 sm:p-4 text-center ${visuals.accentBorder} ${isRecommended ? 'bg-[#fff8eb]' : visuals.headerBg} ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}`}
                      >
                        <div className={`${visuals.headerSize} tracking-tight`}>{col}</div>
                        <div className={`text-xs font-semibold mt-0.5 ${col === 'Frontier' ? 'text-[#EA580C]' : col === '70B' ? 'text-emerald-600' : col === '3B' ? 'text-[#A3316F]' : 'text-blue-600'}`}>
                          {col === "Frontier" ? "Closed Source" : "Open Source"}
                        </div>
                        {isRecommended && (
                          <div className="mt-1.5 flex flex-col items-center gap-1">
                            <div className="inline-block px-2 py-0.5 bg-[#f5a623] text-white text-xs font-black rounded-full shadow-[0_0_12px_rgba(245,166,35,0.5)]">
                              ★ PICK
                            </div>
                            <button 
                              onClick={() => setShowWhyModal(true)}
                              className="text-[10px] text-[#f5a623] hover:text-[#d4890f] font-semibold flex items-center gap-0.5 hover:underline"
                            >
                              <Info className="w-3 h-3" />
                              Why?
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-5">
                  {COLUMNS.map(col => {
                    const model = getModelForColumn(col);
                    const { disabled, reason, warning } = isModelDisabled(col);
                    const response = responses[col];
                    const isLoading = response?.loading;
                    const hasError = response?.error;
                    const hasContent = response?.content;
                    const isRecommended = showResults && col === recommendedModel;

                    if (disabled) {
                      const isReasoningLocked = !model;
                      return (
                        <Tooltip key={col}>
                          <TooltipTrigger asChild>
                            <div className={`p-3 min-h-[280px] flex flex-col items-center justify-center bg-gray-50 ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}`}>
                              <Lock className="w-5 h-5 sm:w-6 sm:h-6 mb-2 text-gray-400" />
                              <span className="text-xs sm:text-sm font-medium text-gray-400 text-center">
                                {isReasoningLocked ? "Reasoning" : model?.name}
                              </span>
                              <span className="text-xs text-gray-400 text-center mt-1">
                                {reason}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white border-gray-200 text-gray-700">
                            <p>{reason}</p>
                            {isReasoningLocked && (
                              <p className="text-xs text-gray-500 mt-1">
                                Small models produce unreliable reasoning chains.
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    const cardVisuals = COLUMN_VISUALS[col];
                    const latencyConfig = getLatencyBarConfig(model!.expectedLatency);
                    const capabilityConfig = getCapabilityVisuals(model!.expectedAccuracy);
                    const estimatedCost = estimateCost(model!);
                    const costConfig = getCostVisuals(estimatedCost);

                    const hasResults = hasContent || isLoading || hasError;
                    
                    return (
                      <div
                        key={col}
                        onClick={() => response && hasContent && openModal(col, model!, response)}
                        className={`
                          p-3 transition-all flex flex-col overflow-hidden
                          ${hasResults ? 'min-h-[260px]' : 'min-h-[140px]'}
                          ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}
                          ${cardVisuals.cardStyle}
                          ${cardVisuals.accentBorder}
                          ${isRecommended ? 'ring-2 ring-[#f5a623] ring-offset-1 bg-[#fffbf5]' : ''}
                          ${isLoading ? 'bg-gray-50/80' : ''}
                          ${hasError ? 'bg-red-50' : ''}
                          ${hasContent ? 'cursor-pointer hover:brightness-[0.98]' : ''}
                        `}
                      >
                        <div className="text-center mb-3">
                          <span className={`font-bold text-gray-900 text-base ${cardVisuals.prominence === 'large' ? 'text-[#1a3a8f]' : ''}`}>
                            {model!.name}
                          </span>
                          {reasoningEnabled && (col === "70B" || col === "Frontier") && (
                            <span className="ml-1 sm:ml-2 text-xs bg-[#1a3a8f]/10 text-[#1a3a8f] px-1 sm:px-2 py-0.5 rounded font-bold">
                              DEEP
                            </span>
                          )}
                          {warning && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-2 inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  OVERRIDE
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-white border-gray-200 text-gray-700">
                                <p className="font-bold text-amber-600">Expert Mode Override</p>
                                <p className="text-xs mt-1">{warning}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {!hasResults && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium">
                                <DollarSign className="w-4 h-4" /> Est. Cost
                              </span>
                              <span className="font-mono text-sm text-gray-700">
                                ${estimatedCost.toFixed(4)}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium">
                                <Target className="w-4 h-4" /> Capability
                              </span>
                              <span className={`text-sm font-bold ${capabilityConfig.textColor}`}>
                                {capabilityConfig.label}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium">
                                <Clock className="w-4 h-4" /> Speed
                              </span>
                              <span className="text-sm text-gray-500 italic">
                                Run test to measure
                              </span>
                            </div>
                          </div>
                        )}


                        {isLoading && (
                          <div className="text-center py-2 mt-auto">
                            <div className="relative w-16 h-16 mx-auto">
                              <svg className="w-full h-full transform -rotate-90 animate-pulse" viewBox="0 0 64 64">
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  className="text-gray-200"
                                />
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  strokeDasharray={175.9}
                                  strokeDashoffset={175.9 - (response.progress / 100) * 175.9}
                                  className={`transition-all duration-300 ${
                                    cardVisuals.prominence === 'large' ? 'text-[#1a3a8f]' : 
                                    cardVisuals.prominence === 'medium' ? 'text-blue-500' : 
                                    'text-emerald-500'
                                  }`}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-sm font-mono font-bold ${
                                  cardVisuals.prominence === 'large' ? 'text-[#1a3a8f]' : 'text-gray-700'
                                }`}>
                                  {Math.round(response.progress)}%
                                </span>
                              </div>
                            </div>
                            <p className={`text-xs mt-2 font-medium ${
                              cardVisuals.prominence === 'large' ? 'text-[#1a3a8f]' : 'text-gray-500'
                            }`}>Processing...</p>
                          </div>
                        )}

                    {hasError && (
                      <div className="text-center py-4">
                        <XCircle className="w-10 h-10 mx-auto text-red-500 mb-2" />
                        <p className="text-xs text-red-600 font-medium">{response.error}</p>
                      </div>
                    )}

                    {hasContent && (() => {
                      const actualLatencyCategory = getLatencyCategory(response.latency || 0);
                      const actualLatencyConfig = getLatencyBarConfig(actualLatencyCategory);
                      const actualCostConfig = getCostVisuals(response.cost || 0);
                      return (
                        <div className="flex flex-col flex-grow">
                          <div className="flex items-center justify-center mb-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              actualLatencyCategory === 'fast' ? 'bg-emerald-100' :
                              actualLatencyCategory === 'medium' ? 'bg-orange-100' : 'bg-red-100'
                            }`}>
                              <CheckCircle2 className={`w-6 h-6 ${
                                actualLatencyCategory === 'fast' ? 'text-emerald-600' :
                                actualLatencyCategory === 'medium' ? 'text-orange-500' : 'text-red-500'
                              }`} />
                            </div>
                          </div>
                          
                          <div className="mb-3 space-y-2">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-500">Latency</span>
                                <span className={`font-mono font-bold ${actualLatencyConfig.color.replace('bg-', 'text-')}`}>
                                  {response.latency}ms
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${actualLatencyConfig.width} ${actualLatencyConfig.color} rounded-full`}></div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">Cost</span>
                              <span className={`font-mono ${actualCostConfig.size} ${actualCostConfig.color} ${actualCostConfig.style}`}>
                                ${response.cost?.toFixed(4)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words flex-grow overflow-hidden line-clamp-4">
                            {response.content}
                          </div>
                          <p className="text-xs text-[#1a3a8f] font-bold mt-2 hover:underline text-center cursor-pointer">
                            View Full Response →
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
                </div>
              </div>
            </div>
          </div>

          {/* Run Again teaching prompt - shows after first test completes */}
          {testRunCount === 1 && !isRunning && (
            <div className="text-center py-4 animate-fade-in">
              <p className="text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-default">
                🔁 Run the test again — what changes?
              </p>
            </div>
          )}

          {/* Inline Pareto Chart - shows after running tests */}
          {COLUMNS.some(col => responses[col]?.content) && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span className="font-bold text-sm text-gray-900">Cost vs Capability</span>
                <span className="text-xs text-gray-500">— The Pareto Frontier</span>
              </div>
              
              <div className="relative h-[180px] border-l-2 border-b-2 border-gray-300 ml-8">
                {/* Y-axis label */}
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-500 font-medium whitespace-nowrap">
                  Capability →
                </div>
                
                {/* X-axis label */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 font-medium">
                  Cost →
                </div>
                
                {/* Plot the 5 models */}
                {COLUMNS.map(col => {
                  const model = getModelForColumn(col);
                  if (!model) return null;
                  
                  const { disabled } = isModelDisabled(col);
                  const isRecommended = showResults && col === recommendedModel;
                  const hasResult = responses[col]?.content;
                  
                  // Map capability to Y position (0-100%)
                  const capabilityMap: Record<string, number> = {
                    "basic": 15,
                    "good": 40,
                    "strong": 65,
                    "excellent": 90
                  };
                  const yPos = 100 - capabilityMap[model.expectedAccuracy];
                  
                  // Map cost to X position (logarithmic scale for better distribution)
                  const cost = estimateCost(model);
                  const minCost = 0.00005;
                  const maxCost = 0.015;
                  const logMin = Math.log(minCost);
                  const logMax = Math.log(maxCost);
                  const xPos = ((Math.log(Math.max(cost, minCost)) - logMin) / (logMax - logMin)) * 85 + 5;
                  
                  return (
                    <div
                      key={col}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                      style={{ left: `${xPos}%`, top: `${yPos}%` }}
                    >
                      <div 
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          isRecommended 
                            ? 'bg-[#f5a623] border-[#f5a623] shadow-[0_0_8px_rgba(245,166,35,0.6)] scale-125' 
                            : disabled
                              ? 'bg-gray-200 border-gray-300'
                              : hasResult
                                ? 'bg-[#1a3a8f] border-[#1a3a8f]'
                                : 'bg-gray-400 border-gray-500'
                        }`}
                      />
                      <span className={`text-[10px] mt-1 font-bold ${
                        isRecommended ? 'text-[#f5a623]' : disabled ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {col}
                      </span>
                    </div>
                  );
                })}
                
                {/* Pareto frontier line (approximate) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                  <path
                    d="M 5,85 Q 25,60 45,40 T 90,10"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
              </div>
              
              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#f5a623] border border-[#f5a623]"></div>
                  <span>Recommended</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#1a3a8f] border border-[#1a3a8f]"></div>
                  <span>Tested</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300"></div>
                  <span>Disabled</span>
                </div>
              </div>
            </div>
          )}

          {showResults && allModelsComplete && (
            <div className="mt-6 p-4 bg-gradient-to-r from-[#1a3a8f]/5 to-[#f5a623]/5 rounded-lg border border-gray-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1a3a8f]" />
                    Model Council
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Have all 5 models judge each other's responses. Find the true best answer.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowSaveBenchmarkModal(true)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Bookmark className="w-4 h-4" />
                        Save
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white border-gray-200 text-gray-700">
                      Save this prompt as a benchmark to rerun later
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowShareModal(true)}
                        className="px-4 py-2 border border-emerald-500 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-50 flex items-center gap-2"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Share
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white border-gray-200 text-gray-700">
                      Share this result to the public leaderboard
                    </TooltipContent>
                  </Tooltip>
                  <button
                    onClick={handleRunCouncil}
                    disabled={councilRunning}
                    className="px-6 py-2 bg-[#1a3a8f] text-white rounded-lg text-sm font-bold hover:bg-[#2a4a9f] disabled:opacity-50 flex items-center gap-2"
                  >
                    {councilRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running Council...
                      </>
                    ) : (
                      <>
                        <Trophy className="w-4 h-4" />
                        Run Council (~$0.50-2.00)
                      </>
                    )}
                  </button>
                </div>
              </div>
              {councilResults && (
                <button
                  onClick={() => setShowCouncilModal(true)}
                  className="mt-3 w-full py-2 bg-[#f5a623]/10 border border-[#f5a623] rounded-lg text-sm font-medium text-[#f5a623] hover:bg-[#f5a623]/20 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  View Council Results
                </button>
              )}
            </div>
          )}

        </div>

        <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 text-xs sm:text-sm font-mono">
                  {selectedModel?.col}
                </span>
                <span className="text-base sm:text-xl">{selectedModel?.model.name}</span>
                {selectedModel?.model.reasoningDepth === "deep" && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
                    Deep Reasoning
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4">
              {selectedModel?.response.latency && (
                <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-center">
                    <div className="text-gray-500 text-xs mb-1">Response Time</div>
                    <div className={`font-mono text-sm sm:text-lg font-bold ${
                      'text-gray-900'
                    }`}>
                      {selectedModel.response.latency}ms
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-xs mb-1">Cost</div>
                    <div className="font-mono text-sm sm:text-lg font-bold text-gray-900">
                      ${selectedModel.response.cost?.toFixed(4)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-xs mb-1">Length</div>
                    <div className="font-mono text-sm sm:text-lg font-bold text-gray-900">
                      {selectedModel.response.content.length}
                    </div>
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-[#1a3a8f] mb-2">Response:</div>
                {selectedModel?.response.error ? (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
                    <p className="text-red-600 font-medium">{selectedModel.response.error}</p>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 max-h-[400px] overflow-y-auto">
                    {selectedModel?.response.content}
                  </pre>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showWhyModal} onOpenChange={setShowWhyModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <Info className="w-5 h-5 text-[#1a3a8f]" />
                <span className="text-[#1a3a8f]">Why This Model?</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {recommendedModel ? (
                <>
                  <div className="p-4 bg-[#f5a623]/10 border-2 border-[#f5a623] rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[#f5a623] font-black text-lg">★ Recommended: {getModelForColumn(recommendedModel)?.name}</span>
                      <span className="text-gray-500">({recommendedModel})</span>
                      {getModelForColumn(recommendedModel) && (
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${getCapabilityColor(getModelForColumn(recommendedModel)!.expectedAccuracy)}`}>
                          {getCapabilityLabel(getModelForColumn(recommendedModel)!.expectedAccuracy)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2 font-medium">
                      {getRecommendationReason(recommendedModel)}
                    </p>
                    {getModelForColumn(recommendedModel) && (
                      <div className="text-xs text-gray-600 flex items-center gap-4 pt-2 border-t border-gray-200 font-medium">
                        <span>Estimated Capability: <strong>{getCapabilityLabel(getModelForColumn(recommendedModel)!.expectedAccuracy)}</strong></span>
                        <span>Cost: <strong>${estimateCost(getModelForColumn(recommendedModel)!).toFixed(4)}</strong></span>
                        <span>Latency: <strong>{getLatencyLabel(getModelForColumn(recommendedModel)!.expectedLatency)}</strong></span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-bold text-[#1a3a8f] text-sm sm:text-base">Your Current Settings:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-500 mb-1">Budget Limit</div>
                        <div className="font-mono text-lg text-gray-900">
                          ${costCap.toFixed(2)}/query
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {costCap < 0.05 ? "Strict budget - smaller models only" : 
                           costCap < 0.15 ? "Moderate budget - mid-tier models available" : 
                           "High budget - all models available"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-500 mb-1">Context Window</div>
                        <div className="font-mono text-lg text-gray-900">{contextSize.toUpperCase()}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {contextSize === "8k" ? "Small context - cheaper but limited memory" :
                           contextSize === "32k" ? "Medium context - good balance" :
                           contextSize === "128k" ? "Large context - more memory, higher cost" :
                           "Maximum context - highest cost"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-500 mb-1">Reasoning Mode</div>
                        <div className={`text-lg ${reasoningEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                          {reasoningEnabled ? 'ENABLED' : 'OFF'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {reasoningEnabled 
                            ? "Deep thinking enabled. Only 70B+ models support this."
                            : "Standard mode. All model sizes available."}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-500 mb-1">Your Input Size</div>
                        <div className="font-mono text-lg text-gray-900">{inputTokenEstimate.toLocaleString()} tokens</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {inputTokenEstimate < 100 ? "Simple query - small models work well" :
                           inputTokenEstimate < 500 ? "Moderate query - consider 7B-17B" :
                           "Complex query - larger models recommended"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-gray-500" />
                      Engineering Truths
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex gap-3">
                        <span className="text-gray-400 text-lg">●</span>
                        <div>
                          <strong className="text-gray-900">Bigger ≠ Always Better</strong>
                          <p className="text-gray-600">Cost rises exponentially with model size. A 70B model costs ~10x more than 7B, but isn't 10x better.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-gray-400 text-lg">●</span>
                        <div>
                          <strong className="text-gray-900">Reasoning Requires Scale</strong>
                          <p className="text-gray-600">Small models (3B-17B) cannot do deep reasoning reliably. Only 70B+ models have enough parameters for chain-of-thought.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-gray-400 text-lg">●</span>
                        <div>
                          <strong className="text-gray-900">Context = Memory = Cost</strong>
                          <p className="text-gray-600">Longer context windows use more GPU memory. Processing 1M tokens costs much more than 8K tokens.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-gray-400 text-lg">●</span>
                        <div>
                          <strong className="text-gray-900">Speed vs Accuracy Tradeoff</strong>
                          <p className="text-gray-600">Fast models (3B-7B) respond quickly but make more mistakes. Slow models (70B+) are more accurate but take longer.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-2">Available Models:</h4>
                    <div className="space-y-2">
                      {COLUMNS.map(col => {
                        const model = getModelForColumn(col);
                        const { disabled, reason } = isModelDisabled(col);
                        return (
                          <div key={col} className={`flex items-center justify-between p-2 rounded border ${
                            col === recommendedModel ? 'bg-[#f5a623]/10 border-[#f5a623]' : 
                            disabled ? 'bg-gray-100 opacity-50 border-gray-200' : 'bg-white border-gray-200'
                          }`}>
                            <div className="flex items-center gap-2">
                              {col === recommendedModel && <span className="text-[#f5a623] font-bold">★</span>}
                              {disabled && <Lock className="w-3 h-3 text-gray-400" />}
                              <span className={disabled ? 'text-gray-400' : 'text-gray-900 font-medium'}>
                                {model?.name || `${col} (disabled)`}
                              </span>
                            </div>
                            <div className="text-xs">
                              {disabled ? (
                                <span className="text-red-500 font-medium">{reason}</span>
                              ) : (
                                <span className="text-gray-700 font-mono font-bold">${estimateCost(model!).toFixed(4)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  <p className="text-gray-900 font-bold mb-2">
                    No models fit your current constraints
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Your settings have filtered out all available models. Try one of these:
                  </p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>Increase the <strong>Max Cost Per Query</strong> slider</li>
                    {reasoningEnabled && <li>Turn off <strong>Reasoning Mode</strong> to access cheaper models</li>}
                    {inputPercentage > 100 && <li>Choose a larger <strong>Context Window</strong> or shorten your input</li>}
                  </ul>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showCouncilModal} onOpenChange={setShowCouncilModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <Trophy className="w-5 h-5 text-[#f5a623]" />
                <span className="text-[#1a3a8f]">Model Council Results</span>
              </DialogTitle>
            </DialogHeader>
            {councilResults && (
              <div className="space-y-6">
                <div className="p-4 bg-gradient-to-r from-[#f5a623]/10 to-[#f5a623]/5 border-2 border-[#f5a623] rounded-lg">
                  <h4 className="font-bold text-[#f5a623] mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Consensus Rankings (by peer vote)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {councilResults.consensusRankings.map((col, idx) => {
                      const model = getModelForColumn(col);
                      return (
                        <div 
                          key={col}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                            idx === 0 ? 'bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]' :
                            idx === 1 ? 'bg-gray-100 border-gray-300 text-gray-700' :
                            idx === 2 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                            'bg-gray-50 border-gray-200 text-gray-500'
                          }`}
                        >
                          <span className="font-black text-lg">#{idx + 1}</span>
                          <span className="font-bold">{model?.name || col}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {councilResults.chairmanSynthesis && (
                  <div className="p-4 bg-[#1a3a8f]/5 border border-[#1a3a8f]/30 rounded-lg">
                    <h4 className="font-bold text-[#1a3a8f] mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Chairman Synthesis (Claude's final answer)
                    </h4>
                    <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg border border-gray-200 text-gray-800 max-h-[300px] overflow-y-auto">
                      {councilResults.chairmanSynthesis}
                    </pre>
                  </div>
                )}

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Individual Judge Critiques
                  </h4>
                  <div className="space-y-4">
                    {councilResults.councilEvaluations.map((evaluation, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                            {evaluation.judgeColumn}
                          </span>
                          {evaluation.judgeName}
                        </div>
                        {evaluation.error ? (
                          <p className="text-sm text-red-500">{evaluation.error}</p>
                        ) : (
                          <div className="space-y-1">
                            {evaluation.rankings
                              .sort((a, b) => a.rank - b.rank)
                              .map((r, rIdx) => {
                                const rankedModel = getModelForColumn(r.column);
                                return (
                                  <div key={rIdx} className="flex items-start gap-2 text-sm">
                                    <span className={`font-bold w-6 ${
                                      r.rank === 1 ? 'text-[#f5a623]' :
                                      r.rank === 2 ? 'text-gray-600' :
                                      r.rank === 3 ? 'text-orange-500' :
                                      'text-gray-400'
                                    }`}>#{r.rank}</span>
                                    <span className="font-medium text-gray-700 w-32">{rankedModel?.name || r.column}</span>
                                    <span className="text-gray-500 italic flex-1">"{r.critique}"</span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showSaveBenchmarkModal} onOpenChange={setShowSaveBenchmarkModal}>
          <DialogContent className="max-w-md bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <Bookmark className="w-5 h-5 text-[#1a3a8f]" />
                <span className="text-[#1a3a8f]">Save as Benchmark</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={benchmarkName}
                  onChange={(e) => setBenchmarkName(e.target.value)}
                  placeholder="e.g., Math Word Problems"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a8f] focus:border-[#1a3a8f]"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Description (optional)</label>
                <Textarea
                  value={benchmarkDescription}
                  onChange={(e) => setBenchmarkDescription(e.target.value)}
                  placeholder="What does this benchmark test?"
                  className="w-full h-20 resize-none text-sm"
                />
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Prompt to save:</div>
                <p className="text-sm text-gray-700 line-clamp-3">{prompt}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSaveBenchmarkModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveBenchmark}
                  className="flex-1 bg-[#1a3a8f] hover:bg-[#2a4a9f]"
                  disabled={!benchmarkName.trim()}
                >
                  Save Benchmark
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showLibraryModal} onOpenChange={setShowLibraryModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <Library className="w-5 h-5 text-[#1a3a8f]" />
                <span className="text-[#1a3a8f]">Benchmark Library</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Saved prompts you can re-run and compare.
                </p>
                <button
                  onClick={loadBenchmarks}
                  disabled={libraryLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                  <RefreshCw className={`w-4 h-4 ${libraryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {libraryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1a3a8f]" />
                </div>
              ) : benchmarks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Library className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No benchmarks saved yet</p>
                  <p className="text-sm mt-1">Run a test and click "Save" to add one.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {benchmarks.map((benchmark) => (
                    <div 
                      key={benchmark.id} 
                      className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#1a3a8f]/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate">{benchmark.name}</h4>
                          {benchmark.description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{benchmark.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(benchmark.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleLoadBenchmark(benchmark.prompt)}
                            className="px-3 py-1.5 bg-[#1a3a8f] text-white text-sm font-medium rounded hover:bg-[#2a4a9f] flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteBenchmark(benchmark.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                        <p className="text-xs text-gray-600 line-clamp-2 font-mono">{benchmark.prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
          <DialogContent className="max-w-md bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="text-emerald-600">Share to Leaderboard</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Share your test results with the community. Your prompt and model results will be visible to others.
              </p>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Display Name (optional)</label>
                <input
                  type="text"
                  value={shareNickname}
                  onChange={(e) => setShareNickname(e.target.value)}
                  placeholder="Enter a nickname or leave blank for Anonymous"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <div className="text-xs text-gray-500">What will be shared:</div>
                <div className="text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>Your prompt: "{prompt.slice(0, 50)}{prompt.length > 50 ? '...' : ''}"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>Recommended model: {recommendedModel || 'None'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>Settings & results from all models</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowShareModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShareToLeaderboard}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={shareSubmitting}
                >
                  {shareSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    'Share to Leaderboard'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showLeaderboardModal} onOpenChange={setShowLeaderboardModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <Trophy className="w-5 h-5 text-[#f5a623]" />
                <span className="text-[#f5a623]">Public Leaderboard</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  See what prompts others are testing and compare results.
                </p>
                <button
                  onClick={loadLeaderboard}
                  disabled={leaderboardLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                  <RefreshCw className={`w-4 h-4 ${leaderboardLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {leaderboardLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#f5a623]" />
                </div>
              ) : leaderboardEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No entries yet</p>
                  <p className="text-sm mt-1">Be the first to share your results!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {leaderboardEntries.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">
                              {entry.displayName || 'Anonymous'}
                            </span>
                            {entry.recommendedModel && (
                              <span className="px-2 py-0.5 bg-[#f5a623]/20 text-[#f5a623] text-xs font-bold rounded">
                                PICK: {entry.recommendedModel}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {entry.settings && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{entry.settings.contextSize.toUpperCase()}</span>
                            <span>|</span>
                            <span>${entry.settings.costCap.toFixed(2)} cap</span>
                            {entry.settings.reasoningEnabled && (
                              <>
                                <span>|</span>
                                <Brain className="w-3 h-3" />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-200 mb-2">
                        <p className="text-sm text-gray-700 font-mono line-clamp-2">{entry.prompt}</p>
                      </div>
                      {entry.results && (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(entry.results).map(([col, result]) => (
                            <div 
                              key={col}
                              className={`px-2 py-1 rounded text-xs ${
                                col === entry.recommendedModel 
                                  ? 'bg-[#f5a623]/20 text-[#f5a623] font-bold' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {col}: {result.latency}ms / ${result.cost.toFixed(4)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
