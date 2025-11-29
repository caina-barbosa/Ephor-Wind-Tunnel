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
import { Play, Loader2, Lock, Zap, Clock, DollarSign, Brain, Info, CheckCircle2, XCircle, Target, TrendingUp, AlertTriangle } from "lucide-react";
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

const COLUMNS = ["3B", "7B", "14B", "70B", "Frontier"] as const;

const NON_REASONING_MODELS: Record<string, Model> = {
  "3B": { id: "together/llama-3.2-3b-instruct-turbo", name: "Llama 3.2 3B", costPer1k: 0.00006, expectedLatency: "fast", reasoningDepth: "none", expectedAccuracy: "basic" },
  "7B": { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B", costPer1k: 0.0001, expectedLatency: "fast", reasoningDepth: "none", expectedAccuracy: "good" },
  "14B": { id: "openrouter/qwen3-14b", name: "Qwen3 14B", costPer1k: 0.0002, expectedLatency: "medium", reasoningDepth: "none", expectedAccuracy: "good" },
  "70B": { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Llama 3.3 70B", costPer1k: 0.0006, expectedLatency: "medium", reasoningDepth: "none", expectedAccuracy: "strong" },
  "Frontier": { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", costPer1k: 0.015, expectedLatency: "slow", reasoningDepth: "none", expectedAccuracy: "excellent" },
};

const REASONING_MODELS: Record<string, Model | null> = {
  "3B": null,
  "7B": null,
  "14B": null,
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
  cardStyle: string;
  prominence: "small" | "medium" | "large";
}> = {
  "3B": {
    headerSize: "text-base font-semibold text-gray-500",
    cardStyle: "bg-gray-50/50 border-gray-200",
    prominence: "small"
  },
  "7B": {
    headerSize: "text-base font-semibold text-gray-500",
    cardStyle: "bg-gray-50/30 border-gray-200",
    prominence: "small"
  },
  "14B": {
    headerSize: "text-lg font-bold text-gray-600",
    cardStyle: "bg-white border-gray-200 shadow-sm",
    prominence: "medium"
  },
  "70B": {
    headerSize: "text-xl font-bold text-gray-700",
    cardStyle: "bg-white border-gray-300 shadow-md",
    prominence: "medium"
  },
  "Frontier": {
    headerSize: "text-2xl font-black text-[#1a3a8f]",
    cardStyle: "bg-white border-[#1a3a8f]/20 shadow-lg",
    prominence: "large"
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

const getCostVisuals = (cost: number) => {
  if (cost < 0.001) return { size: "text-xs", color: "text-gray-400", style: "" };
  if (cost < 0.005) return { size: "text-sm", color: "text-gray-600", style: "" };
  if (cost < 0.01) return { size: "text-base font-semibold", color: "text-orange-600", style: "" };
  return { size: "text-lg font-black", color: "text-red-600", style: "bg-red-50 px-2 py-0.5 rounded" };
};

const getCapabilityVisuals = (accuracy: "basic" | "good" | "strong" | "excellent") => {
  switch (accuracy) {
    case "basic": return { bars: 1, color: "bg-gray-300", textColor: "text-gray-500", label: "Basic" };
    case "good": return { bars: 2, color: "bg-blue-300", textColor: "text-blue-600", label: "Good" };
    case "strong": return { bars: 3, color: "bg-blue-500", textColor: "text-blue-700", label: "Strong" };
    case "excellent": return { bars: 4, color: "bg-[#1a3a8f]", textColor: "text-[#1a3a8f]", label: "Excellent" };
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
  
  const [contextSize, setContextSize] = useState<string>("128k");
  const [costCap, setCostCap] = useState<number>(0.25);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);

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

  const isModelDisabled = (col: string): { disabled: boolean; reason: string } => {
    const model = getModelForColumn(col);
    if (!model) {
      return { disabled: true, reason: "Reasoning requires 70B+" };
    }
    
    // Check if input exceeds selected context window
    if (inputTokenEstimate > selectedContextTokens) {
      return { disabled: true, reason: `Input exceeds ${contextSize.toUpperCase()} context` };
    }
    
    const cost = estimateCost(model);
    if (cost > costCap) {
      return { disabled: true, reason: `Exceeds $${costCap.toFixed(2)} cap` };
    }
    return { disabled: false, reason: "" };
  };

  const getRecommendationReason = (col: string): string => {
    const model = getModelForColumn(col);
    if (!model) return "";
    
    if (reasoningEnabled) {
      if (col === "70B") {
        return `Cheapest reasoning-capable model. Reasoning mode requires 70B+ parameters. DeepSeek R1 Distill gives deep chain-of-thought at lower cost than Frontier.`;
      }
      if (col === "Frontier") {
        return `Only reasoning model within your budget. DeepSeek R1 has maximum reasoning depth. 70B was filtered out by your cost cap.`;
      }
    } else {
      const modelCosts: Record<string, string> = {
        "3B": "$0.00006/1K tokens",
        "7B": "$0.0001/1K tokens",
        "14B": "$0.0002/1K tokens",
        "70B": "$0.0006/1K tokens",
        "Frontier": "$0.015/1K tokens"
      };
      return `Cheapest model that fits your constraints. At ${modelCosts[col] || "low cost"}, this is the most cost-efficient option. Run the test to compare quality across all models—upgrade if needed!`;
    }
    return "";
  };

  // Simple recommendation logic: find the CHEAPEST model that fits all constraints
  const recommendedModel = useMemo(() => {
    // Model order from cheapest to most expensive
    const modelOrder: typeof COLUMNS[number][] = ["3B", "7B", "14B", "70B", "Frontier"];
    
    // Filter models that fit all constraints
    const available = modelOrder.filter(col => {
      const { disabled } = isModelDisabled(col);
      return !disabled;
    });
    
    if (available.length === 0) return null;
    
    // If Reasoning Mode is ON, only consider 70B and Frontier
    if (reasoningEnabled) {
      const reasoningModels = available.filter(m => m === "70B" || m === "Frontier");
      // Return cheapest reasoning model (70B is cheaper than Frontier)
      return reasoningModels.length > 0 ? reasoningModels[0] : null;
    }
    
    // Return the cheapest available model
    return available[0];
  }, [costCap, reasoningEnabled, contextSize, inputTokenEstimate]);

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
  };

  const openModal = (col: string, model: Model, response: ModelResponse) => {
    if (response.content || response.error) {
      setSelectedModel({ col, model, response });
    }
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
                    const isRecommended = col === recommendedModel;
                    const visuals = COLUMN_VISUALS[col];
                    return (
                      <div 
                        key={col} 
                        className={`p-2 sm:p-3 text-center ${isRecommended ? 'bg-[#fff8eb]' : 'bg-white'} ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}`}
                      >
                        <div className={`${visuals.headerSize} tracking-tight`}>{col}</div>
                        <div className={`text-xs font-medium ${col === 'Frontier' ? 'text-[#1a3a8f]/60' : 'text-gray-400'}`}>
                          {col === "Frontier" ? "Best Quality" : `${col} Parameters`}
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
                    const { disabled, reason } = isModelDisabled(col);
                    const response = responses[col];
                    const isLoading = response?.loading;
                    const hasError = response?.error;
                    const hasContent = response?.content;
                    const isRecommended = col === recommendedModel;

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

                    return (
                      <div
                        key={col}
                        onClick={() => response && hasContent && openModal(col, model!, response)}
                        className={`
                          p-3 min-h-[280px] max-h-[400px] transition-all flex flex-col overflow-hidden border
                          ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}
                          ${cardVisuals.cardStyle}
                          ${isRecommended ? 'ring-2 ring-[#f5a623] ring-offset-1 bg-[#fffbf5]' : ''}
                          ${isLoading ? 'bg-gray-50/80' : ''}
                          ${hasError ? 'bg-red-50' : ''}
                          ${hasContent ? 'cursor-pointer hover:brightness-[0.98]' : ''}
                        `}
                      >
                        <div className="text-center mb-3">
                          <span className={`font-semibold text-gray-800 text-xs sm:text-sm ${cardVisuals.prominence === 'large' ? 'text-[#1a3a8f]' : ''}`}>
                            {model!.name}
                          </span>
                          {reasoningEnabled && (col === "70B" || col === "Frontier") && (
                            <span className="ml-1 sm:ml-2 text-xs bg-[#1a3a8f]/10 text-[#1a3a8f] px-1 sm:px-2 py-0.5 rounded font-bold">
                              DEEP
                            </span>
                          )}
                        </div>

                        {!hasContent && (
                          <div className="space-y-3 flex-grow">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Speed
                                </span>
                                <span className={`text-xs font-medium ${latencyConfig.color.replace('bg-', 'text-')}`}>
                                  {latencyConfig.label}
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${latencyConfig.width} ${latencyConfig.color} rounded-full transition-all`}></div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1 text-xs">
                                <DollarSign className="w-3 h-3" /> Cost
                              </span>
                              <span className={`font-mono ${costConfig.size} ${costConfig.color} ${costConfig.style}`}>
                                ${estimatedCost.toFixed(4)}
                              </span>
                            </div>
                            
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-500 flex items-center gap-1">
                                  <Target className="w-3 h-3" /> Capability
                                </span>
                                <span className={`text-xs font-semibold ${capabilityConfig.textColor}`}>
                                  {capabilityConfig.label}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map((bar) => (
                                  <div
                                    key={bar}
                                    className={`h-2 flex-1 rounded-sm ${bar <= capabilityConfig.bars ? capabilityConfig.color : 'bg-gray-200'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {!showResults && !hasContent && !isLoading && !hasError && (
                          <div className="text-center mt-auto pt-3">
                            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center border-2 ${
                              cardVisuals.prominence === 'large' ? 'bg-[#1a3a8f]/5 border-[#1a3a8f]/20' : 
                              cardVisuals.prominence === 'medium' ? 'bg-gray-100 border-gray-300' : 
                              'bg-gray-50 border-gray-200'
                            }`}>
                              <span className={`text-xs font-bold ${
                                cardVisuals.prominence === 'large' ? 'text-[#1a3a8f]' : 'text-gray-500'
                              }`}>Ready</span>
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
                  const isRecommended = col === recommendedModel;
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
                           inputTokenEstimate < 500 ? "Moderate query - consider 7B-14B" :
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
                          <p className="text-gray-600">Small models (3B-14B) cannot do deep reasoning reliably. Only 70B+ models have enough parameters for chain-of-thought.</p>
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

      </div>
    </TooltipProvider>
  );
}
