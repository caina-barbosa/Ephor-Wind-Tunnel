import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Loader2 } from "lucide-react";
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
}

const MODELS_BY_CATEGORY: Record<string, Model[]> = {
  "3B": [
    { id: "together/qwen-2.5-3b-instruct", name: "Qwen 2.5 3B", isReasoning: false },
  ],
  "7B": [
    { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B", isReasoning: false },
  ],
  "14B": [
    { id: "together/qwen-2.5-14b-instruct", name: "Qwen 2.5 14B", isReasoning: false },
  ],
  "70B": [
    { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Llama 3.3 70B", isReasoning: false },
    { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", isReasoning: true },
  ],
  "Frontier": [
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", isReasoning: false },
    { id: "deepseek/deepseek-chat", name: "DeepSeek V3", isReasoning: false },
    { id: "together/deepseek-r1", name: "DeepSeek R1", isReasoning: true },
    { id: "together/qwq-32b", name: "QwQ 32B", isReasoning: true },
    { id: "moonshotai/kimi-k2", name: "Kimi K2", isReasoning: false },
  ],
};

const CATEGORIES = ["3B", "7B", "14B", "70B", "Frontier"] as const;

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [isRunning, setIsRunning] = useState(false);
  
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({
    "3B": MODELS_BY_CATEGORY["3B"][0].id,
    "7B": MODELS_BY_CATEGORY["7B"][0].id,
    "14B": MODELS_BY_CATEGORY["14B"][0].id,
    "70B": MODELS_BY_CATEGORY["70B"][0].id,
    "Frontier": MODELS_BY_CATEGORY["Frontier"][0].id,
  });

  const getSelectedModel = (category: string): Model | undefined => {
    const modelId = selectedModels[category];
    return MODELS_BY_CATEGORY[category].find(m => m.id === modelId);
  };

  const handleModelChange = (category: string, modelId: string) => {
    setSelectedModels(prev => ({ ...prev, [category]: modelId }));
  };

  const handleRunAll = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);

    const initialResponses: Record<string, ModelResponse> = {};
    CATEGORIES.forEach((category) => {
      initialResponses[category] = { content: "", loading: true, error: null };
    });
    setResponses(initialResponses);

    const runModel = async (category: string) => {
      const modelId = selectedModels[category];
      try {
        const response = await apiRequest("POST", "/api/wind-tunnel/run", {
          modelId,
          prompt: prompt,
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        const data = await response.json();

        setResponses((prev) => ({
          ...prev,
          [category]: {
            content: data.content || "",
            loading: false,
            error: null,
          },
        }));
      } catch (err) {
        setResponses((prev) => ({
          ...prev,
          [category]: {
            content: "",
            loading: false,
            error: "Failed to get response",
          },
        }));
      }
    };

    await Promise.all(CATEGORIES.map(runModel));

    setIsRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRunAll();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">EPHOR WIND TUNNEL</h1>

        <div className="mb-6 flex gap-4">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt..."
            className="flex-1 text-lg py-6"
            disabled={isRunning}
          />
          <Button
            onClick={handleRunAll}
            disabled={!prompt.trim() || isRunning}
            className="px-8 py-6 text-lg bg-blue-600 hover:bg-blue-700"
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
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4">
          {CATEGORIES.map((category) => (
            <Select
              key={category}
              value={selectedModels[category]}
              onValueChange={(value) => handleModelChange(category, value)}
              disabled={isRunning}
            >
              <SelectTrigger className="bg-gray-800 text-white border-gray-700 font-semibold">
                <span>{category}</span>
              </SelectTrigger>
              <SelectContent>
                {MODELS_BY_CATEGORY[category].map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                    {model.isReasoning && (
                      <span className="ml-2 text-orange-500 text-xs">(reasoning)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-3">
          {CATEGORIES.map((category) => {
            const model = getSelectedModel(category);
            const response = responses[category];
            const isEmpty = !response;
            const isLoading = response?.loading;
            const hasError = response?.error;
            const hasContent = response?.content;

            return (
              <div
                key={category}
                className={`
                  rounded-lg border p-4 min-h-[150px]
                  ${isEmpty ? "bg-gray-100 border-gray-200" : ""}
                  ${isLoading ? "bg-blue-50 border-blue-300" : ""}
                  ${hasError ? "bg-red-50 border-red-300" : ""}
                  ${hasContent ? "bg-white border-green-300" : ""}
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-900 text-sm">
                    {model?.name}
                  </span>
                  {model?.isReasoning && (
                    <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                      reasoning
                    </span>
                  )}
                </div>

                {isEmpty && (
                  <div className="text-gray-400 text-xs">
                    Waiting for prompt...
                  </div>
                )}

                {isLoading && (
                  <div className="flex items-center gap-2 text-blue-600 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating...
                  </div>
                )}

                {hasError && (
                  <div className="text-red-600 text-xs">{response.error}</div>
                )}

                {hasContent && (
                  <div className="text-gray-700 text-xs line-clamp-6 overflow-hidden">
                    {response.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
