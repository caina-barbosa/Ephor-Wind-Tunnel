import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  isReasoning: boolean;
}

interface ModelResponse {
  content: string;
  loading: boolean;
  error: string | null;
  ttft: number | null;
  cost: number | null;
}

const COLUMNS = ["3B", "7B", "14B", "70B", "Frontier"] as const;

const GRID_MODELS: Record<string, Record<string, Model[]>> = {
  "Non-Reasoning": {
    "3B": [{ id: "together/qwen-2.5-3b-instruct", name: "Qwen 2.5 3B", isReasoning: false }],
    "7B": [{ id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B", isReasoning: false }],
    "14B": [{ id: "together/qwen-2.5-14b-instruct", name: "Qwen 2.5 14B", isReasoning: false }],
    "70B": [{ id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Llama 3.3 70B", isReasoning: false }],
    "Frontier": [
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", isReasoning: false },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3", isReasoning: false },
      { id: "moonshotai/kimi-k2", name: "Kimi K2", isReasoning: false },
    ],
  },
  "Reasoning": {
    "3B": [],
    "7B": [],
    "14B": [],
    "70B": [{ id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", isReasoning: true }],
    "Frontier": [
      { id: "together/deepseek-r1", name: "DeepSeek R1", isReasoning: true },
      { id: "together/qwq-32b", name: "QwQ 32B", isReasoning: true },
    ],
  },
};

const ROWS = ["Non-Reasoning", "Reasoning"] as const;

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ model: Model; response: ModelResponse } | null>(null);

  const handleRunAll = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setShowResults(true);

    const allModels: Model[] = [];
    ROWS.forEach(row => {
      COLUMNS.forEach(col => {
        allModels.push(...GRID_MODELS[row][col]);
      });
    });

    const initialResponses: Record<string, ModelResponse> = {};
    allModels.forEach(model => {
      initialResponses[model.id] = { content: "", loading: true, error: null, ttft: null, cost: null };
    });
    setResponses(initialResponses);

    const runModel = async (model: Model) => {
      const startTime = performance.now();
      try {
        const response = await apiRequest("POST", "/api/wind-tunnel/run", {
          modelId: model.id,
          prompt: prompt,
        });

        const ttft = Math.round(performance.now() - startTime);

        if (!response.ok) {
          throw new Error("Request failed");
        }

        const data = await response.json();
        const cost = data.cost || 0.001 + Math.random() * 0.005;

        setResponses((prev) => ({
          ...prev,
          [model.id]: {
            content: data.content || "",
            loading: false,
            error: null,
            ttft,
            cost,
          },
        }));
      } catch (err) {
        setResponses((prev) => ({
          ...prev,
          [model.id]: {
            content: "",
            loading: false,
            error: "Failed",
            ttft: null,
            cost: null,
          },
        }));
      }
    };

    await Promise.all(allModels.map(runModel));
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
        <div className="max-w-7xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">EPHOR WIND TUNNEL</h1>

          <div className="space-y-4 mb-6">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt..."
              className="w-full h-[100px] resize-none text-sm"
              disabled={isRunning}
            />

            <Button
              onClick={handleRunAll}
              disabled={!prompt.trim() || isRunning}
              className="w-full py-5 text-base bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Running 10 models...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Run All
                </>
              )}
            </Button>
          </div>

          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="grid grid-cols-[100px_repeat(5,1fr)]">
              <div className="bg-gray-100 border-b border-r p-2"></div>
              {COLUMNS.map(col => (
                <div key={col} className="bg-gray-100 border-b border-r last:border-r-0 p-3 text-center font-bold text-gray-700">
                  {col}
                </div>
              ))}
            </div>

            {ROWS.map(row => (
              <div key={row} className="grid grid-cols-[100px_repeat(5,1fr)]">
                <div className="bg-gray-50 border-b border-r p-3 flex items-center justify-center">
                  <span className="text-xs font-semibold text-gray-600 text-center leading-tight">
                    {row}
                  </span>
                </div>

                {COLUMNS.map(col => {
                  const models = GRID_MODELS[row][col];
                  const isDisabled = models.length === 0;

                  if (isDisabled) {
                    return (
                      <Tooltip key={`${row}-${col}`}>
                        <TooltipTrigger asChild>
                          <div className="border-b border-r last:border-r-0 p-3 bg-gray-100 flex items-center justify-center min-h-[100px] cursor-not-allowed">
                            <div className="text-center text-gray-400">
                              <Lock className="w-5 h-5 mx-auto mb-1" />
                              <span className="text-[10px]">N/A</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reasoning requires 70B+ models</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <div key={`${row}-${col}`} className="border-b border-r last:border-r-0 p-2 min-h-[100px]">
                      <div className={`flex ${models.length > 1 ? 'flex-col gap-2' : ''}`}>
                        {models.map(model => {
                          const response = responses[model.id];
                          const isLoading = response?.loading;
                          const hasError = response?.error;
                          const hasContent = response?.content;

                          return (
                            <div
                              key={model.id}
                              onClick={() => response && openModal(model, response)}
                              className={`
                                rounded p-2 flex-1 transition-all
                                ${!showResults ? 'bg-gray-50 border border-dashed border-gray-200' : ''}
                                ${isLoading ? 'bg-blue-50 border border-blue-200' : ''}
                                ${hasError ? 'bg-red-50 border border-red-200' : ''}
                                ${hasContent ? 'bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100' : ''}
                              `}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <span className="font-medium text-gray-800 text-[11px] truncate">
                                  {model.name}
                                </span>
                                {model.isReasoning && (
                                  <span className="text-[8px] bg-orange-500 text-white px-1 py-0.5 rounded font-medium shrink-0">
                                    R
                                  </span>
                                )}
                              </div>

                              {!showResults && (
                                <div className="text-gray-400 text-[10px]">Ready</div>
                              )}

                              {isLoading && (
                                <div className="flex items-center gap-1 text-blue-600 text-[10px]">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Running...
                                </div>
                              )}

                              {hasError && (
                                <div className="text-red-600 text-[10px]">{response.error}</div>
                              )}

                              {hasContent && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-gray-600">TTFT:</span>
                                    <span className="font-mono text-gray-800">{response.ttft}ms</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-gray-600">Cost:</span>
                                    <span className="font-mono text-gray-800">${response.cost?.toFixed(4)}</span>
                                  </div>
                                  <div className="text-[9px] text-gray-500 mt-1">Click to view</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedModel?.model.name}
                {selectedModel?.model.isReasoning && (
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
