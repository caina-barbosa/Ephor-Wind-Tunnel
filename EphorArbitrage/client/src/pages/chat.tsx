import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
  const [showCards, setShowCards] = useState(false);
  
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
    setShowCards(true);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">EPHOR WIND TUNNEL</h1>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        <div className="w-[30%] border-r border-gray-200 bg-white p-4 flex flex-col">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            className="flex-1 resize-none text-sm mb-3"
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

        <div className="w-[70%] p-4 overflow-auto">
          <div className="grid grid-cols-5 gap-2 mb-1">
            {CATEGORIES.map((category) => (
              <Select
                key={category}
                value={selectedModels[category]}
                onValueChange={(value) => handleModelChange(category, value)}
                disabled={isRunning}
              >
                <SelectTrigger className="bg-gray-800 text-white border-gray-700 font-semibold h-9 text-sm">
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

          {showCards && (
            <div className="grid grid-cols-5 gap-2">
              {CATEGORIES.map((category) => {
                const model = getSelectedModel(category);
                const response = responses[category];
                const isLoading = response?.loading;
                const hasError = response?.error;
                const hasContent = response?.content;

                return (
                  <div
                    key={category}
                    className={`
                      rounded-b-lg border border-t-0 p-3 min-h-[100px]
                      ${isLoading ? "bg-blue-50 border-blue-200" : ""}
                      ${hasError ? "bg-red-50 border-red-200" : ""}
                      ${hasContent ? "bg-white border-green-200" : ""}
                      ${!isLoading && !hasError && !hasContent ? "bg-gray-50 border-gray-200" : ""}
                    `}
                  >
                    <div className="flex items-center gap-1 mb-2">
                      <span className="font-medium text-gray-900 text-xs truncate">
                        {model?.name}
                      </span>
                      {model?.isReasoning && (
                        <span className="text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded-full font-medium shrink-0">
                          R
                        </span>
                      )}
                    </div>

                    {isLoading && (
                      <div className="space-y-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-2/3"></div>
                        </div>
                        <div className="flex items-center gap-1 text-blue-600 text-[11px]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Generating...
                        </div>
                      </div>
                    )}

                    {hasError && (
                      <div className="text-red-600 text-[11px]">{response.error}</div>
                    )}

                    {hasContent && (
                      <div className="text-gray-700 text-[11px] line-clamp-5 overflow-hidden leading-tight">
                        {response.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
