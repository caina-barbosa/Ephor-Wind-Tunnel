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

const getLatencyColor = (latency: "fast" | "medium" | "slow") => {
  return "text-gray-600 bg-transparent border border-gray-300";
};

const getLatencyLabel = (latency: "fast" | "medium" | "slow") => {
  switch (latency) {
    case "fast": return "Fast";
    case "medium": return "Medium";
    case "slow": return "Slow";
  }
};

const getLatencyCategory = (latency: number): "fast" | "medium" | "slow" => {
  if (latency < 500) return "fast";
  if (latency < 2000) return "medium";
  return "slow";
};

const getCapabilityColor = (accuracy: "basic" | "good" | "strong" | "excellent") => {
  return "text-gray-600";
};

const getCapabilityLabel = (accuracy: "basic" | "good" | "strong" | "excellent") => {
  switch (accuracy) {
    case "basic": return "Basic";
    case "good": return "Good";
    case "strong": return "Strong";
    case "excellent": return "Excellent";
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

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ col: string; model: Model; response: ModelResponse } | null>(null);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [showParetoModal, setShowParetoModal] = useState(false);

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
        <div className="w-full px-4 sm:px-16 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
            <h1 className="text-2xl sm:text-4xl font-black text-[#1a3a8f] tracking-tight">
              EPHOR WIND TUNNEL
            </h1>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWhyModal(true)}
                className="border-[#1a3a8f] text-[#1a3a8f] hover:bg-[#1a3a8f]/10 font-semibold flex-1 sm:flex-none"
              >
                <Info className="w-4 h-4 mr-2" />
                Why This Model?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowParetoModal(true)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold flex-1 sm:flex-none"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Cost Curve
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200 shadow-sm">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
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
            className="w-full py-3.5 text-sm sm:text-base font-bold mb-3 rounded-lg flex items-center justify-center gap-2 text-white disabled:cursor-not-allowed hover:brightness-110 transition-all"
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
                    return (
                      <div 
                        key={col} 
                        className={`p-2 sm:p-3 text-center bg-white ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}`}
                      >
                        <div className="font-black text-[#1a3a8f] text-base sm:text-xl tracking-tight">{col}</div>
                        <div className="text-xs text-gray-500 font-medium">
                          {col === "Frontier" ? "Best Quality" : `${col} Parameters`}
                        </div>
                        {isRecommended && (
                          <div className="mt-1 text-xs font-black text-[#f5a623]">★ Recommended</div>
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
                            <div className={`p-3 min-h-[130px] sm:min-h-[150px] flex flex-col items-center justify-center bg-gray-50 ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}`}>
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

                    return (
                      <div
                        key={col}
                        onClick={() => response && hasContent && openModal(col, model!, response)}
                        className={`
                          p-3 min-h-[150px] transition-all flex flex-col
                          ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}
                          ${isRecommended ? 'bg-white border-l-4 border-l-[#f5a623]' : 'bg-white'}
                          ${isLoading ? 'bg-gray-50' : ''}
                          ${hasError ? 'bg-red-50' : ''}
                          ${hasContent ? 'cursor-pointer hover:bg-gray-50' : ''}
                        `}
                      >
                        <div className="text-center mb-2">
                          <span className="font-medium text-gray-900 text-xs sm:text-sm">
                            {model!.name}
                          </span>
                          {reasoningEnabled && (col === "70B" || col === "Frontier") && (
                            <span className="ml-1 sm:ml-2 text-xs bg-gray-100 text-gray-600 px-1 sm:px-2 py-0.5 rounded font-medium">
                              Deep
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 flex-grow">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> <span className="hidden sm:inline">Latency</span>
                            </span>
                            <span className={`px-1 sm:px-2 py-0.5 rounded text-xs font-medium ${getLatencyColor(model!.expectedLatency)}`}>
                              {getLatencyLabel(model!.expectedLatency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" /> <span className="hidden sm:inline">Est. Cost</span>
                            </span>
                            <span className="font-mono text-gray-700">
                              ${estimateCost(model!).toFixed(4)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Brain className="w-3 h-3" /> <span className="hidden sm:inline">Reasoning</span>
                            </span>
                            <span className="text-gray-600 text-xs">
                              {getReasoningDepthLabel(model!.reasoningDepth)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Target className="w-3 h-3" /> <span className="hidden sm:inline">Capability</span>
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`px-1 sm:px-2 py-0.5 rounded text-xs font-medium cursor-help ${getCapabilityColor(model!.expectedAccuracy)}`}>
                                    {getCapabilityLabel(model!.expectedAccuracy)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{getCapabilityDescription(model!.expectedAccuracy)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        {!showResults && (
                          <div className="text-center mt-auto pt-2">
                            <div className="w-12 h-12 mx-auto rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center">
                              <span className="text-gray-600 text-xs font-bold">Ready</span>
                            </div>
                          </div>
                        )}

                        {isLoading && (
                          <div className="text-center py-2">
                            <div className="relative w-12 h-12 sm:w-16 sm:h-16 mx-auto">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
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
                                  className="text-gray-500 transition-all duration-300"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-mono font-bold text-gray-700">
                                  {Math.round(response.progress)}%
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 sm:mt-2">Processing...</p>
                          </div>
                        )}

                    {hasError && (
                      <div className="text-center py-4">
                        <XCircle className="w-10 h-10 mx-auto text-red-500 mb-2" />
                        <p className="text-xs text-red-600 font-medium">{response.error}</p>
                      </div>
                    )}

                    {hasContent && (
                      <div className="text-center py-2">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-gray-700 mb-2" />
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="text-gray-500">Latency:</span>{" "}
                            <span className="font-mono font-bold text-gray-900">
                              {response.latency}ms
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-gray-500">Cost:</span>{" "}
                            <span className="font-mono font-bold text-gray-700">
                              ${response.cost?.toFixed(4)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-[#1a3a8f] font-semibold mt-2 hover:underline">Click to view response</p>
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 pb-2 text-center text-xs sm:text-sm text-gray-500 px-2">
            <p className="hidden sm:block">Compare model responses side-by-side. Bigger models = more accurate but slower. Reasoning = deeper thinking but expensive.</p>
            <p className="sm:hidden">Swipe left/right to see all models. Tap a result to view full response.</p>
          </div>
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

        {/* Pareto Frontier / Cost vs Accuracy Curve Modal */}
        <Dialog open={showParetoModal} onOpenChange={setShowParetoModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <TrendingUp className="w-5 h-5 text-[#1a3a8f]" />
                <span className="text-[#1a3a8f]">Cost vs Capability Tradeoff (Pareto Frontier)</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>The Pareto Frontier:</strong> Every AI system lives on a tradeoff curve. 
                  You can't get maximum capability at minimum cost—you must choose where on the curve you want to be.
                </p>
              </div>

              {/* Visual Chart */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Cost vs Capability Curve</div>
                <div className="relative h-64 border-l-2 border-b-2 border-gray-300">
                  {/* Y-axis label */}
                  <div className="absolute -left-12 top-1/2 -rotate-90 text-xs text-gray-500 whitespace-nowrap">
                    Capability →
                  </div>
                  {/* X-axis label */}
                  <div className="absolute bottom-[-24px] left-1/2 text-xs text-gray-500">
                    Cost per Query →
                  </div>
                  
                  {/* Plot points for each model */}
                  {COLUMNS.map((col, index) => {
                    const model = reasoningEnabled ? REASONING_MODELS[col] : NON_REASONING_MODELS[col];
                    if (!model) return null;
                    
                    const capabilityY = { basic: 20, good: 40, strong: 70, excellent: 95 }[model.expectedAccuracy];
                    const maxCost = reasoningEnabled ? 0.01 : 0.05;
                    const costX = Math.min((estimateCost(model) / maxCost) * 90, 95);
                    const { disabled } = isModelDisabled(col);
                    const isRecommended = col === recommendedModel;
                    
                    return (
                      <TooltipProvider key={col}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute w-4 h-4 rounded-full transform -translate-x-1/2 translate-y-1/2 cursor-pointer transition-all ${
                                isRecommended ? 'w-6 h-6 bg-[#f5a623] ring-4 ring-[#f5a623]/30' :
                                disabled ? 'bg-gray-300' : 'bg-gray-600 hover:bg-gray-500'
                              }`}
                              style={{
                                left: `${Math.max(costX, 5)}%`,
                                bottom: `${capabilityY}%`,
                              }}
                            >
                              {isRecommended && (
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-[#f5a623] whitespace-nowrap">
                                  ★ Best
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <div className="font-bold">{model.name}</div>
                              <div>Size: {col}</div>
                              <div>Cost: ${estimateCost(model).toFixed(4)}</div>
                              <div>Capability: {getCapabilityLabel(model.expectedAccuracy)}</div>
                              {disabled && <div className="text-red-500">Disabled (exceeds budget)</div>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}

                  {/* Pareto curve line (connecting the points) */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d="M 5,80 Q 20,60 35,50 T 60,35 T 90,10"
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                      opacity="0.7"
                    />
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 text-xs font-medium">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-[#f5a623] ring-2 ring-[#f5a623]/30"></div>
                    <span>Recommended</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <span>Over Budget</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-0.5 bg-gray-400" style={{borderStyle: 'dashed'}}></div>
                    <span>Pareto Frontier</span>
                  </div>
                </div>
              </div>

              {/* Cost comparison table */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm font-bold text-gray-900 mb-3">
                  {reasoningEnabled ? "Reasoning Mode: Cost rises dramatically" : "Standard Mode: Cost Comparison"}
                </div>
                <div className="space-y-2">
                  {COLUMNS.map(col => {
                    const model = getModelForColumn(col);
                    if (!model) return (
                      <div key={col} className="flex items-center justify-between p-2 bg-gray-100 rounded text-gray-400">
                        <span>{col}</span>
                        <span className="text-xs">Reasoning not available</span>
                      </div>
                    );
                    
                    const cost = estimateCost(model);
                    const baseCost = estimateCost(NON_REASONING_MODELS["3B"]);
                    const multiplier = cost / baseCost;
                    const { disabled } = isModelDisabled(col);
                    
                    return (
                      <div key={col} className={`flex items-center justify-between p-2 rounded border ${
                        col === recommendedModel ? 'bg-[#f5a623]/10 border-[#f5a623]' : 
                        disabled ? 'bg-gray-100 border-gray-200 opacity-50' : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
                            {col}: {model.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`text-xs px-2 py-0.5 rounded font-semibold ${getCapabilityColor(model.expectedAccuracy)}`}>
                            {getCapabilityLabel(model.expectedAccuracy)}
                          </div>
                          <div className="text-right">
                            <div className={`font-mono text-sm font-bold ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
                              ${cost.toFixed(4)}
                            </div>
                            <div className="text-xs font-medium text-gray-500">
                              {multiplier.toFixed(0)}x base cost
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {reasoningEnabled && (
                  <div className="mt-3 p-3 bg-gray-100 border border-gray-300 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-700">
                      <strong>Reasoning adds 3-5x cost!</strong> Deep chain-of-thought requires more compute. 
                      Only use when complex multi-step reasoning is truly needed.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Key Insight:</strong> The "best" model depends on your constraints. 
                  A 3B model at $0.0001 might be perfect for simple tasks, while a Frontier model at $0.01+ 
                  is only worth it for the hardest problems. Learn to pick the right tool for the job!
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
