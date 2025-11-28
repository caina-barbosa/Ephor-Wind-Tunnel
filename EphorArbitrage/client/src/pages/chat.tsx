import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ModelCell {
  id: string;
  name: string;
  category: "3B" | "7B" | "14B" | "70B" | "Frontier";
  isReasoning: boolean;
}

interface ModelResponse {
  content: string;
  loading: boolean;
  error: string | null;
}

const WIND_TUNNEL_MODELS: ModelCell[] = [
  { id: "together/qwen-2.5-3b-instruct", name: "Qwen 2.5 3B", category: "3B", isReasoning: false },
  { id: "together/qwen-2.5-7b-instruct-turbo", name: "Qwen 2.5 7B", category: "7B", isReasoning: false },
  { id: "together/qwen-2.5-14b-instruct", name: "Qwen 2.5 14B", category: "14B", isReasoning: false },
  { id: "meta-llama/llama-3.3-70b-instruct:cerebras", name: "Llama 3.3 70B", category: "70B", isReasoning: false },
  { id: "together/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", category: "70B", isReasoning: true },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", category: "Frontier", isReasoning: false },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", category: "Frontier", isReasoning: false },
  { id: "together/deepseek-r1", name: "DeepSeek R1", category: "Frontier", isReasoning: true },
  { id: "together/qwq-32b", name: "QwQ 32B", category: "Frontier", isReasoning: true },
  { id: "moonshotai/kimi-k2", name: "Kimi K2", category: "Frontier", isReasoning: false },
];

const CATEGORIES = ["3B", "7B", "14B", "70B", "Frontier"] as const;

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [isRunning, setIsRunning] = useState(false);

  const getModelsByCategory = (category: string) => {
    return WIND_TUNNEL_MODELS.filter((m) => m.category === category);
  };

  const handleRunAll = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);

    const initialResponses: Record<string, ModelResponse> = {};
    WIND_TUNNEL_MODELS.forEach((model) => {
      initialResponses[model.id] = { content: "", loading: true, error: null };
    });
    setResponses(initialResponses);

    const runModel = async (model: ModelCell) => {
      try {
        const response = await apiRequest("POST", "/api/wind-tunnel/run", {
          modelId: model.id,
          prompt: prompt,
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        const data = await response.json();

        setResponses((prev) => ({
          ...prev,
          [model.id]: {
            content: data.content || "",
            loading: false,
            error: null,
          },
        }));
      } catch (err) {
        setResponses((prev) => ({
          ...prev,
          [model.id]: {
            content: "",
            loading: false,
            error: "Failed to get response",
          },
        }));
      }
    };

    await Promise.all(WIND_TUNNEL_MODELS.map(runModel));

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

        <div className="grid grid-cols-5 gap-3 items-start">
          {CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-2">
              <div className="text-center py-2 bg-gray-800 text-white font-bold rounded-lg text-sm">
                {category}
              </div>

              {getModelsByCategory(category).map((model) => {
                const response = responses[model.id];
                const isEmpty = !response;
                const isLoading = response?.loading;
                const hasError = response?.error;
                const hasContent = response?.content;

                return (
                  <div
                    key={model.id}
                    className={`
                      rounded-lg border p-3
                      ${isEmpty ? "bg-gray-100 border-gray-200" : ""}
                      ${isLoading ? "bg-blue-50 border-blue-300" : ""}
                      ${hasError ? "bg-red-50 border-red-300" : ""}
                      ${hasContent ? "bg-white border-green-300" : ""}
                    `}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {model.name}
                      </span>
                      {model.isReasoning && (
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
                      <div className="text-gray-700 text-xs line-clamp-3 overflow-hidden">
                        {response.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
