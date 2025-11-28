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
import { Play, Loader2, Lock, Zap, Clock, DollarSign, Brain, Info, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Model {
  id: string;
  name: string;
  costPer1k: number;
  expectedLatency: "fast" | "medium" | "slow";
  reasoningDepth: "none" | "shallow" | "deep";
}

interface ModelResponse {
  content: string;
  loading: boolean;
  error: string | null;
  ttft: number | null;
  cost: number | null;
  progress: number;
}

const COLUMNS = ["3B", "7B", "14B", "70B", "Frontier"] as const;

const NON_REASONING_MODELS: Record<string, Model> = {
  "3B": { id: "together/llama-3.2-3b-instruct-turbo", name: "Llama 3.2 3B", costPer1k: 0.00006, expectedLatency: "fast", reasoningDepth: "none" },
  "7B": { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B", costPer1k: 0.0001, expectedLatency: "fast", reasoningDepth: "none" },
  "14B": { id: "openrouter/qwen3-14b", name: "Qwen3 14B", costPer1k: 0.0002, expectedLatency: "medium", reasoningDepth: "none" },
  "70B": { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Llama 3.3 70B", costPer1k: 0.0006, expectedLatency: "medium", reasoningDepth: "none" },
  "Frontier": { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", costPer1k: 0.015, expectedLatency: "slow", reasoningDepth: "none" },
};

const REASONING_MODELS: Record<string, Model | null> = {
  "3B": null,
  "7B": null,
  "14B": null,
  "70B": { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", costPer1k: 0.002, expectedLatency: "slow", reasoningDepth: "deep" },
  "Frontier": { id: "together/deepseek-r1", name: "DeepSeek R1", costPer1k: 0.003, expectedLatency: "slow", reasoningDepth: "deep" },
};

const CONTEXT_SIZES = [
  { value: "8k", tokens: 8000, label: "8K" },
  { value: "32k", tokens: 32000, label: "32K" },
  { value: "128k", tokens: 128000, label: "128K" },
  { value: "1m", tokens: 1000000, label: "1M" },
] as const;

const getLatencyColor = (latency: "fast" | "medium" | "slow") => {
  switch (latency) {
    case "fast": return "text-green-600 bg-green-100";
    case "medium": return "text-yellow-600 bg-yellow-100";
    case "slow": return "text-red-600 bg-red-100";
  }
};

const getLatencyLabel = (latency: "fast" | "medium" | "slow") => {
  switch (latency) {
    case "fast": return "Fast";
    case "medium": return "Medium";
    case "slow": return "Slow";
  }
};

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
    const cost = estimateCost(model);
    if (cost > costCap) {
      return { disabled: true, reason: `Exceeds $${costCap.toFixed(2)} cap` };
    }
    return { disabled: false, reason: "" };
  };

  const recommendedModel = useMemo(() => {
    const available = COLUMNS.filter(col => !isModelDisabled(col).disabled);
    if (available.length === 0) return null;
    
    let best = available[0];
    let bestScore = Infinity;
    
    available.forEach(col => {
      const model = getModelForColumn(col);
      if (!model) return;
      const cost = estimateCost(model);
      const latencyScore = model.expectedLatency === "fast" ? 1 : model.expectedLatency === "medium" ? 2 : 3;
      const score = cost * 100 + latencyScore;
      if (score < bestScore) {
        bestScore = score;
        best = col;
      }
    });
    
    return best;
  }, [costCap, reasoningEnabled, inputTokenEstimate]);

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
      initialResponses[col] = { content: "", loading: true, error: null, ttft: null, cost: null, progress: 0 };
    });
    setResponses(initialResponses);

    const runModel = async (col: string, model: Model) => {
      const progressInterval = setInterval(() => {
        setResponses((prev) => {
          const current = prev[col];
          if (current && current.loading && current.progress < 90) {
            return {
              ...prev,
              [col]: { ...current, progress: current.progress + Math.random() * 15 }
            };
          }
          return prev;
        });
      }, 300);

      try {
        const response = await apiRequest("POST", "/api/wind-tunnel/run", {
          modelId: model.id,
          prompt: prompt,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Request failed");
        }

        const data = await response.json();

        setResponses((prev) => ({
          ...prev,
          [col]: {
            content: data.content || "",
            loading: false,
            error: null,
            ttft: data.ttft,
            cost: data.cost,
            progress: 100,
          },
        }));
      } catch (err: any) {
        clearInterval(progressInterval);
        setResponses((prev) => ({
          ...prev,
          [col]: {
            content: "",
            loading: false,
            error: err.message || "Failed",
            ttft: null,
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
      <div className="min-h-screen bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              LLM WIND TUNNEL
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWhyModal(true)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <Info className="w-4 h-4 mr-2" />
              Why This Model?
            </Button>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt to test across all model sizes..."
              className="w-full h-[100px] resize-none bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
              disabled={isRunning}
            />
            
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-slate-400">Input tokens:</span>
              <span className="font-mono text-blue-400">{inputTokenEstimate.toLocaleString()}</span>
              <div className="flex-1 mx-4">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${inputPercentage > 80 ? 'bg-red-500' : inputPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${inputPercentage}%` }}
                  />
                </div>
              </div>
              <span className="text-slate-500 text-xs">{inputPercentage.toFixed(1)}% of {contextSize} context</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-slate-200">Context Window</span>
              </div>
              <Select value={contextSize} onValueChange={setContextSize} disabled={isRunning}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {CONTEXT_SIZES.map(size => (
                    <SelectItem key={size.value} value={size.value} className="text-white hover:bg-slate-700">
                      {size.label} tokens
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-2">Memory = Cost. Bigger context = more expensive.</p>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="font-medium text-slate-200">Max Cost Per Query</span>
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
                <span className={`font-mono text-lg ${costCap < 0.05 ? 'text-green-400' : costCap < 0.15 ? 'text-yellow-400' : 'text-red-400'}`}>
                  ${costCap.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Models exceeding this cap will be disabled.</p>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-orange-400" />
                <span className="font-medium text-slate-200">Reasoning Mode</span>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={reasoningEnabled}
                  onCheckedChange={setReasoningEnabled}
                  disabled={isRunning}
                />
                <span className={`font-medium ${reasoningEnabled ? 'text-orange-400' : 'text-slate-500'}`}>
                  {reasoningEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {reasoningEnabled 
                  ? "Deep reasoning enabled on 70B+ only. Slower but more accurate."
                  : "Standard mode. Fast responses, no chain-of-thought."}
              </p>
            </div>
          </div>

          <Button
            onClick={handleRunAll}
            disabled={!prompt.trim() || isRunning}
            className="w-full py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 mb-6"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                Testing All Models...
              </>
            ) : (
              <>
                <Play className="w-6 h-6 mr-3" />
                Run Wind Tunnel Test
              </>
            )}
          </Button>

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="grid grid-cols-5">
              {COLUMNS.map(col => {
                const model = getModelForColumn(col);
                const isRecommended = col === recommendedModel;
                return (
                  <div 
                    key={col} 
                    className={`p-3 text-center border-b border-slate-700 ${isRecommended ? 'bg-blue-900/30' : 'bg-slate-900'}`}
                  >
                    <div className="font-bold text-lg text-slate-200">{col}</div>
                    <div className="text-xs text-slate-500">
                      {col === "Frontier" ? "Best Quality" : `${col} Parameters`}
                    </div>
                    {isRecommended && (
                      <div className="mt-1 text-xs font-medium text-blue-400">★ Recommended</div>
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
                        <div className={`p-4 min-h-[180px] flex flex-col items-center justify-center ${isReasoningLocked ? 'bg-slate-900' : 'bg-slate-800/50'} border-r border-slate-700 last:border-r-0`}>
                          <Lock className={`w-8 h-8 mb-2 ${isReasoningLocked ? 'text-orange-500' : 'text-slate-600'}`} />
                          <span className="text-sm font-medium text-slate-400 text-center">
                            {isReasoningLocked ? "Reasoning" : model?.name}
                          </span>
                          <span className="text-xs text-slate-500 text-center mt-1">
                            {reason}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 border-slate-700">
                        <p>{reason}</p>
                        {isReasoningLocked && (
                          <p className="text-xs text-slate-400 mt-1">
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
                      p-4 min-h-[180px] border-r border-slate-700 last:border-r-0 transition-all
                      ${isRecommended ? 'bg-blue-900/20' : 'bg-slate-800'}
                      ${isLoading ? 'bg-blue-900/30' : ''}
                      ${hasError ? 'bg-red-900/20' : ''}
                      ${hasContent ? 'cursor-pointer hover:bg-slate-700' : ''}
                    `}
                  >
                    <div className="text-center mb-3">
                      <span className="font-medium text-slate-200 text-sm">
                        {model!.name}
                      </span>
                      {reasoningEnabled && (col === "70B" || col === "Frontier") && (
                        <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                          Deep
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Latency
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLatencyColor(model!.expectedLatency)}`}>
                          {getLatencyLabel(model!.expectedLatency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Est. Cost
                        </span>
                        <span className="font-mono text-slate-300">
                          ${estimateCost(model!).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Brain className="w-3 h-3" /> Reasoning
                        </span>
                        <span className="text-slate-400">
                          {getReasoningDepthLabel(model!.reasoningDepth)}
                        </span>
                      </div>
                    </div>

                    {!showResults && (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 mx-auto rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
                          <span className="text-slate-500 text-xs">Ready</span>
                        </div>
                      </div>
                    )}

                    {isLoading && (
                      <div className="text-center py-2">
                        <div className="relative w-16 h-16 mx-auto">
                          <svg className="w-16 h-16 transform -rotate-90">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              className="text-slate-700"
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
                              className="text-blue-500 transition-all duration-300"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-mono text-blue-400">
                              {Math.round(response.progress)}%
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Processing...</p>
                      </div>
                    )}

                    {hasError && (
                      <div className="text-center py-4">
                        <XCircle className="w-10 h-10 mx-auto text-red-500 mb-2" />
                        <p className="text-xs text-red-400">{response.error}</p>
                      </div>
                    )}

                    {hasContent && (
                      <div className="text-center py-2">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-green-500 mb-2" />
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="text-slate-500">TTFT:</span>{" "}
                            <span className={`font-mono font-bold ${
                              response.ttft! < 500 ? 'text-green-400' : 
                              response.ttft! < 2000 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {response.ttft}ms
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-slate-500">Cost:</span>{" "}
                            <span className="font-mono text-slate-300">
                              ${response.cost?.toFixed(4)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-blue-400 mt-2 hover:underline">Click to view response</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 text-center text-sm text-slate-500">
            <p>Compare model responses side-by-side. Bigger models = more accurate but slower. Reasoning = deeper thinking but expensive.</p>
          </div>
        </div>

        <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-400 text-sm font-mono">
                  {selectedModel?.col}
                </span>
                {selectedModel?.model.name}
                {selectedModel?.model.reasoningDepth === "deep" && (
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-medium">
                    Deep Reasoning
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedModel?.response.ttft && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800 rounded-lg">
                  <div className="text-center">
                    <div className="text-slate-500 text-xs mb-1">Time to First Token</div>
                    <div className={`font-mono text-lg font-bold ${
                      selectedModel.response.ttft < 500 ? 'text-green-400' : 
                      selectedModel.response.ttft < 2000 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {selectedModel.response.ttft}ms
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500 text-xs mb-1">Total Cost</div>
                    <div className="font-mono text-lg font-bold text-slate-200">
                      ${selectedModel.response.cost?.toFixed(4)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500 text-xs mb-1">Response Length</div>
                    <div className="font-mono text-lg font-bold text-slate-200">
                      {selectedModel.response.content.length} chars
                    </div>
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-slate-400 mb-2">Response:</div>
                {selectedModel?.response.error ? (
                  <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                    <p className="text-red-400">{selectedModel.response.error}</p>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-slate-800 p-4 rounded-lg text-slate-200 max-h-[400px] overflow-y-auto">
                    {selectedModel?.response.content}
                  </pre>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showWhyModal} onOpenChange={setShowWhyModal}>
          <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Why This Model?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {recommendedModel ? (
                <>
                  <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-blue-400 font-bold">★ Recommended:</span>
                      <span className="font-medium">{getModelForColumn(recommendedModel)?.name}</span>
                      <span className="text-slate-500">({recommendedModel})</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Based on your current constraints, this model offers the best balance of cost and performance.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-slate-300">Selection Factors:</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Cost Cap</div>
                        <div className="font-mono text-green-400">${costCap.toFixed(2)}</div>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Context Size</div>
                        <div className="font-mono text-blue-400">{contextSize.toUpperCase()}</div>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Reasoning Mode</div>
                        <div className={reasoningEnabled ? 'text-orange-400' : 'text-slate-400'}>
                          {reasoningEnabled ? 'Enabled (70B+ only)' : 'Disabled'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Est. Input Tokens</div>
                        <div className="font-mono text-slate-300">{inputTokenEstimate.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800 rounded-lg">
                    <h4 className="font-medium text-slate-300 mb-2">Engineering Truth:</h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li>• <strong>Bigger ≠ Always Better:</strong> Cost rises faster than quality gains</li>
                      <li>• <strong>Reasoning is Expensive:</strong> Deep thinking requires more compute</li>
                      <li>• <strong>Context = Memory = Cost:</strong> Long context uses more resources</li>
                      <li>• <strong>Speed vs Accuracy:</strong> Faster models sacrifice some quality</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                  <p className="text-yellow-400">
                    No models available within your current cost cap of ${costCap.toFixed(2)}.
                    Try increasing the cost cap slider.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
