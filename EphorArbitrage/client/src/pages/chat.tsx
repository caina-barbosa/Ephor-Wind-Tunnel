import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
import { Play, Loader2, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Model {
  id: string;
  name: string;
  costPer1k: number;
}

interface ModelResponse {
  content: string;
  loading: boolean;
  error: string | null;
  ttft: number | null;
  cost: number | null;
}

const COLUMNS = ["3B", "7B", "14B", "70B", "Frontier"] as const;

const NON_REASONING_MODELS: Record<string, Model> = {
  "3B": { id: "together/llama-3.2-3b-instruct-turbo", name: "Llama 3.2 3B", costPer1k: 0.00006 },
  "7B": { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B", costPer1k: 0.0001 },
  "14B": { id: "together/deepseek-r1-distill-qwen-14b", name: "DeepSeek R1 Distill Qwen 14B", costPer1k: 0.0002 },
  "70B": { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Llama 3.3 70B", costPer1k: 0.0006 },
  "Frontier": { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", costPer1k: 0.015 },
};

const REASONING_MODELS: Record<string, Model | null> = {
  "3B": null,
  "7B": null,
  "14B": null,
  "70B": { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", costPer1k: 0.002 },
  "Frontier": { id: "together/deepseek-r1", name: "DeepSeek R1", costPer1k: 0.003 },
};

const FRONTIER_REASONING_OPTIONS: Model[] = [
  { id: "together/deepseek-r1", name: "DeepSeek R1", costPer1k: 0.003 },
  { id: "together/qwq-32b", name: "QwQ 32B", costPer1k: 0.002 },
];

const CONTEXT_SIZES = ["8k", "32k", "128k", "1M"] as const;

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ model: Model; response: ModelResponse } | null>(null);

  const [contextSize, setContextSize] = useState<string>("1M");
  const [costCap, setCostCap] = useState<number>(0.25);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [frontierReasoningModel, setFrontierReasoningModel] = useState(FRONTIER_REASONING_OPTIONS[0].id);

  const getModelForColumn = (col: string): Model | null => {
    if (reasoningEnabled) {
      if (col === "Frontier") {
        return FRONTIER_REASONING_OPTIONS.find(m => m.id === frontierReasoningModel) || FRONTIER_REASONING_OPTIONS[0];
      }
      return REASONING_MODELS[col];
    }
    return NON_REASONING_MODELS[col];
  };

  const isModelDisabled = (col: string): boolean => {
    const model = getModelForColumn(col);
    if (!model) return true;
    const estimatedCost = model.costPer1k * 2;
    return estimatedCost > costCap;
  };

  const handleRunAll = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setShowResults(true);

    const modelsToRun: { col: string; model: Model }[] = [];
    COLUMNS.forEach(col => {
      const model = getModelForColumn(col);
      if (model && !isModelDisabled(col)) {
        modelsToRun.push({ col, model });
      }
    });

    const initialResponses: Record<string, ModelResponse> = {};
    modelsToRun.forEach(({ col }) => {
      initialResponses[col] = { content: "", loading: true, error: null, ttft: null, cost: null };
    });
    setResponses(initialResponses);

    const runModel = async (col: string, model: Model) => {
      try {
        const response = await apiRequest("POST", "/api/wind-tunnel/run", {
          modelId: model.id,
          prompt: prompt,
        });

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
          },
        }));
      } catch (err: any) {
        setResponses((prev) => ({
          ...prev,
          [col]: {
            content: "",
            loading: false,
            error: err.message || "Failed",
            ttft: null,
            cost: null,
          },
        }));
      }
    };

    await Promise.all(modelsToRun.map(({ col, model }) => runModel(col, model)));
    setIsRunning(false);
  };

  const openModal = (model: Model, response: ModelResponse) => {
    if (response.content || response.error) {
      setSelectedModel({ model, response });
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto p-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">EPHOR WIND TUNNEL</h1>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            className="w-full h-[80px] resize-none text-sm mb-4"
            disabled={isRunning}
          />

          <div className="flex items-center gap-6 mb-4 p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Context:</span>
              <Select value={contextSize} onValueChange={setContextSize} disabled={isRunning}>
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTEXT_SIZES.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm font-medium text-gray-600">Cost Cap:</span>
              <Slider
                value={[costCap]}
                onValueChange={([val]) => setCostCap(val)}
                min={0}
                max={0.25}
                step={0.01}
                className="w-32"
                disabled={isRunning}
              />
              <span className="text-sm font-mono text-gray-700 w-16">${costCap.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Reasoning:</span>
              <Switch
                checked={reasoningEnabled}
                onCheckedChange={setReasoningEnabled}
                disabled={isRunning}
              />
              <span className={`text-xs font-medium ${reasoningEnabled ? 'text-orange-600' : 'text-gray-400'}`}>
                {reasoningEnabled ? 'ON' : 'OFF'}
              </span>
            </div>

            {reasoningEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Frontier:</span>
                <Select value={frontierReasoningModel} onValueChange={setFrontierReasoningModel} disabled={isRunning}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRONTIER_REASONING_OPTIONS.map(model => (
                      <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            onClick={handleRunAll}
            disabled={!prompt.trim() || isRunning}
            className="w-full py-4 text-base bg-blue-600 hover:bg-blue-700 mb-4"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Run All
              </>
            )}
          </Button>

          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="grid grid-cols-5 gap-px bg-gray-200">
              {COLUMNS.map(col => (
                <div key={col} className="bg-gray-100 p-2 text-center font-bold text-gray-700 text-sm">
                  {col}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-px bg-gray-200">
              {COLUMNS.map(col => {
                const model = getModelForColumn(col);
                const isDisabled = !model;
                const isCostDisabled = model && isModelDisabled(col);
                const response = responses[col];
                const isLoading = response?.loading;
                const hasError = response?.error;
                const hasContent = response?.content;

                if (isDisabled) {
                  return (
                    <Tooltip key={col}>
                      <TooltipTrigger asChild>
                        <div className="bg-gray-200 p-3 flex items-center justify-center min-h-[90px] cursor-not-allowed">
                          <div className="text-center text-gray-400">
                            <Lock className="w-5 h-5 mx-auto mb-1" />
                            <span className="text-[10px] leading-tight block">Reasoning<br/>requires 70B+</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reasoning models require 70B+ parameters</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (isCostDisabled) {
                  return (
                    <Tooltip key={col}>
                      <TooltipTrigger asChild>
                        <div className="bg-gray-100 p-3 flex items-center justify-center min-h-[90px] cursor-not-allowed opacity-50">
                          <div className="text-center text-gray-400">
                            <span className="font-medium text-[11px] block mb-1">{model.name}</span>
                            <span className="text-[10px]">Exceeds cost cap</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This model exceeds your ${costCap.toFixed(2)} cost cap</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <div
                    key={col}
                    onClick={() => response && hasContent && openModal(model, response)}
                    className={`
                      bg-white p-3 min-h-[90px] transition-all
                      ${isLoading ? 'bg-blue-50' : ''}
                      ${hasError ? 'bg-red-50' : ''}
                      ${hasContent ? 'bg-green-50 cursor-pointer hover:bg-green-100' : ''}
                    `}
                  >
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <span className="font-medium text-gray-800 text-[11px] text-center">
                        {model.name}
                      </span>
                      {reasoningEnabled && (col === "70B" || col === "Frontier") && (
                        <span className="text-[8px] bg-orange-500 text-white px-1 py-0.5 rounded font-medium">
                          R
                        </span>
                      )}
                    </div>

                    {!showResults && (
                      <div className="text-gray-400 text-[10px] text-center">Ready</div>
                    )}

                    {isLoading && (
                      <div className="flex items-center justify-center gap-1 text-blue-600 text-[10px]">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Running...
                      </div>
                    )}

                    {hasError && (
                      <div className="text-red-600 text-[10px] text-center">{response.error}</div>
                    )}

                    {hasContent && (
                      <div className="space-y-0.5 text-center">
                        <div className="text-[10px]">
                          <span className="text-gray-500">TTFT:</span>{" "}
                          <span className="font-mono text-gray-700">{response.ttft}ms</span>
                        </div>
                        <div className="text-[10px]">
                          <span className="text-gray-500">Cost:</span>{" "}
                          <span className="font-mono text-gray-700">${response.cost?.toFixed(4)}</span>
                        </div>
                        <div className="text-[9px] text-blue-600 mt-1">Click to view</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedModel?.model.name}
                {reasoningEnabled && (
                  <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-medium">
                    Reasoning
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedModel?.response.ttft && (
                <div className="flex gap-4 text-sm text-gray-600 border-b pb-3">
                  <span>TTFT: <strong>{selectedModel.response.ttft}ms</strong></span>
                  <span>Cost: <strong>${selectedModel.response.cost?.toFixed(4)}</strong></span>
                </div>
              )}
              <div className="prose prose-sm max-w-none">
                {selectedModel?.response.error ? (
                  <p className="text-red-600">{selectedModel.response.error}</p>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                    {selectedModel?.response.content}
                  </pre>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
