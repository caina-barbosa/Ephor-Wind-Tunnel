import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Play, Loader2, Lock, Zap, Clock, DollarSign, Brain, Info, CheckCircle2, XCircle, Target, TrendingUp, AlertTriangle, Users, Trophy, MessageSquare, Bookmark, Library, Trash2, RefreshCw, Flag, ShieldAlert, FileText, Image, BarChart3, Code2, ChevronDown, ChevronUp, Cpu, Database, Settings, Shield, Layers, Plus, Paperclip, X, File, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TechnicalProfile {
  architecture: {
    type: "Dense Transformer" | "Sparse MoE";
    attention: string;
    parameters: string;
  };
  training: {
    dataDate: string;
    dataSources: string[];
  };
  finetuning: {
    method: "Instruct" | "RLHF" | "DPO" | "ORPO" | "SFT";
    variants?: string[];
  };
  inference: {
    precision: "FP32" | "FP16" | "BF16" | "INT8" | "INT4";
    optimizations?: string[];
  };
  safety: {
    aligned: boolean;
    methods: string[];
  };
}

interface Model {
  id: string;
  name: string;
  costPer1k: number;
  expectedLatency: "fast" | "medium" | "slow";
  reasoningDepth: "none" | "shallow" | "deep";
  expectedAccuracy: "basic" | "good" | "strong" | "excellent";
  benchmarks: {
    mmlu?: number;
    humanEval?: number;
  };
  modality: "text" | "text+image" | "text+image+audio";
  technical: TechnicalProfile;
}

interface ModelResponse {
  content: string;
  loading: boolean;
  error: string | null;
  latency: number | null;
  cost: number | null;
  progress: number;
}

const COLUMNS = ["8B", "14B", "32B", "72B", "685B", "Frontier"] as const;

const NON_REASONING_MODELS: Record<string, Model> = {
  "8B": { 
    id: "openrouter/qwen/qwen3-8b", 
    name: "Qwen3-8B", 
    costPer1k: 0.00012, 
    expectedLatency: "fast", 
    reasoningDepth: "shallow", 
    expectedAccuracy: "good", 
    benchmarks: { mmlu: 74.2, humanEval: 75.6 }, 
    modality: "text",
    technical: {
      architecture: { type: "Dense Transformer", attention: "GQA", parameters: "8.2B" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Multilingual (119 langs)"] },
      finetuning: { method: "SFT", variants: ["Instruct", "Thinking/Non-thinking dual mode"] },
      inference: { precision: "FP16", optimizations: ["Dual-mode architecture"] },
      safety: { aligned: true, methods: ["DPO", "Safety filtering"] }
    }
  },
  "14B": { 
    id: "openrouter/qwen/qwen3-14b", 
    name: "Qwen3-14B", 
    costPer1k: 0.00015, 
    expectedLatency: "fast", 
    reasoningDepth: "shallow", 
    expectedAccuracy: "strong", 
    benchmarks: { mmlu: 79.8, humanEval: 78.5 }, 
    modality: "text",
    technical: {
      architecture: { type: "Dense Transformer", attention: "GQA", parameters: "14B" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Multilingual (119 langs)"] },
      finetuning: { method: "SFT", variants: ["Instruct", "Thinking/Non-thinking dual mode"] },
      inference: { precision: "FP16", optimizations: ["Dual-mode architecture"] },
      safety: { aligned: true, methods: ["DPO", "Safety filtering"] }
    }
  },
  "32B": { 
    id: "openrouter/qwen/qwen3-32b", 
    name: "Qwen3-32B", 
    costPer1k: 0.0002, 
    expectedLatency: "medium", 
    reasoningDepth: "shallow", 
    expectedAccuracy: "strong", 
    benchmarks: { mmlu: 83.5, humanEval: 82.4 }, 
    modality: "text",
    technical: {
      architecture: { type: "Dense Transformer", attention: "GQA", parameters: "32B" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Multilingual (119 langs)"] },
      finetuning: { method: "SFT", variants: ["Instruct", "Thinking/Non-thinking dual mode"] },
      inference: { precision: "BF16", optimizations: ["Dual-mode architecture"] },
      safety: { aligned: true, methods: ["DPO", "Safety filtering"] }
    }
  },
  "72B": { 
    id: "openrouter/qwen/qwen2.5-72b-instruct", 
    name: "Qwen2.5-72B", 
    costPer1k: 0.0003, 
    expectedLatency: "medium", 
    reasoningDepth: "none", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 85.3, humanEval: 86.3 }, 
    modality: "text",
    technical: {
      architecture: { type: "Dense Transformer", attention: "GQA", parameters: "72B" },
      training: { dataDate: "2024", dataSources: ["Web", "Code", "Math", "Multilingual"] },
      finetuning: { method: "DPO", variants: ["Instruct"] },
      inference: { precision: "BF16", optimizations: ["GQA optimized"] },
      safety: { aligned: true, methods: ["DPO", "Safety filtering"] }
    }
  },
  "685B": { 
    id: "openrouter/deepseek/deepseek-v3.2", 
    name: "DeepSeek V3.2", 
    costPer1k: 0.00035, 
    expectedLatency: "medium", 
    reasoningDepth: "shallow", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 88.5, humanEval: 89.2 }, 
    modality: "text",
    technical: {
      architecture: { type: "Sparse MoE", attention: "DSA (Sparse)", parameters: "685B total / 37B active" },
      training: { dataDate: "2024", dataSources: ["Web", "Code", "Math", "Scientific", "Multilingual"] },
      finetuning: { method: "RLHF", variants: ["Instruct", "Agentic"] },
      inference: { precision: "BF16", optimizations: ["MoE routing", "DeepSeek Sparse Attention"] },
      safety: { aligned: true, methods: ["RLHF", "Safety filtering"] }
    }
  },
  "Frontier": { 
    id: "anthropic/claude-sonnet-4.5", 
    name: "Claude Sonnet 4.5", 
    costPer1k: 0.015, 
    expectedLatency: "slow", 
    reasoningDepth: "none", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 86.5, humanEval: 93.7 }, 
    modality: "text+image",
    technical: {
      architecture: { type: "Dense Transformer", attention: "MHA", parameters: "Undisclosed" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Books", "Scientific", "Curated"] },
      finetuning: { method: "RLHF", variants: ["Constitutional AI", "RLAIF"] },
      inference: { precision: "BF16" },
      safety: { aligned: true, methods: ["Constitutional AI", "RLHF", "Red teaming"] }
    }
  },
};

// REASONING MODELS - Used when Reasoning toggle is ON (models that support chain-of-thought)
const REASONING_MODELS: Record<string, Model | null> = {
  "8B": null, // Too small for reasoning
  "14B": null, // Too small for reasoning
  "32B": null, // Too small for deep reasoning
  "72B": { 
    id: "together/deepseek-r1", 
    name: "DeepSeek R1", 
    costPer1k: 0.003, 
    expectedLatency: "slow", 
    reasoningDepth: "deep", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 90.8, humanEval: 97.3 }, 
    modality: "text",
    technical: {
      architecture: { type: "Sparse MoE", attention: "MLA", parameters: "671B total / 37B active" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Scientific", "Reasoning"] },
      finetuning: { method: "RLHF", variants: ["RL reasoning", "GRPO"] },
      inference: { precision: "BF16", optimizations: ["MoE routing", "Long CoT"] },
      safety: { aligned: true, methods: ["RLHF", "Reasoning safety"] }
    }
  },
  "685B": { 
    id: "openrouter/deepseek/deepseek-v3.2", 
    name: "DeepSeek V3.2 + Reasoning", 
    costPer1k: 0.0004, 
    expectedLatency: "slow", 
    reasoningDepth: "deep", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 90.5, humanEval: 92.0 }, 
    modality: "text",
    technical: {
      architecture: { type: "Sparse MoE", attention: "DSA (Sparse)", parameters: "685B total / 37B active" },
      training: { dataDate: "2024", dataSources: ["Web", "Code", "Math", "Scientific", "Reasoning"] },
      finetuning: { method: "RLHF", variants: ["Instruct", "Reasoning-enabled"] },
      inference: { precision: "BF16", optimizations: ["MoE routing", "DeepSeek Sparse Attention", "reasoning_enabled"] },
      safety: { aligned: true, methods: ["RLHF", "Reasoning safety"] }
    }
  },
  "Frontier": { 
    id: "anthropic/claude-sonnet-4.5", 
    name: "Claude Sonnet 4.5", 
    costPer1k: 0.015, 
    expectedLatency: "slow", 
    reasoningDepth: "deep", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 86.5, humanEval: 93.7 }, 
    modality: "text+image",
    technical: {
      architecture: { type: "Dense Transformer", attention: "MHA", parameters: "Undisclosed" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Books", "Scientific", "Curated"] },
      finetuning: { method: "RLHF", variants: ["Constitutional AI", "Extended Thinking"] },
      inference: { precision: "BF16" },
      safety: { aligned: true, methods: ["Constitutional AI", "RLHF", "Red teaming"] }
    }
  },
};

// SEARCH MODELS - Used when Search toggle is ON
// Uses OpenRouter's :online suffix for web search on the same models
// Exa search costs ~$0.02/request (5 results), Claude uses native search
// IMPORTANT: 8B/14B/32B are DISABLED because OpenRouter's :online variants have 40K context limit
// but Exa search returns 70K-140K tokens, causing guaranteed overflow
const SEARCH_MODELS: Record<string, Model | null> = {
  "8B": null, // OpenRouter :online has 40K limit, Exa returns 70K-140K tokens
  "14B": null, // OpenRouter :online has 40K limit, Exa returns 70K-140K tokens
  "32B": null, // OpenRouter :online has 40K limit, Exa returns 70K-140K tokens
  "72B": { 
    id: "openrouter/qwen/qwen2.5-72b-instruct:online", 
    name: "Qwen2.5-72B + Search", 
    costPer1k: 0.0005, 
    expectedLatency: "medium", 
    reasoningDepth: "shallow", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 85.3, humanEval: 86.3 }, 
    modality: "text",
    technical: {
      architecture: { type: "Dense Transformer", attention: "GQA", parameters: "72B (128K context)" },
      training: { dataDate: "2024", dataSources: ["Web", "Code", "Books", "Real-time Search"] },
      finetuning: { method: "SFT", variants: ["Instruct", "Search-augmented"] },
      inference: { precision: "BF16", optimizations: ["GQA", "Exa web grounding"] },
      safety: { aligned: true, methods: ["SFT alignment", "Source verification"] }
    }
  },
  "685B": { 
    id: "openrouter/deepseek/deepseek-v3.2:online", 
    name: "DeepSeek V3.2 + Search", 
    costPer1k: 0.0006, 
    expectedLatency: "medium", 
    reasoningDepth: "shallow", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 88.5, humanEval: 89.2 }, 
    modality: "text",
    technical: {
      architecture: { type: "Sparse MoE", attention: "DSA (Sparse)", parameters: "685B total / 37B active" },
      training: { dataDate: "2024", dataSources: ["Web", "Code", "Math", "Real-time Search"] },
      finetuning: { method: "RLHF", variants: ["Instruct", "Search-augmented"] },
      inference: { precision: "BF16", optimizations: ["MoE routing", "Exa web grounding"] },
      safety: { aligned: true, methods: ["RLHF", "Source verification"] }
    }
  },
  "Frontier": { 
    id: "openrouter/anthropic/claude-sonnet-4:online", 
    name: "Claude Sonnet 4 + Search", 
    costPer1k: 0.018, 
    expectedLatency: "medium", 
    reasoningDepth: "deep", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 86.5, humanEval: 93.7 }, 
    modality: "text+image",
    technical: {
      architecture: { type: "Dense Transformer", attention: "MHA", parameters: "Undisclosed" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Books", "Native Search"] },
      finetuning: { method: "RLHF", variants: ["Constitutional AI", "Native web search"] },
      inference: { precision: "BF16", optimizations: ["Native Anthropic search"] },
      safety: { aligned: true, methods: ["Constitutional AI", "RLHF", "Source verification"] }
    }
  },
};

// REASONING + SEARCH MODELS - Used when BOTH toggles are ON
// Combines chain-of-thought reasoning with web search capabilities
// Only 72B and Frontier truly support both; smaller tiers use search-only
const REASONING_SEARCH_MODELS: Record<string, Model | null> = {
  "8B": null, // Reasoning not available - will fall back to search-only
  "14B": null, // Reasoning not available - will fall back to search-only
  "32B": null, // Reasoning not available - will fall back to search-only
  "72B": { 
    id: "openrouter/deepseek/deepseek-r1:online", 
    name: "DeepSeek R1 + Reasoning + Search", 
    costPer1k: 0.0028, 
    expectedLatency: "slow", 
    reasoningDepth: "deep", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 90.8, humanEval: 92.8 }, 
    modality: "text",
    technical: {
      architecture: { type: "Sparse MoE", attention: "MLA", parameters: "671B total / 37B active" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Reasoning", "Real-time Search"] },
      finetuning: { method: "RLHF", variants: ["RL reasoning", "Search-augmented"] },
      inference: { precision: "BF16", optimizations: ["MoE routing", "Exa web grounding"] },
      safety: { aligned: true, methods: ["RLHF", "Constitutional AI", "Source verification"] }
    }
  },
  "685B": { 
    id: "openrouter/deepseek/deepseek-v3.2:online", 
    name: "DeepSeek V3.2 + Reasoning + Search", 
    costPer1k: 0.0007, 
    expectedLatency: "slow", 
    reasoningDepth: "deep", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 90.5, humanEval: 92.0 }, 
    modality: "text",
    technical: {
      architecture: { type: "Sparse MoE", attention: "DSA (Sparse)", parameters: "685B total / 37B active" },
      training: { dataDate: "2024", dataSources: ["Web", "Code", "Math", "Reasoning", "Real-time Search"] },
      finetuning: { method: "RLHF", variants: ["Reasoning-enabled", "Search-augmented"] },
      inference: { precision: "BF16", optimizations: ["MoE routing", "Exa web grounding", "reasoning_enabled"] },
      safety: { aligned: true, methods: ["RLHF", "Source verification"] }
    }
  },
  "Frontier": { 
    id: "openrouter/anthropic/claude-sonnet-4:online", 
    name: "Claude Sonnet 4 + Reasoning + Search", 
    costPer1k: 0.022, 
    expectedLatency: "medium", 
    reasoningDepth: "deep", 
    expectedAccuracy: "excellent", 
    benchmarks: { mmlu: 88.5, humanEval: 94.2 }, 
    modality: "text+image",
    technical: {
      architecture: { type: "Dense Transformer", attention: "MHA", parameters: "Undisclosed" },
      training: { dataDate: "2025", dataSources: ["Web", "Code", "Books", "Native Search"] },
      finetuning: { method: "RLHF", variants: ["Constitutional AI", "Native web search"] },
      inference: { precision: "BF16", optimizations: ["Native Anthropic search"] },
      safety: { aligned: true, methods: ["Constitutional AI", "RLHF", "Source verification"] }
    }
  },
};

// MODEL ALTERNATIVES - Multiple models per band for comparison in Expert Mode
const MODEL_ALTERNATIVES: Record<string, Model[]> = {
  "8B": [
    NON_REASONING_MODELS["8B"],
    { 
      id: "openrouter/deepseek/deepseek-r1-distill-qwen-7b", 
      name: "DeepSeek-R1-7B", 
      costPer1k: 0.0002, 
      expectedLatency: "fast", 
      reasoningDepth: "shallow", 
      expectedAccuracy: "good", 
      benchmarks: { mmlu: 75.8, humanEval: 78.2 }, 
      modality: "text",
      technical: {
        architecture: { type: "Dense Transformer", attention: "GQA", parameters: "7B" },
        training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Reasoning traces"] },
        finetuning: { method: "SFT", variants: ["Distillation", "R1"] },
        inference: { precision: "BF16" },
        safety: { aligned: true, methods: ["SFT", "Safety filtering"] }
      }
    },
  ],
  "14B": [
    NON_REASONING_MODELS["14B"],
    { 
      id: "openrouter/deepseek/deepseek-r1-distill-qwen-14b", 
      name: "DeepSeek-R1-14B", 
      costPer1k: 0.00025, 
      expectedLatency: "fast", 
      reasoningDepth: "shallow", 
      expectedAccuracy: "strong", 
      benchmarks: { mmlu: 80.2, humanEval: 79.8 }, 
      modality: "text",
      technical: {
        architecture: { type: "Dense Transformer", attention: "GQA", parameters: "14B" },
        training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Reasoning traces"] },
        finetuning: { method: "SFT", variants: ["Distillation", "R1"] },
        inference: { precision: "BF16" },
        safety: { aligned: true, methods: ["SFT", "Safety filtering"] }
      }
    },
  ],
  "32B": [
    NON_REASONING_MODELS["32B"],
    { 
      id: "openrouter/qwen/qwq-32b", 
      name: "QwQ-32B", 
      costPer1k: 0.00025, 
      expectedLatency: "medium", 
      reasoningDepth: "deep", 
      expectedAccuracy: "strong", 
      benchmarks: { mmlu: 84.5, humanEval: 83.1 }, 
      modality: "text",
      technical: {
        architecture: { type: "Dense Transformer", attention: "GQA", parameters: "32B" },
        training: { dataDate: "2025", dataSources: ["Web", "Code", "Math", "Reasoning"] },
        finetuning: { method: "DPO", variants: ["Reasoning", "QwQ"] },
        inference: { precision: "BF16" },
        safety: { aligned: true, methods: ["DPO", "Safety filtering"] }
      }
    },
  ],
  "72B": [
    NON_REASONING_MODELS["72B"],
    { 
      id: "openrouter/qwen/qwen-2-72b-instruct", 
      name: "Qwen2-72B", 
      costPer1k: 0.0009, 
      expectedLatency: "medium", 
      reasoningDepth: "none", 
      expectedAccuracy: "strong", 
      benchmarks: { mmlu: 84.2, humanEval: 85.0 }, 
      modality: "text",
      technical: {
        architecture: { type: "Dense Transformer", attention: "GQA", parameters: "72B" },
        training: { dataDate: "2024", dataSources: ["Web", "Code", "Math", "Multilingual"] },
        finetuning: { method: "DPO", variants: ["Instruct"] },
        inference: { precision: "BF16" },
        safety: { aligned: true, methods: ["DPO", "Safety filtering"] }
      }
    },
  ],
  "685B": [
    NON_REASONING_MODELS["685B"],
  ],
  "Frontier": [
    NON_REASONING_MODELS["Frontier"],
    { 
      id: "openrouter/moonshotai/kimi-k2-instruct", 
      name: "Kimi K2", 
      costPer1k: 0.012, 
      expectedLatency: "medium", 
      reasoningDepth: "deep", 
      expectedAccuracy: "excellent", 
      benchmarks: { mmlu: 87.5, humanEval: 91.2 }, 
      modality: "text",
      technical: {
        architecture: { type: "Sparse MoE", attention: "MHA", parameters: "1T+ total / 32B active" },
        training: { dataDate: "2025", dataSources: ["Web", "Code", "Books", "Scientific", "Curated"] },
        finetuning: { method: "RLHF", variants: ["Instruct"] },
        inference: { precision: "BF16", optimizations: ["MoE routing"] },
        safety: { aligned: true, methods: ["RLHF", "Safety filtering"] }
      }
    },
  ],
};

// Baseline for relative delta display (4B band / DeepSeek-R1-8B MMLU)
const BASELINE_MMLU = 72.5;

// Helper: Get reasoning depth for a band (shows capability even when reasoning mode is off)
const getReasoningDepthForBand = (col: string): { depth: "none" | "shallow" | "deep"; label: string; color: string } => {
  switch (col) {
    case "8B": 
    case "14B": 
    case "32B": 
      return { depth: "none", label: "None", color: "text-gray-400" };
    case "72B": 
      return { depth: "shallow", label: "Shallow", color: "text-amber-600" };
    case "685B":
      return { depth: "deep", label: "Deep", color: "text-emerald-600" };
    case "Frontier": 
      return { depth: "deep", label: "Deep", color: "text-emerald-600" };
    default: 
      return { depth: "none", label: "None", color: "text-gray-400" };
  }
};

// Helper: Format MMLU delta vs baseline
const formatMmluDelta = (mmlu: number): string => {
  const delta = mmlu - BASELINE_MMLU;
  if (delta > 0) return `+${delta.toFixed(0)} pts vs 3B`;
  if (delta < 0) return `${delta.toFixed(0)} pts vs 3B`;
  return "baseline";
};

const CONTEXT_SIZES = [
  { value: "8k", tokens: 8000, label: "8K" },
  { value: "32k", tokens: 32000, label: "32K" },
  { value: "128k", tokens: 128000, label: "128K" },
  { value: "1m", tokens: 1000000, label: "1M" },
] as const;

const CHALLENGE_PROMPTS = [
  "Explain why 0.999... (repeating) equals exactly 1. Provide a rigorous mathematical proof.",
  "Write a Python function to find the longest palindromic substring in a given string. Explain your approach and time complexity.",
  "A bat and ball cost $1.10 total. The bat costs $1 more than the ball. How much does the ball cost? Show your reasoning step by step.",
  "Explain the Monty Hall problem and why switching doors gives you a 2/3 chance of winning. Most people get this wrong!",
  "Write a recursive function to generate all valid combinations of n pairs of parentheses. Explain the logic.",
  "A farmer has 17 sheep. All but 9 run away. How many sheep does the farmer have left? Explain your reasoning.",
  "Explain why the sum of all positive integers (1+2+3+4+...) is sometimes said to equal -1/12. Is this real math?",
  "Write a function to detect if a linked list has a cycle, using O(1) space. Explain the algorithm.",
];

const COLUMN_VISUALS: Record<string, {
  headerSize: string;
  headerBg: string;
  cardStyle: string;
  prominence: "small" | "medium" | "large";
  accentBorder: string;
}> = {
  "8B": {
    headerSize: "text-2xl font-bold text-blue-700",
    headerBg: "bg-blue-50",
    cardStyle: "bg-white",
    prominence: "small",
    accentBorder: "border-t-[6px] border-t-[#2563EB]"
  },
  "14B": {
    headerSize: "text-2xl font-bold text-emerald-700",
    headerBg: "bg-emerald-50",
    cardStyle: "bg-white",
    prominence: "small",
    accentBorder: "border-t-[6px] border-t-[#16A34A]"
  },
  "32B": {
    headerSize: "text-2xl font-bold text-emerald-700",
    headerBg: "bg-emerald-50",
    cardStyle: "bg-white",
    prominence: "medium",
    accentBorder: "border-t-[6px] border-t-[#16A34A]"
  },
  "72B": {
    headerSize: "text-2xl font-bold text-violet-700",
    headerBg: "bg-violet-50",
    cardStyle: "bg-white",
    prominence: "medium",
    accentBorder: "border-t-[6px] border-t-[#7C3AED]"
  },
  "685B": {
    headerSize: "text-2xl font-bold text-violet-700",
    headerBg: "bg-violet-50",
    cardStyle: "bg-white",
    prominence: "medium",
    accentBorder: "border-t-[6px] border-t-[#7C3AED]"
  },
  "Frontier": {
    headerSize: "text-2xl font-bold text-[#EA580C]",
    headerBg: "bg-orange-50",
    cardStyle: "bg-white",
    prominence: "large",
    accentBorder: "border-t-[6px] border-t-[#EA580C]"
  },
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

const getCapabilityVisuals = (accuracy: "basic" | "good" | "strong" | "excellent", col?: string) => {
  switch (accuracy) {
    case "basic": return { bars: 1, color: "bg-[#A3316F]", textColor: "text-[#A3316F]", label: "Basic" };
    case "good": return { bars: 2, color: "bg-blue-400", textColor: "text-blue-600", label: "Good" };
    case "strong": return { bars: 3, color: "bg-emerald-500", textColor: "text-emerald-600", label: "Strong" };
    case "excellent": 
      // Purple for 72B/685B, orange for Frontier
      if (col === "72B" || col === "685B") {
        return { bars: 4, color: "bg-violet-500", textColor: "text-violet-600", label: "Excellent" };
      }
      return { bars: 4, color: "bg-[#f5a623]", textColor: "text-[#f5a623]", label: "Excellent" };
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

const getSkillTag = (col: string): string => {
  switch (col) {
    case "8B": return "Fast & efficient baseline";
    case "14B": return "Solid general assistant";
    case "32B": return "Strong reasoning";
    case "72B": return "Multi-step reasoning";
    case "Frontier": return "Coding & complex tasks";
    default: return "General purpose model";
  }
};

const getContextTightFitWarning = (tokenCount: number, selectedTokens: number): string | null => {
  if (tokenCount <= 0) return null;
  const percentUsed = (tokenCount / selectedTokens) * 100;
  if (percentUsed >= 90 && percentUsed <= 100) {
    return "Fits, but tight — risk of truncation if you add more.";
  }
  return null;
};

const formatTokenCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const getLatencyColor = (_latency?: "fast" | "medium" | "slow") => "text-gray-600";
const getLatencyLabel = (latency: "fast" | "medium" | "slow") => getLatencyBarConfig(latency).label;
const getCapabilityColor = (_accuracy?: "basic" | "good" | "strong" | "excellent") => "text-gray-600";
const getCapabilityLabel = (accuracy: "basic" | "good" | "strong" | "excellent") => getCapabilityVisuals(accuracy).label;

const getRecommendedContextTier = (tokenCount: number): string => {
  for (const size of CONTEXT_SIZES) {
    if (tokenCount <= size.tokens) {
      return size.value;
    }
  }
  return "1m";
};

const getContextTierLabel = (tierValue: string, tokenCount: number, recommendedTier: string): { label: string; status: "recommended" | "higher" | "wontfit" } => {
  const tier = CONTEXT_SIZES.find(s => s.value === tierValue);
  if (!tier) return { label: tierValue, status: "higher" };
  
  if (tokenCount > tier.tokens) {
    return { label: `${tier.label} tokens — ❌ Won't fit`, status: "wontfit" };
  }
  
  if (tierValue === recommendedTier) {
    return { label: `${tier.label} tokens — ✅ Recommended`, status: "recommended" };
  }
  
  const tierIndex = CONTEXT_SIZES.findIndex(s => s.value === tierValue);
  const recIndex = CONTEXT_SIZES.findIndex(s => s.value === recommendedTier);
  
  if (tierIndex > recIndex) {
    const costDiff = tierIndex - recIndex;
    const costLabel = costDiff === 1 ? "Higher cost" : costDiff === 2 ? "Much higher cost" : "Extreme cost";
    return { label: `${tier.label} tokens — ${costLabel}`, status: "higher" };
  }
  
  return { label: `${tier.label} tokens`, status: "higher" };
};

// Helper to get minimum cost for a band based on current settings
const getMinimumCostForBand = (
  col: string, 
  inputTokenEstimate: number
): number => {
  const model = NON_REASONING_MODELS[col];
  if (!model) return Infinity;
  const estimatedTokens = Math.max(inputTokenEstimate, 100) + 500;
  return (estimatedTokens / 1000) * model.costPer1k;
};

// Get cost multiplier explanation for why a band is over budget
const getCostMultiplierExplanation = (
  contextSize: string
): string[] => {
  const explanations: string[] = [];
  const contextIndex = CONTEXT_SIZES.findIndex(s => s.value === contextSize);
  if (contextIndex > 0) {
    const contextLabel = CONTEXT_SIZES[contextIndex]?.label || contextSize.toUpperCase();
    const multiplier = Math.pow(2, contextIndex);
    if (multiplier > 1) {
      explanations.push(`Context at ${contextLabel} adds ~${multiplier}× cost.`);
    }
  }
  return explanations;
};

// Find the cheapest eligible band that's within budget
const getCheapestEligibleBand = (
  costCap: number,
  inputTokenEstimate: number
): string | null => {
  for (const col of COLUMNS) {
    const minCost = getMinimumCostForBand(col, inputTokenEstimate);
    if (minCost <= costCap) {
      return col;
    }
  }
  return null;
};

// Uploaded file with token estimation
interface UploadedFile {
  id: string;
  serverId?: string; // Server-side file ID for large files uploaded via multipart
  name: string;
  type: 'image' | 'text' | 'pdf';
  mimeType: string; // Full MIME type like 'image/png', 'text/plain'
  size: number;
  estimatedTokens: number;
  preview?: string; // For images: data URL, for text: first 100 chars
  dataUrl?: string; // Full base64 data URL for sending to API (images) - only for small files
  textContent?: string; // Full text content for text files
}

// Token estimation for different file types
const estimateFileTokens = (file: File): Promise<{ tokens: number; preview?: string; dataUrl?: string; textContent?: string }> => {
  return new Promise((resolve) => {
    const fileType = file.type;
    
    // Image files: estimate based on dimensions/size
    // OpenAI's vision pricing: ~85 tokens for low-res, ~170 tokens per 512x512 tile for high-res
    if (fileType.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = document.createElement('img');
        img.onload = () => {
          const width = img.width;
          const height = img.height;
          // Simplified token estimation for images
          // ~765 tokens for a typical 1024x1024 image, scaled by actual dimensions
          const baseTokens = 765;
          const scaleFactor = (width * height) / (1024 * 1024);
          const tokens = Math.ceil(Math.max(85, baseTokens * Math.min(scaleFactor, 4)));
          resolve({ tokens, preview: dataUrl, dataUrl });
        };
        img.onerror = () => {
          // Fallback: estimate based on file size (~1 token per 50 bytes for images)
          resolve({ tokens: Math.ceil(file.size / 50), dataUrl });
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        resolve({ tokens: Math.ceil(file.size / 50) });
      };
      reader.readAsDataURL(file);
      return;
    }
    
    // Text files (.txt, .md): count characters and estimate tokens
    if (fileType === 'text/plain' || fileType === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const tokens = Math.ceil(text.length / 4); // ~4 chars per token
        const preview = text.substring(0, 100) + (text.length > 100 ? '...' : '');
        resolve({ tokens, preview, textContent: text });
      };
      reader.onerror = () => {
        // Fallback: estimate based on file size
        resolve({ tokens: Math.ceil(file.size / 4) });
      };
      reader.readAsText(file);
      return;
    }
    
    // PDF files: estimate based on file size (rough approximation)
    // PDFs typically have ~500-1000 characters per KB of text content
    if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
      // Estimate ~250 tokens per KB (accounting for PDF overhead)
      const tokens = Math.ceil((file.size / 1024) * 250);
      resolve({ tokens, preview: `PDF document (${Math.ceil(file.size / 1024)} KB)` });
      return;
    }
    
    // Default: estimate based on file size
    resolve({ tokens: Math.ceil(file.size / 4) });
  });
};

export default function ChatPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, ModelResponse>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ col: string; model: Model; response: ModelResponse } | null>(null);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [testRunCount, setTestRunCount] = useState(0);
  
  const [showSaveBenchmarkModal, setShowSaveBenchmarkModal] = useState(false);
  const [benchmarkName, setBenchmarkName] = useState("");
  const [benchmarkDescription, setBenchmarkDescription] = useState("");
  
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [expandedTechDetails, setExpandedTechDetails] = useState<Record<string, boolean>>({});
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
    settings: { contextSize: string; costCap: number } | null;
    results: Record<string, { latency: number; cost: number; modelName: string; modelId: string }> | null;
    createdAt: string;
  }>>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  
  const [contextSize, setContextSize] = useState<string>("8k");
  const [contextAutoSelected, setContextAutoSelected] = useState(true);
  const [showContextMismatch, setShowContextMismatch] = useState(false);
  const [pendingRecommendedTier, setPendingRecommendedTier] = useState<string | null>(null);
  const [showWontFitModal, setShowWontFitModal] = useState(false);
  const [pendingWontFitContext, setPendingWontFitContext] = useState<string | null>(null);
  const [wontFitConfirmed, setWontFitConfirmed] = useState(false);
  const [truncationAccepted, setTruncationAccepted] = useState(false); // Persists after modal closes
  const [costFlash, setCostFlash] = useState(false);
  const [costCap, setCostCap] = useState<number>(0.25);
  const [expertMode, setExpertMode] = useState(false);
  const [challengePromptIndex, setChallengePromptIndex] = useState(0);
  const [showReasoningExplainModal, setShowReasoningExplainModal] = useState(false);
  
  // Expert Mode: Context Safety Buffer (off, +10%, +25%)
  const [safetyBuffer, setSafetyBuffer] = useState<"off" | "10" | "25">("off");
  const [showBufferWarning, setShowBufferWarning] = useState(false);
  
  // Expert Mode: Selected model overrides per band (for model swap feature)
  const [selectedModelPerBand, setSelectedModelPerBand] = useState<Record<string, number>>({
    "8B": 0, "14B": 0, "32B": 0, "72B": 0, "Frontier": 0
  });
  
  // Global mode toggles
  const [reasoningMode, setReasoningMode] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  // Track previous cost cap for budget change toasts (prevents spam on slider drag)
  const [lastBudgetToastTime, setLastBudgetToastTime] = useState<number>(0);
  const [prevOverBudgetBands, setPrevOverBudgetBands] = useState<Set<string>>(new Set());

  // Calculate total file tokens
  const fileTokens = useMemo(() => {
    return uploadedFiles.reduce((sum, file) => sum + file.estimatedTokens, 0);
  }, [uploadedFiles]);

  // Separate token calculations for visual breakdown
  const promptTokens = useMemo(() => {
    return Math.ceil(prompt.length / 4);
  }, [prompt]);

  // Image tokens (subset of file tokens)
  const imageTokens = useMemo(() => {
    return uploadedFiles
      .filter(file => file.type === 'image')
      .reduce((sum, file) => sum + file.estimatedTokens, 0);
  }, [uploadedFiles]);

  // Text file tokens (non-image files)
  const textFileTokens = useMemo(() => {
    return uploadedFiles
      .filter(file => file.type !== 'image')
      .reduce((sum, file) => sum + file.estimatedTokens, 0);
  }, [uploadedFiles]);

  // Estimated search tokens (when search mode is on)
  // Web search typically adds 15,000-25,000 tokens of results
  const estimatedSearchTokens = useMemo(() => {
    return searchMode ? 20000 : 0;
  }, [searchMode]);

  const inputTokenEstimate = useMemo(() => {
    return promptTokens + fileTokens;
  }, [promptTokens, fileTokens]);

  // Total including search estimate (for context planning)
  const totalWithSearchEstimate = useMemo(() => {
    return inputTokenEstimate + estimatedSearchTokens;
  }, [inputTokenEstimate, estimatedSearchTokens]);

  // Buffer multiplier calculation (Expert Mode only)
  const bufferMultiplier = useMemo(() => {
    if (!expertMode || safetyBuffer === "off") return 1.0;
    if (safetyBuffer === "10") return 1.1;
    if (safetyBuffer === "25") return 1.25;
    return 1.0;
  }, [expertMode, safetyBuffer]);

  // Effective tokens = prompt tokens * buffer multiplier
  const effectiveTokens = useMemo(() => {
    return Math.ceil(inputTokenEstimate * bufferMultiplier);
  }, [inputTokenEstimate, bufferMultiplier]);

  // Buffer tokens (the reserved headroom)
  const bufferTokens = useMemo(() => {
    return effectiveTokens - inputTokenEstimate;
  }, [effectiveTokens, inputTokenEstimate]);

  // Recommended context considers buffer when in Expert Mode AND search mode
  const recommendedContextTier = useMemo(() => {
    // When search mode is on, minimum recommendation is 128K
    if (searchMode) {
      const baseRec = getRecommendedContextTier(effectiveTokens);
      const minForSearch = "128k";
      // Return whichever is larger
      const baseTokens = CONTEXT_SIZES.find(c => c.value === baseRec)?.tokens || 8000;
      const searchTokens = CONTEXT_SIZES.find(c => c.value === minForSearch)?.tokens || 128000;
      return baseTokens >= searchTokens ? baseRec : minForSearch;
    }
    return getRecommendedContextTier(effectiveTokens);
  }, [effectiveTokens, searchMode]);

  // SPEC-EXACT: Stop auto-switching - instead show mismatch card when prompt exceeds current window
  // Use effectiveTokens (includes buffer) when buffer is active in Expert Mode
  useEffect(() => {
    if (!isRunning) {
      const currentTokens = CONTEXT_SIZES.find(c => c.value === contextSize)?.tokens || 8000;
      const tokensToCheck = expertMode && bufferTokens > 0 ? effectiveTokens : inputTokenEstimate;
      
      // Check if prompt (or prompt+buffer) exceeds current context window
      if (tokensToCheck > currentTokens && recommendedContextTier !== contextSize) {
        // Only show mismatch if user hasn't already accepted truncation
        if (!truncationAccepted) {
          setShowContextMismatch(true);
          setPendingRecommendedTier(recommendedContextTier);
        }
      } else if (tokensToCheck <= currentTokens) {
        // Prompt fits - hide mismatch card and reset truncation acceptance
        setShowContextMismatch(false);
        setPendingRecommendedTier(null);
        setWontFitConfirmed(false);
        setTruncationAccepted(false); // Reset when prompt fits again
        // Also reset buffer warning when context is now large enough
        setShowBufferWarning(false);
      }
    }
  }, [inputTokenEstimate, effectiveTokens, bufferTokens, expertMode, contextSize, recommendedContextTier, isRunning, truncationAccepted]);

  // Auto-select only on initial load or when user hasn't manually selected
  useEffect(() => {
    if (contextAutoSelected && !isRunning && inputTokenEstimate === 0) {
      setContextSize(recommendedContextTier);
    }
  }, [recommendedContextTier, contextAutoSelected, isRunning, inputTokenEstimate]);

  // SPEC-EXACT: Handle recommended context acceptance from mismatch card
  const handleAcceptRecommendedContext = () => {
    console.log("handleAcceptRecommendedContext called, pendingRecommendedTier:", pendingRecommendedTier);
    if (pendingRecommendedTier) {
      const newTier = pendingRecommendedTier;
      setContextSize(newTier);
      setContextAutoSelected(false);
      setShowContextMismatch(false);
      setPendingRecommendedTier(null);
      setShowBufferWarning(false);
      
      // Show Engineering Truth toast
      toast({
        title: "Context Upgraded",
        description: `Switched to ${CONTEXT_SIZES.find(s => s.value === newTier)?.label} — the smallest context that fits your prompt, saving you money.`,
      });
    } else {
      console.log("pendingRecommendedTier is null, cannot accept recommendation");
    }
  };

  const handleContextSizeChange = (value: string) => {
    const selectedTokens = CONTEXT_SIZES.find(c => c.value === value)?.tokens || 8000;
    const recommendedTokens = CONTEXT_SIZES.find(c => c.value === recommendedContextTier)?.tokens || 8000;
    const tokensToCheck = expertMode && bufferTokens > 0 ? effectiveTokens : inputTokenEstimate;
    
    // SPEC-EXACT: If selecting a context that won't fit, show modal with pending context
    if (tokensToCheck > selectedTokens && !expertMode) {
      setPendingWontFitContext(value);
      setShowWontFitModal(true);
      setWontFitConfirmed(false);
      return; // Don't change context until confirmed
    }
    
    // Reset buffer warning if new context is large enough
    if (selectedTokens >= tokensToCheck) {
      setShowBufferWarning(false);
    }
    
    // Only flash cost warning for larger context - no toast spam
    if (selectedTokens > recommendedTokens && inputTokenEstimate <= recommendedTokens) {
      setCostFlash(true);
      setTimeout(() => setCostFlash(false), 1500);
    }
    
    setContextSize(value);
    setContextAutoSelected(false);
    setShowContextMismatch(false);
    setPendingRecommendedTier(null);
  };
  
  // SPEC-EXACT: Handle "Won't fit" confirmation with deliberate acknowledgment
  const handleWontFitConfirm = () => {
    if (pendingWontFitContext) {
      // Apply the smaller context after user confirms understanding
      setContextSize(pendingWontFitContext);
      setContextAutoSelected(false);
      setShowContextMismatch(false);
      setPendingRecommendedTier(null);
      setTruncationAccepted(true); // This allows models to run despite overflow
    }
    setWontFitConfirmed(false);
    setPendingWontFitContext(null);
    setShowWontFitModal(false);
    
    toast({
      title: "Truncation Mode Active",
      description: "Running with truncated input. Results may be incomplete or misleading.",
      variant: "destructive",
    });
  };

  // Handle safety buffer changes (Expert Mode)
  const handleBufferChange = (newBuffer: "off" | "10" | "25") => {
    const prevBuffer = safetyBuffer;
    setSafetyBuffer(newBuffer);
    
    // Calculate new effective tokens
    const newMultiplier = newBuffer === "off" ? 1.0 : newBuffer === "10" ? 1.1 : 1.25;
    const newEffectiveTokens = Math.ceil(inputTokenEstimate * newMultiplier);
    const newRecommendedTier = getRecommendedContextTier(newEffectiveTokens);
    const currentContextTokens = CONTEXT_SIZES.find(c => c.value === contextSize)?.tokens || 8000;
    
    // Check if buffer forces context upgrade
    if (newEffectiveTokens > currentContextTokens && inputTokenEstimate <= currentContextTokens) {
      setShowBufferWarning(true);
    } else {
      setShowBufferWarning(false);
    }
    
    // Toast notification for buffer change
    if (newBuffer !== prevBuffer) {
      if (newBuffer === "off") {
        toast({
          title: "Buffer removed",
          description: "Returning to tight-fit recommendation.",
        });
      } else {
        toast({
          title: "Safety buffer updated constraints",
          description: "Context + models re-evaluated.",
        });
      }
    }
  };

  const selectedContextTokens = CONTEXT_SIZES.find(c => c.value === contextSize)?.tokens || 128000;
  
  // Calculate percentages for each token source (for stacked bar)
  const promptPercentage = Math.min((promptTokens / selectedContextTokens) * 100, 100);
  const imagePercentage = Math.min((imageTokens / selectedContextTokens) * 100, 100);
  const textFilePercentage = Math.min((textFileTokens / selectedContextTokens) * 100, 100);
  const searchPercentage = Math.min((estimatedSearchTokens / selectedContextTokens) * 100, 100);
  
  // Cumulative positions for stacked bar segments
  const imageStartPercent = promptPercentage;
  const textFileStartPercent = promptPercentage + imagePercentage;
  const searchStartPercent = promptPercentage + imagePercentage + textFilePercentage;
  
  // Total percentage (with search estimate when search mode is on)
  const totalPercentage = Math.min((totalWithSearchEstimate / selectedContextTokens) * 100, 100);
  const inputPercentage = Math.min((inputTokenEstimate / selectedContextTokens) * 100, 100);

  const getModelForColumn = (col: string): Model | null => {
    // Both Search AND Reasoning mode - use combined models
    if (searchMode && reasoningMode) {
      const combinedModel = REASONING_SEARCH_MODELS[col];
      if (combinedModel) return combinedModel;
      // If combined not available, return null (will show "Not available")
      return null;
    }
    
    // Search mode only - check if search is available for this tier
    if (searchMode) {
      const searchModel = SEARCH_MODELS[col];
      if (searchModel) return searchModel;
      // 8B/14B/32B don't support search (40K context limit vs 70K-140K search results)
      return null;
    }
    
    // Reasoning mode only - swap to reasoning-capable models
    if (reasoningMode) {
      const reasoningModel = REASONING_MODELS[col];
      if (reasoningModel) return reasoningModel;
      // If no reasoning model for this tier, return null (will show "Not available")
      return null;
    }
    
    // Expert Mode model swap (for columns that have alternatives)
    if (expertMode && MODEL_ALTERNATIVES[col]) {
      const selectedIndex = selectedModelPerBand[col] || 0;
      const alternatives = MODEL_ALTERNATIVES[col];
      if (selectedIndex < alternatives.length) {
        return alternatives[selectedIndex];
      }
    }
    
    return NON_REASONING_MODELS[col];
  };

  // Always returns a model for display purposes (for showing what would run)
  const getModelForDisplay = (col: string): Model | null => {
    // Both Search AND Reasoning mode
    if (searchMode && reasoningMode) {
      const combinedModel = REASONING_SEARCH_MODELS[col];
      if (combinedModel) return combinedModel;
      // Fall back to non-reasoning model for display
      return NON_REASONING_MODELS[col];
    }
    
    // Search mode only - check if search is available
    if (searchMode) {
      const searchModel = SEARCH_MODELS[col];
      if (searchModel) return searchModel;
      // 8B/14B/32B don't support search - show base model for display
      return NON_REASONING_MODELS[col];
    }
    
    // Reasoning mode only
    if (reasoningMode) {
      return REASONING_MODELS[col] || NON_REASONING_MODELS[col];
    }
    
    // Expert Mode model swap (for columns that have alternatives)
    if (expertMode && MODEL_ALTERNATIVES[col]) {
      const selectedIndex = selectedModelPerBand[col] || 0;
      const alternatives = MODEL_ALTERNATIVES[col];
      if (selectedIndex < alternatives.length) {
        return alternatives[selectedIndex];
      }
    }
    
    return NON_REASONING_MODELS[col];
  };
  
  // Check which modes are not available for a column
  // Returns an object with separate availability status for each mode
  const getModeAvailability = (col: string): { reasoning: boolean; search: boolean; reasoningReason?: string; searchReason?: string } => {
    const reasoningAvailable = !!REASONING_MODELS[col];
    const searchAvailable = !!SEARCH_MODELS[col]; // 8B/14B/32B don't support search (40K limit vs 70K-140K results)
    
    return {
      reasoning: reasoningAvailable,
      search: searchAvailable,
      reasoningReason: reasoningAvailable ? undefined : "Reasoning requires 72B+ models",
      searchReason: searchAvailable ? undefined : "Search requires 72B+ models"
    };
  };
  
  // Legacy function for backward compatibility
  const getModeUnavailableReason = (col: string): string | null => {
    // Show unavailable message when reasoning is ON but not available for this tier
    if (reasoningMode && !REASONING_MODELS[col]) {
      return "Reasoning not available for this size";
    }
    // Show unavailable message when search is ON but not available (8B/14B/32B)
    if (searchMode && !SEARCH_MODELS[col]) {
      return "Search not available for this size";
    }
    return null;
  };

  const estimateCost = (model: Model): number => {
    const estimatedTokens = Math.max(inputTokenEstimate, 100) + 500;
    return (estimatedTokens / 1000) * model.costPer1k;
  };

  const isModelDisabled = (col: string): { disabled: boolean; reason: string; warning?: string } => {
    const model = getModelForColumn(col);
    
    // Should never happen now that all columns have models
    if (!model) {
      return { disabled: true, reason: "Model not available" };
    }
    
    // Check if input exceeds selected context window
    if (inputTokenEstimate > selectedContextTokens) {
      // Allow running if user accepted truncation or expert mode is on
      if (expertMode || truncationAccepted) {
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
    const capability = getCapabilityVisuals(model.expectedAccuracy, col).label;
    
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
    
    // Build constraint summary for headline
    const constraintParts: string[] = [];
    constraintParts.push(`under your $${costCap.toFixed(2)} budget`);
    constraintParts.push(`with ${contextSize.toUpperCase()} context`);
    const constraintSummary = constraintParts.join(", ");
    
    const headline = wasTieBreaker
      ? `Best quality ${constraintSummary}, finishing fastest (${actualLatency}ms) among ${modelsAtSameCost.length} equally-priced models.`
      : `Best value ${constraintSummary} — cheapest eligible model at ${actualLatency}ms.`;
    
    return (
      <div className="space-y-2">
        <p className="font-semibold text-[#1a3a8f]">{headline}</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Cost: ${actualCost.toFixed(4)} (within ${costCap.toFixed(2)} cap)</li>
          <li>Speed: {actualLatency}ms{wasTieBreaker ? " (fastest at this price)" : ""}</li>
          <li>Capability: {capability}</li>
          <li>Context: {contextSize.toUpperCase()} window selected</li>
        </ul>
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

  // Detect if the prompt was "easy" - all models handled it successfully with similar answers
  const isEasyPrompt = useMemo(() => {
    if (!allModelsComplete) return false;
    
    // Get all responses that were attempted (not disabled models)
    const attemptedResponses = Object.entries(responses);
    if (attemptedResponses.length < 2) return false;
    
    // All attempted models must have successful responses (no errors)
    const allSuccessful = attemptedResponses.every(([_, r]) => 
      r.content && !r.error && r.content.length > 0
    );
    if (!allSuccessful) return false;
    
    const successfulResponses = attemptedResponses.map(([_, r]) => r);
    
    // Check 1: All responses are very short (under 300 chars suggests trivial answer)
    const allShort = successfulResponses.every(r => r.content.length < 300);
    
    // Check 2: Prompt itself is very short (under 80 chars suggests simple question)
    const shortPrompt = prompt.length < 80;
    
    // Check 3: All responses have similar lengths (within 3x of each other)
    const lengths = successfulResponses.map(r => r.content.length);
    const minLen = Math.min(...lengths);
    const maxLen = Math.max(...lengths);
    const similarLengths = maxLen < minLen * 3;
    
    // Only nudge if: short prompt AND (all short answers OR similar length answers)
    return shortPrompt && (allShort || (similarLengths && minLen < 500));
  }, [allModelsComplete, responses, prompt]);

  // Check if no models fit the budget (specifically due to cost cap, not context or reasoning)
  const noModelsInBudget = useMemo(() => {
    // Get only the models that exist in the current mode
    const availableModels = COLUMNS.map(col => ({
      col,
      model: getModelForColumn(col)
    })).filter(({ model }) => model !== null);
    
    // If no models are available (shouldn't happen in practice), return false
    if (availableModels.length === 0) return false;
    
    // Only true if EVERY available model is blocked specifically due to cost cap
    const estimatedTokens = Math.max(inputTokenEstimate, 100) + 500;
    
    const allBlockedByCost = availableModels.every(({ model }) => {
      // Calculate the estimated cost for this model
      const cost = (estimatedTokens / 1000) * model!.costPer1k;
      
      // Check if this model exceeds cost cap
      return cost > costCap;
    });
    
    return allBlockedByCost;
  }, [costCap, inputTokenEstimate]);

  // Compute which bands are currently over budget
  const overBudgetBands = useMemo(() => {
    const overBudget = new Set<string>();
    COLUMNS.forEach(col => {
      const model = NON_REASONING_MODELS[col];
      if (!model) return;
      
      const minCost = getMinimumCostForBand(col, inputTokenEstimate);
      if (minCost > costCap && minCost !== Infinity) {
        overBudget.add(col);
      }
    });
    return overBudget;
  }, [costCap, inputTokenEstimate]);

  // Handle cost cap change with budget toast notifications
  const handleCostCapChange = (newCap: number) => {
    const oldOverBudget = prevOverBudgetBands;
    setCostCap(newCap);
    
    // Calculate new over-budget bands
    const newOverBudget = new Set<string>();
    COLUMNS.forEach(col => {
      const model = NON_REASONING_MODELS[col];
      if (!model) return;
      
      const minCost = getMinimumCostForBand(col, inputTokenEstimate);
      if (minCost > newCap && minCost !== Infinity) {
        newOverBudget.add(col);
      }
    });
    
    // Find newly removed bands (were not over budget, now are)
    const newlyRemoved = Array.from(newOverBudget).filter(col => !oldOverBudget.has(col));
    
    // Find restored bands (were over budget, now aren't)
    const restored = Array.from(oldOverBudget).filter(col => !newOverBudget.has(col));
    
    // Rate limit toasts (max once per 500ms)
    const now = Date.now();
    if (now - lastBudgetToastTime > 500) {
      if (newlyRemoved.length > 0) {
        const cheapestEligible = getCheapestEligibleBand(newCap, inputTokenEstimate);
        const cheapestCost = cheapestEligible 
          ? getMinimumCostForBand(cheapestEligible, inputTokenEstimate)
          : null;
        
        toast({
          title: `Budget cap removed ${newlyRemoved.join(", ")} band${newlyRemoved.length > 1 ? "s" : ""}`,
          description: cheapestCost && cheapestCost !== Infinity
            ? `Cheapest eligible cost is $${cheapestCost.toFixed(4)}.`
            : "No models fit your current budget.",
        });
        setLastBudgetToastTime(now);
      } else if (restored.length > 0) {
        toast({
          title: `Band${restored.length > 1 ? "s" : ""} restored under new cap`,
          description: `${restored.join(", ")} ${restored.length > 1 ? "are" : "is"} now within budget.`,
        });
        setLastBudgetToastTime(now);
      }
    }
    
    setPrevOverBudgetBands(newOverBudget);
  };

  // Handle "Increase budget" button click for a specific band
  const handleIncreaseBudgetForBand = (col: string) => {
    const minCost = getMinimumCostForBand(col, inputTokenEstimate);
    
    // Bail out if no valid model available
    if (minCost === Infinity || !isFinite(minCost)) {
      return;
    }
    
    // Round up to nearest cent
    const newCap = Math.ceil(minCost * 100) / 100;
    const cappedValue = Math.min(newCap, 0.25);
    setCostCap(cappedValue); // Cap at max slider value
    
    toast({
      title: "Band restored under new cap",
      description: `Budget increased to $${cappedValue.toFixed(2)}.`,
    });
    
    // Update over-budget tracking
    const newOverBudget = new Set<string>();
    COLUMNS.forEach(c => {
      const model = NON_REASONING_MODELS[c];
      if (!model) return;
      
      const cost = getMinimumCostForBand(c, inputTokenEstimate);
      if (cost > cappedValue && cost !== Infinity) {
        newOverBudget.add(c);
      }
    });
    setPrevOverBudgetBands(newOverBudget);
  };

  // Scroll to cheapest eligible band
  const scrollToCheapestBand = () => {
    const cheapest = getCheapestEligibleBand(costCap, inputTokenEstimate);
    if (cheapest) {
      // Find the band element and scroll to it
      const bandElement = document.getElementById(`band-${cheapest}`);
      if (bandElement) {
        bandElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a brief highlight
        bandElement.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => {
          bandElement.classList.remove('ring-2', 'ring-emerald-400');
        }, 2000);
      }
    }
  };

  const loadChallengePrompt = () => {
    setPrompt(CHALLENGE_PROMPTS[challengePromptIndex]);
    setChallengePromptIndex((prev) => (prev + 1) % CHALLENGE_PROMPTS.length);
    setShowResults(false);
    setResponses({});
    setContextAutoSelected(true);
  };

  // Recommendation logic: PICK THE SMALLEST/CHEAPEST MODEL that completed successfully
  // SPECIAL CASE: If images are uploaded, ONLY Frontier (Claude) can see them!
  // Philosophy: For simple queries, all models work - so prefer cheap & fast
  // For hard queries, smaller models may fail - pick smallest that succeeded
  // ONLY shows after all models have completed
  const recommendedModel = useMemo(() => {
    // Don't show recommendation until all models have completed
    if (!allModelsComplete) return null;
    
    // CRITICAL: Check if there are any image files uploaded
    // Only Claude (Frontier) can actually see and analyze images!
    const hasImages = uploadedFiles.some(f => f.type === 'image');
    
    // Get all columns that have successful responses (with quality filters)
    const completedModels = COLUMNS.filter(col => {
      const resp = responses[col];
      const { disabled } = isModelDisabled(col);
      // Must not be disabled, must have a response, must not have error
      if (disabled || !resp || resp.loading || !resp.content || resp.error) return false;
      
      // TEMP FIX: Exclude models marked as search unavailable
      if (resp.content === "__SEARCH_UNAVAILABLE__") return false;
      
      // Quality checks: filter out failures
      const content = resp.content.trim().toLowerCase();
      
      // Check for vision-related refusals (model can't see images)
      const isVisionRefusal = content.includes("can't view") ||
                              content.includes("cannot view") ||
                              content.includes("can't see") ||
                              content.includes("cannot see") ||
                              content.includes("can't analyze images") ||
                              content.includes("cannot analyze images") ||
                              content.includes("don't have the ability to see") ||
                              content.includes("no vision support") ||
                              content.includes("text-based model") ||
                              content.includes("unable to view") ||
                              content.includes("unable to see");
      
      // Check for explicit refusals that don't answer the question
      const isExplicitRefusal = (content.startsWith("i cannot") || 
                                 content.startsWith("i'm unable to") ||
                                 content.startsWith("i'm sorry, but i cannot") ||
                                 content.startsWith("i apologize, but i cannot")) &&
                                content.length < 200; // Short refusals only
      
      // Empty responses are failures
      const isEmpty = resp.content.trim().length === 0;
      
      return !isVisionRefusal && !isExplicitRefusal && !isEmpty;
    });
    
    // If images are uploaded and Frontier passed quality checks, always recommend Frontier
    // because it's the ONLY model that can actually see images
    if (hasImages) {
      const frontierResp = responses["Frontier"];
      const { disabled: frontierDisabled } = isModelDisabled("Frontier");
      if (!frontierDisabled && frontierResp && !frontierResp.loading && frontierResp.content && !frontierResp.error) {
        // Frontier successfully responded - recommend it for image queries
        return "Frontier";
      }
      // If Frontier failed but we have images, still try to recommend it or null
      return completedModels.includes("Frontier") ? "Frontier" : null;
    }
    
    if (completedModels.length === 0) return null;
    
    // Score each model: prefer cheapest, use latency as tiebreaker
    // Helper to convert expectedLatency string to ms
    const latencyToMs = (latencyStr: "fast" | "medium" | "slow"): number => {
      switch (latencyStr) {
        case "fast": return 500;
        case "medium": return 2000;
        case "slow": return 5000;
        default: return 2000;
      }
    };
    
    // Tier order: prefer smaller models when costs are similar
    const TIER_ORDER: Record<string, number> = {
      "8B": 1,
      "14B": 2,
      "32B": 3,
      "72B": 4,
      "Frontier": 5
    };
    
    const modelScores = completedModels.map(col => {
      const model = getModelForColumn(col);
      const resp = responses[col];
      const cost = resp?.cost ?? estimateCost(model!);
      // Use actual latency if available, otherwise convert expectedLatency string to ms
      const latency = resp?.latency ?? latencyToMs(model?.expectedLatency || "medium");
      const tierRank = TIER_ORDER[col] || 99;
      
      return { col, cost, latency, tierRank };
    });
    
    // Sort by cost first, but when costs are very similar (< $0.001), prefer smaller tiers
    modelScores.sort((a, b) => {
      // If costs are very similar (within $0.001), prefer smaller tier
      const costDiff = a.cost - b.cost;
      if (Math.abs(costDiff) < 0.001) {
        // Costs are similar - prefer smaller tier (3B > 8B > 14B > 70B > Frontier)
        return a.tierRank - b.tierRank;
      }
      // Otherwise sort by cost (cheaper wins)
      return costDiff;
    });
    
    // Pick the cheapest model that passed quality checks
    return modelScores[0]?.col || null;
  }, [allModelsComplete, responses, costCap, contextSize, inputTokenEstimate, uploadedFiles]);

  // File upload handler - uses server endpoint for reliable large file handling
  const MAX_FILE_SIZE_MB = 10; // Max 10MB per file (server limit)
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadMenuOpen(false);
    
    const newFiles: UploadedFile[] = [];
    const skippedFiles: string[] = [];
    const filesToUpload: File[] = [];
    
    // First pass: validate files and estimate tokens
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type;
      
      // Check file size limit
      if (file.size > MAX_FILE_SIZE_BYTES) {
        skippedFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB > ${MAX_FILE_SIZE_MB}MB limit)`);
        continue;
      }
      
      filesToUpload.push(file);
    }
    
    // Show warning for skipped files
    if (skippedFiles.length > 0) {
      toast({
        title: `${skippedFiles.length} file${skippedFiles.length > 1 ? 's' : ''} too large`,
        description: `Skipped: ${skippedFiles.join(', ')}. Max file size is ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      });
    }
    
    if (filesToUpload.length === 0) {
      event.target.value = '';
      return;
    }
    
    // Show uploading toast
    toast({
      title: "Uploading files...",
      description: `Processing ${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}`,
    });
    
    try {
      // Upload files to server using FormData
      const formData = new FormData();
      for (const file of filesToUpload) {
        formData.append('files', file);
      }
      
      const uploadResponse = await fetch('/api/wind-tunnel/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${uploadResponse.status}`);
      }
      
      const uploadResult = await uploadResponse.json();
      
      // Process uploaded files and create local entries
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const serverFile = uploadResult.files[i];
        const fileType = file.type;
        
        // Determine file category
        let type: 'image' | 'text' | 'pdf';
        if (fileType.startsWith('image/')) {
          type = 'image';
        } else if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
          type = 'pdf';
        } else {
          type = 'text';
        }
        
        // Estimate tokens and get preview (for display only)
        const { tokens, preview, textContent } = await estimateFileTokens(file);
        
        newFiles.push({
          id: `${Date.now()}-${i}`,
          serverId: serverFile.id, // Server-side file ID for API requests
          name: file.name,
          type,
          mimeType: fileType || 'application/octet-stream',
          size: file.size,
          estimatedTokens: tokens,
          preview,
          textContent // Keep text content for text files (small enough)
        });
      }
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
      
      // Show success toast with token info
      const totalNewTokens = newFiles.reduce((sum, f) => sum + f.estimatedTokens, 0);
      toast({
        title: `${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded`,
        description: `~${totalNewTokens.toLocaleString()} tokens added to context`,
      });
      
      // Show educational toast about compression if any images were compressed
      if (uploadResult.compression && uploadResult.compression.length > 0) {
        const comp = uploadResult.compression[0];
        const originalMB = (comp.originalSize / 1024 / 1024).toFixed(1);
        const compressedMB = (comp.compressedSize / 1024 / 1024).toFixed(1);
        const savedPercent = Math.round((1 - comp.compressedSize / comp.originalSize) * 100);
        
        // Show teaching toast after a short delay so it doesn't overlap
        setTimeout(() => {
          toast({
            title: "Image Compressed!",
            description: `Your ${originalMB}MB image was shrunk to ${compressedMB}MB (${savedPercent}% smaller). Claude's brain can only handle images up to 5MB at a time!`,
            duration: 8000,
          });
        }, 1500);
        
        // Show a second educational toast about how compression works
        setTimeout(() => {
          toast({
            title: "How does compression work?",
            description: "Like squeezing a sponge! We made your image smaller by reducing tiny details humans can't see. The AI can still understand it perfectly!",
            duration: 10000,
          });
        }, 4000);
      }
      
    } catch (error: any) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    }
    
    // Reset the input
    event.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

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
        // Use server-side file IDs for files uploaded to the server
        // This avoids sending large base64 data in JSON and prevents network failures
        const fileIds = uploadedFiles
          .filter(f => f.serverId) // Only include files with server IDs
          .map(f => f.serverId as string);
        
        // For backward compatibility: include text content for text files (small)
        // Text files still need to be sent directly as they're not handled by the server upload
        const textFiles = uploadedFiles
          .filter(f => f.type === 'text' && f.textContent && !f.serverId)
          .map(f => ({
            type: f.type,
            mimeType: f.mimeType,
            name: f.name,
            textContent: f.textContent
          }));
        
        const response = await fetch("/api/wind-tunnel/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            modelId: model.id, 
            prompt: prompt,
            fileIds: fileIds.length > 0 ? fileIds : undefined,
            files: textFiles.length > 0 ? textFiles : undefined
          }),
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let tokenCount = 0;
        let buffer = "";
        let receivedComplete = false;
        let finalLatency: number | null = null;
        let finalCost: number | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            
            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch (parseErr) {
              console.warn(`[${col}] Parse error for SSE chunk:`, line.slice(0, 100));
              continue;
            }
            
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
              receivedComplete = true;
              finalLatency = data.latency;
              finalCost = data.cost;
              setResponses((prev) => ({
                ...prev,
                [col]: {
                  content: data.content || accumulatedContent,
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
          }
        }
        
        // Process any remaining buffer
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith("data: ")) {
            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch (parseErr) {
              console.warn(`[${col}] Parse error for final buffer:`, line.slice(0, 100));
            }
            
            if (data) {
              if (data.type === "complete") {
                receivedComplete = true;
                finalLatency = data.latency;
                finalCost = data.cost;
                setResponses((prev) => ({
                  ...prev,
                  [col]: {
                    content: data.content || accumulatedContent,
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
            }
          }
        }
        
        // Fallback: ensure model is marked complete when stream ends
        setResponses((prev) => {
          const current = prev[col];
          if (current && current.loading) {
            return {
              ...prev,
              [col]: {
                ...current,
                content: accumulatedContent || current.content,
                loading: false,
                progress: 100,
                latency: finalLatency,
                cost: finalCost,
                error: (accumulatedContent || current.content) ? null : "No response received",
              },
            };
          }
          return prev;
        });
      } catch (err: any) {
        console.error(`[${col}] Stream error:`, err);
        // Better error message extraction
        let errorMessage = "Failed";
        if (err instanceof TypeError && err.message === "Failed to fetch") {
          errorMessage = "Network error - request failed";
        } else if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        setResponses((prev) => ({
          ...prev,
          [col]: {
            content: "",
            loading: false,
            error: errorMessage,
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

  const handleSaveBenchmark = async () => {
    if (!benchmarkName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the benchmark",
        variant: "destructive",
      });
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
      toast({
        title: "Saved",
        description: "Benchmark saved successfully!",
      });
    } catch (err: any) {
      console.error("Save benchmark error:", err);
      toast({
        title: "Save failed",
        description: "Failed to save benchmark: " + err.message,
        variant: "destructive",
      });
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
    setContextAutoSelected(true);
  };

  const handleDeleteBenchmark = async (id: string) => {
    if (!confirm("Delete this benchmark?")) return;
    
    try {
      await apiRequest("DELETE", `/api/benchmarks/${id}`);
      await loadBenchmarks();
    } catch (err: any) {
      console.error("Delete benchmark error:", err);
      toast({
        title: "Delete failed",
        description: "Failed to delete benchmark: " + err.message,
        variant: "destructive",
      });
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
        },
        results: resultsData,
      });
      
      setShowShareModal(false);
      setShareNickname("");
      toast({
        title: "Shared!",
        description: "Your result has been shared to the leaderboard",
      });
    } catch (err: any) {
      console.error("Share to leaderboard error:", err);
      toast({
        title: "Share failed",
        description: "Failed to share: " + err.message,
        variant: "destructive",
      });
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
                className="w-[122px] h-10 bg-[#f5a623] text-white rounded-lg text-sm font-bold hover:bg-[#e09000] flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="text-sm leading-none">🏆</span>
                Leaderboard
              </button>
              <button
                onClick={handleOpenLibrary}
                className="w-[122px] h-10 bg-[#1a3a8f] text-white rounded-lg text-sm font-bold hover:bg-[#2a4a9f] flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Library className="w-4 h-4" />
                Library
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-2 mb-6 border border-gray-200 shadow-sm">
            {/* Prompt input with upload button */}
            <div className="flex items-start gap-2">
              {/* Upload button (ChatGPT/Claude style) */}
              <Popover open={uploadMenuOpen} onOpenChange={setUploadMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="mt-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors flex-shrink-0"
                    disabled={isRunning}
                    aria-label="Add files"
                  >
                    <Plus className="w-5 h-5 text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-1" sideOffset={5}>
                  <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-md cursor-pointer transition-colors">
                    <Paperclip className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Add photos & files</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                      multiple
                      onChange={handleFileUpload}
                      disabled={isRunning}
                    />
                  </label>
                </PopoverContent>
              </Popover>
              
              <div className="relative flex-1">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt to test across all model sizes..."
                  className="w-full h-[60px] resize-none bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm pr-20"
                  disabled={isRunning}
                />
                {(prompt.length > 0 || uploadedFiles.length > 0) && !isRunning && (
                  <button
                    onClick={() => {
                      setPrompt("");
                      setUploadedFiles([]);
                      setResponses({});
                    }}
                    className="absolute right-2 top-2 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            {/* Uploaded files preview */}
            {uploadedFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {uploadedFiles.map((file) => (
                  <div 
                    key={file.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg group"
                  >
                    {/* File icon based on type */}
                    {file.type === 'image' ? (
                      file.preview ? (
                        <img 
                          src={file.preview} 
                          alt={file.name}
                          className="w-6 h-6 object-cover rounded"
                        />
                      ) : (
                        <Image className="w-4 h-4 text-blue-500" />
                      )
                    ) : file.type === 'pdf' ? (
                      <FileText className="w-4 h-4 text-red-500" />
                    ) : (
                      <File className="w-4 h-4 text-gray-500" />
                    )}
                    
                    {/* File name (truncated) */}
                    <span className="text-xs text-gray-700 max-w-[100px] truncate">
                      {file.name}
                    </span>
                    
                    {/* Token count */}
                    <span className="text-xs text-gray-400 font-mono">
                      ~{file.estimatedTokens.toLocaleString()}
                    </span>
                    
                    {/* Remove button */}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                      disabled={isRunning}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                {/* Total file tokens summary */}
                {uploadedFiles.length > 1 && (
                  <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500">
                    <span className="font-medium">{uploadedFiles.length} files</span>
                    <span>•</span>
                    <span className="font-mono">~{fileTokens.toLocaleString()} tokens</span>
                  </div>
                )}
              </div>
            )}
            
            <div className={`mt-2 p-2.5 rounded-lg border ${
              totalWithSearchEstimate > selectedContextTokens 
                ? 'bg-red-50 border-red-300' 
                : inputTokenEstimate > 1000000
                  ? 'bg-red-50 border-red-300'
                  : 'bg-gray-50 border-gray-200'
            }`}>
              {/* GAP 1A: Token count and recommendation with breakdown */}
              <div className="mb-2 text-sm">
                <div className="font-medium text-gray-900">
                  {/* Show breakdown when we have multiple sources */}
                  {(imageTokens > 0 || searchMode) ? (
                    <>
                      Your input uses <span className="font-bold text-[#1a3a8f]">{totalWithSearchEstimate.toLocaleString()}</span> tokens
                      {searchMode && <span className="text-blue-500 text-xs ml-1">(includes search estimate)</span>}
                    </>
                  ) : (
                    <>
                      Your prompt uses <span className="font-bold text-[#1a3a8f]">{inputTokenEstimate.toLocaleString()}</span> tokens.
                    </>
                  )}
                  {expertMode && bufferTokens > 0 && (
                    <span className="text-amber-600 ml-1">
                      (+{bufferTokens.toLocaleString()} buffer = {(totalWithSearchEstimate + bufferTokens).toLocaleString()} required)
                    </span>
                  )}
                </div>
                
                {/* Token source breakdown - educational */}
                {(promptTokens > 0 && (imageTokens > 0 || textFileTokens > 0 || searchMode)) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#1a3a8f] rounded-sm" />
                      <span className="text-gray-600">Text: {promptTokens.toLocaleString()}</span>
                    </span>
                    {imageTokens > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-purple-500 rounded-sm" />
                        <span className="text-purple-700">Images: {imageTokens.toLocaleString()}</span>
                      </span>
                    )}
                    {textFileTokens > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-sm" />
                        <span className="text-emerald-700">Files: {textFileTokens.toLocaleString()}</span>
                      </span>
                    )}
                    {searchMode && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #3b82f6, #3b82f6 2px, #93c5fd 2px, #93c5fd 4px)' }} />
                        <span className="text-blue-600">Search: ~{estimatedSearchTokens.toLocaleString()}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-blue-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-white border-gray-200 text-gray-700">
                            <p className="font-bold mb-1">Why so many tokens?</p>
                            <p className="text-xs">Web search adds articles, snippets, and sources to help the AI answer. This can use 15,000-25,000 tokens!</p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    )}
                  </div>
                )}
                
                {inputTokenEstimate > 1000000 ? (
                  <div className="text-red-600 font-bold mt-0.5">
                    Prompt exceeds max context (1M tokens). Please shorten.
                  </div>
                ) : inputTokenEstimate > 0 && (
                  <div className={`mt-0.5 ${expertMode && bufferTokens > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    Recommended context: <span className="font-bold">{CONTEXT_SIZES.find(s => s.value === recommendedContextTier)?.label}</span> 
                    {expertMode && bufferTokens > 0 ? ' (fits with buffer)' : searchMode ? ' (includes search room)' : ' (cheapest that fits)'}
                  </div>
                )}
                {getContextTightFitWarning(expertMode && bufferTokens > 0 ? effectiveTokens : totalWithSearchEstimate, selectedContextTokens) && (
                  <div className="text-amber-600 font-medium mt-0.5">
                    {contextSize.toUpperCase()} {getContextTightFitWarning(expertMode && bufferTokens > 0 ? effectiveTokens : totalWithSearchEstimate, selectedContextTokens)}
                    {expertMode && bufferTokens > 0 && " (with buffer)"}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-900">INPUT GAUGE</span>
                  {totalWithSearchEstimate > selectedContextTokens && (
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold">
                      OVERFLOW
                    </span>
                  )}
                  {searchMode && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-bold">
                      +SEARCH
                    </span>
                  )}
                  {imageTokens > 0 && (
                    <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded font-bold">
                      +IMAGES
                    </span>
                  )}
                  {expertMode && bufferTokens > 0 && (
                    <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-bold">
                      +{safetyBuffer}% BUFFER
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Show total with search when active */}
                  <span className={`font-mono text-sm font-bold ${
                    totalWithSearchEstimate > selectedContextTokens ? 'text-red-600' : 'text-gray-900'
                  }`}>{totalWithSearchEstimate.toLocaleString()}</span>
                  <span className="text-gray-400">/</span>
                  <span className="font-mono text-sm text-gray-600">{selectedContextTokens.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">tokens</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    totalWithSearchEstimate > selectedContextTokens 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {totalWithSearchEstimate > selectedContextTokens 
                      ? 'OVERFLOW!' 
                      : `${(totalWithSearchEstimate / selectedContextTokens * 100).toFixed(1)}%`}
                  </span>
                </div>
              </div>
              
              {/* Multi-segment gauge bar - uses cumulative positioning for proper stacking */}
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden relative">
                {/* Prompt tokens bar (blue) - always starts at 0 */}
                {promptTokens > 0 && (
                  <div 
                    className={`h-full transition-all absolute left-0 ${
                      totalWithSearchEstimate > selectedContextTokens ? 'bg-red-500' : 'bg-[#1a3a8f]'
                    }`}
                    style={{ width: `${Math.min(promptPercentage, 100)}%` }}
                  />
                )}
                
                {/* Image tokens bar (purple) - starts after prompt */}
                {imageTokens > 0 && (
                  <div 
                    className={`h-full transition-all absolute ${
                      totalWithSearchEstimate > selectedContextTokens ? 'bg-red-400' : 'bg-purple-500'
                    }`}
                    style={{ 
                      left: `${Math.min(imageStartPercent, 100)}%`,
                      width: `${Math.min(imagePercentage, 100 - imageStartPercent)}%`
                    }}
                  />
                )}
                
                {/* Text file tokens bar (emerald) - starts after prompt + images */}
                {textFileTokens > 0 && (
                  <div 
                    className={`h-full transition-all absolute ${
                      totalWithSearchEstimate > selectedContextTokens ? 'bg-red-300' : 'bg-emerald-500'
                    }`}
                    style={{ 
                      left: `${Math.min(textFileStartPercent, 100)}%`,
                      width: `${Math.min(textFilePercentage, 100 - textFileStartPercent)}%`
                    }}
                  />
                )}
                
                {/* Search tokens bar (striped blue - estimated) - starts after all input */}
                {searchMode && estimatedSearchTokens > 0 && (
                  <div 
                    className="h-full transition-all absolute"
                    style={{ 
                      left: `${Math.min(searchStartPercent, 100)}%`,
                      width: `${Math.min(searchPercentage, 100 - searchStartPercent)}%`,
                      background: totalWithSearchEstimate > selectedContextTokens 
                        ? 'repeating-linear-gradient(45deg, #ef4444, #ef4444 3px, #fca5a5 3px, #fca5a5 6px)'
                        : 'repeating-linear-gradient(45deg, #3b82f6, #3b82f6 3px, #93c5fd 3px, #93c5fd 6px)'
                    }}
                  />
                )}
                
                {/* Buffer bar (amber) - starts after all tokens including search estimate */}
                {expertMode && bufferTokens > 0 && totalWithSearchEstimate <= selectedContextTokens && (
                  <div 
                    className="h-full transition-all absolute bg-amber-400"
                    style={{ 
                      left: `${Math.min(totalPercentage, 100)}%`,
                      width: `${Math.min((bufferTokens / selectedContextTokens) * 100, 100 - totalPercentage)}%`
                    }}
                  />
                )}
              </div>
              
              {/* Legend showing what each color means */}
              {(imageTokens > 0 || textFileTokens > 0 || searchMode) && inputTokenEstimate > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
                  {promptTokens > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 bg-[#1a3a8f] rounded-sm" />
                      <span className="text-gray-600">Prompt ({promptTokens.toLocaleString()})</span>
                    </div>
                  )}
                  {imageTokens > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 bg-purple-500 rounded-sm" />
                      <span className="text-purple-700 font-medium">Images ({imageTokens.toLocaleString()})</span>
                    </div>
                  )}
                  {textFileTokens > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                      <span className="text-emerald-700 font-medium">Files ({textFileTokens.toLocaleString()})</span>
                    </div>
                  )}
                  {searchMode && (
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #3b82f6, #3b82f6 2px, #93c5fd 2px, #93c5fd 4px)' }} />
                      <span className="text-blue-600 font-medium">Search (~{estimatedSearchTokens.toLocaleString()})</span>
                    </div>
                  )}
                  {expertMode && bufferTokens > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 bg-amber-400 rounded-sm" />
                      <span className="text-amber-700 font-medium">Buffer ({bufferTokens.toLocaleString()})</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Simple legend for buffer only (no images/files/search) */}
              {expertMode && bufferTokens > 0 && inputTokenEstimate > 0 && !(imageTokens > 0 || textFileTokens > 0 || searchMode) && (
                <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-[#1a3a8f] rounded-sm" />
                    <span className="text-gray-600">Used ({inputTokenEstimate.toLocaleString()})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-sm" />
                    <span className="text-amber-700 font-medium">Buffer ({bufferTokens.toLocaleString()})</span>
                  </div>
                </div>
              )}
              
              {inputTokenEstimate > 0 && !searchMode && contextSize !== recommendedContextTier && inputTokenEstimate <= selectedContextTokens && !(expertMode && bufferTokens > 0) && (
                <div className="mt-2 text-xs text-amber-600 font-medium">
                  You're paying for {(selectedContextTokens - inputTokenEstimate).toLocaleString()} unused tokens
                </div>
              )}
            </div>
          </div>

          {/* SPEC-EXACT: Context Mismatch Card - shown when prompt exceeds current context */}
          {showContextMismatch && pendingRecommendedTier && !expertMode && (
            <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-lg shadow-md animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-800 text-base mb-1">Context Window Mismatch</h3>
                  <p className="text-sm text-amber-700 mb-3">
                    Your prompt uses <span className="font-bold">{inputTokenEstimate.toLocaleString()}</span> tokens, 
                    but you selected <span className="font-bold">{contextSize.toUpperCase()}</span> ({selectedContextTokens.toLocaleString()} tokens). 
                    Your prompt won't fit and will be truncated.
                  </p>
                  
                  {/* Overflow visualization */}
                  <div className="mb-3 p-2 bg-red-100 rounded border border-red-200">
                    <div className="text-xs font-mono text-red-700 mb-1">Overflow starts here...</div>
                    <div className="h-2 bg-gray-200 rounded overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(selectedContextTokens / inputTokenEstimate) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-red-600 mt-1">
                      <span>Kept: {selectedContextTokens.toLocaleString()}</span>
                      <span className="font-bold">Lost: {(inputTokenEstimate - selectedContextTokens).toLocaleString()} tokens</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={handleAcceptRecommendedContext}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
                    >
                      Use {CONTEXT_SIZES.find(s => s.value === pendingRecommendedTier)?.label} (recommended)
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowContextMismatch(false)}
                          className="text-gray-600 border-gray-300 text-sm"
                        >
                          Show other options
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-white border-gray-200 text-gray-700 max-w-xs">
                        <p className="text-xs">You can manually select a different context size, but results may be truncated if your prompt doesn't fit.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  {/* Why this recommendation? - Click-based popover for better mobile/touch support */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="mt-2 text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 hover:underline cursor-pointer">
                        <Info className="w-3 h-3" />
                        Why this recommendation?
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="bg-white border-gray-200 text-gray-700 max-w-sm p-3 shadow-lg">
                      <p className="font-bold mb-2">Engineering Rule: Pick the smallest context that fits</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li>Smaller contexts cost less per query</li>
                        <li>Larger contexts waste money on unused capacity</li>
                        <li>AI engineers always optimize for cost when quality is equal</li>
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-gray-500" />
                  <span className="font-bold text-gray-900 text-sm">Context Window</span>
                  {/* SPEC-EXACT: "Why?" tooltip for context recommendation */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white border-gray-200 text-gray-700 max-w-xs p-3">
                      <p className="font-bold mb-1">Context Window = Token Budget</p>
                      <p className="text-xs mb-2">This is how much text the AI can "see" at once. Bigger windows cost more money.</p>
                      <p className="text-xs font-semibold text-emerald-600">Rule: Always pick the smallest context that fits your prompt.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {!showContextMismatch && contextSize !== recommendedContextTier && (
                  <span className={`text-xs px-2 py-0.5 rounded font-medium border transition-all ${
                    inputTokenEstimate > selectedContextTokens 
                      ? 'border-red-300 text-red-600 bg-red-50' 
                      : costFlash 
                        ? 'border-amber-500 text-amber-700 bg-amber-200 scale-110 shadow-md' 
                        : 'border-amber-300 text-amber-600 bg-amber-50'
                  }`}>
                    {inputTokenEstimate > selectedContextTokens ? "Won't Fit" : "Higher Cost"}
                  </span>
                )}
                {!showContextMismatch && contextSize === recommendedContextTier && (
                  <span className="text-xs px-2 py-0.5 rounded font-medium border border-emerald-300 text-emerald-600 bg-emerald-50">
                    Best Value
                  </span>
                )}
              </div>
              {/* SPEC-EXACT: Dropdown frozen when mismatch is shown */}
              <Select 
                value={contextSize} 
                onValueChange={handleContextSizeChange} 
                disabled={isRunning || showContextMismatch}
              >
                <SelectTrigger className={`bg-white text-gray-900 border-gray-300 h-9 text-sm ${showContextMismatch ? 'opacity-50' : ''}`}>
                  {/* SPEC-EXACT: Show "Auto" label when auto-selected */}
                  <SelectValue>
                    {contextAutoSelected && contextSize === recommendedContextTier ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-emerald-600 font-semibold">Auto</span>
                        <span className="text-gray-500">({CONTEXT_SIZES.find(s => s.value === contextSize)?.label})</span>
                        <span className="text-xs text-gray-400">— smallest that fits</span>
                      </span>
                    ) : (
                      <span>{CONTEXT_SIZES.find(s => s.value === contextSize)?.label} tokens</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {CONTEXT_SIZES.map(size => {
                    const tierInfo = getContextTierLabel(size.value, inputTokenEstimate, recommendedContextTier);
                    return (
                      <SelectItem 
                        key={size.value} 
                        value={size.value} 
                        className={`hover:bg-gray-100 ${
                          tierInfo.status === "wontfit" ? "text-red-500" :
                          tierInfo.status === "recommended" ? "text-emerald-600 font-medium" :
                          "text-gray-600"
                        }`}
                        disabled={tierInfo.status === "wontfit" && !expertMode}
                      >
                        {tierInfo.label}
                      </SelectItem>
                    );
                  })}
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
                  onValueChange={([val]) => handleCostCapChange(val)}
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

          </div>

          {/* Global Mode Toggles */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-6">
              {/* Reasoning Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setReasoningMode(!reasoningMode)}
                    disabled={isRunning}
                    className={`flex items-center justify-center gap-2 w-[120px] py-2 rounded-lg font-medium transition-all touch-manipulation ${
                      reasoningMode 
                        ? 'bg-purple-600 text-white shadow-md' 
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-purple-50 hover:border-purple-300'
                    }`}
                  >
                    <Brain className="w-4 h-4" />
                    <span className="text-sm">Reasoning</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-white border-gray-200 text-gray-700 max-w-xs">
                  <p className="font-bold mb-1">Chain-of-Thought Reasoning</p>
                  <p className="text-xs">Enable reasoning for 70B (DeepSeek R1) and Frontier (Claude extended thinking). Can be combined with Search! Smaller models will show as unavailable.</p>
                </TooltipContent>
              </Tooltip>

              {/* Search Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const newSearchMode = !searchMode;
                      setSearchMode(newSearchMode);
                      
                      // Auto-upgrade to 128K when enabling search (unless already at 128K+)
                      if (newSearchMode && (contextSize === "8k" || contextSize === "32k")) {
                        setContextSize("128k");
                        setContextAutoSelected(false);
                        toast({
                          title: "Context upgraded to 128K",
                          description: "Search results can vary from 15K-35K tokens. We auto-upgraded to 128K to give you safe headroom and prevent overflow errors.",
                          duration: 6000,
                        });
                      }
                    }}
                    disabled={isRunning}
                    className={`flex items-center justify-center gap-2 w-[120px] py-2 rounded-lg font-medium transition-all touch-manipulation ${
                      searchMode 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    <span className="text-sm">Search</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-white border-gray-200 text-gray-700 max-w-xs">
                  <p className="font-bold mb-1">Web Search Mode</p>
                  <p className="text-xs">Add real-time web search to any model. Auto-upgrades to 128K context for safe headroom.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Expert Mode Toggle */}
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

          {/* Context Safety Buffer - Expert Mode Only */}
          {expertMode && (
            <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-800 text-sm">Context Safety Buffer</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-amber-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-white border-gray-200 text-gray-700 max-w-xs">
                      <p className="font-bold mb-1">Why use a safety buffer?</p>
                      <p className="text-xs mb-2">Buffers reserve extra context space beyond your current prompt. Useful when your task may grow.</p>
                      <p className="text-xs font-medium mb-1">Good for:</p>
                      <ul className="text-xs list-disc pl-4 mb-2">
                        <li>Retrieval (RAG) that adds docs</li>
                        <li>Follow-up questions</li>
                        <li>Multi-document prompts</li>
                        <li>Agent/tool runs</li>
                      </ul>
                      <p className="text-xs mb-2"><span className="font-medium">Tradeoff:</span> More buffer = higher cost + latency, and may force a model swap.</p>
                      <p className="text-xs italic text-gray-500">Engineering rule: right-size context with just enough headroom.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  safetyBuffer === "25" ? 'bg-amber-500 text-white' : 
                  safetyBuffer === "10" ? 'bg-amber-400 text-white' : 
                  'bg-gray-200 text-gray-600'
                }`}>
                  Est. multiplier: {safetyBuffer === "off" ? "1.0×" : safetyBuffer === "10" ? "~1.1×" : "~1.25×"}
                </span>
              </div>
              
              {/* Segmented Control */}
              <div className="flex rounded-lg overflow-hidden border border-amber-300 mb-2">
                <button
                  onClick={() => handleBufferChange("off")}
                  disabled={isRunning}
                  className={`flex-1 py-2 px-3 text-xs font-bold transition-all ${
                    safetyBuffer === "off" 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-white text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Off
                </button>
                <button
                  onClick={() => handleBufferChange("10")}
                  disabled={isRunning}
                  className={`flex-1 py-2 px-3 text-xs font-bold border-l border-amber-300 transition-all ${
                    safetyBuffer === "10" 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-white text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  +10%
                </button>
                <button
                  onClick={() => handleBufferChange("25")}
                  disabled={isRunning}
                  className={`flex-1 py-2 px-3 text-xs font-bold border-l border-amber-300 transition-all ${
                    safetyBuffer === "25" 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-white text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  +25%
                </button>
              </div>
              
              {/* Helper Text */}
              <p className="text-xs text-amber-700 leading-relaxed">
                {safetyBuffer === "off" && "Tight fit. Cheapest option, but leaves no room for retrieval or follow-ups."}
                {safetyBuffer === "10" && "Adds a little headroom for extra context. Small cost increase."}
                {safetyBuffer === "25" && "Adds strong headroom for RAG / long tasks. Higher cost."}
              </p>
            </div>
          )}

          {/* Buffer Warning Panel - when buffer forces context upgrade */}
          {expertMode && showBufferWarning && effectiveTokens > selectedContextTokens && inputTokenEstimate <= selectedContextTokens && (
            <div className="mb-4 p-3 bg-amber-100 rounded-lg border border-amber-400">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-amber-800 text-sm mb-1">Buffer needs more context</h4>
                  <p className="text-xs text-amber-700 mb-2">
                    Your prompt fits {contextSize.toUpperCase()}, but with +{safetyBuffer}% buffer you need {effectiveTokens.toLocaleString()} tokens.
                    {contextSize.toUpperCase()} will truncate if the task grows.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setContextSize(recommendedContextTier);
                        setShowBufferWarning(false);
                        toast({
                          title: "Context upgraded for buffer",
                          description: `Switched to ${CONTEXT_SIZES.find(s => s.value === recommendedContextTier)?.label} to accommodate safety buffer.`,
                        });
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                    >
                      Use {CONTEXT_SIZES.find(s => s.value === recommendedContextTier)?.label} (recommended)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowBufferWarning(false)}
                      className="text-amber-700 border-amber-400 text-xs"
                    >
                      Keep {contextSize.toUpperCase()} anyway
                    </Button>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1 italic">Risky for RAG / follow-ups.</p>
                </div>
              </div>
            </div>
          )}

          {/* SPEC-EXACT: Small warning when mismatch is being shown, or after expert override */}
          {(expertMode && bufferTokens > 0 ? effectiveTokens : inputTokenEstimate) > selectedContextTokens && !showContextMismatch && (
            <div className={`mb-2 p-2 rounded-lg flex items-center gap-2 text-sm font-medium ${
              expertMode ? 'bg-amber-50 border border-amber-300 text-amber-700' : 'bg-red-50 border border-red-300 text-red-600'
            }`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {expertMode 
                ? bufferTokens > 0 
                  ? "Expert Mode: Buffer exceeds context. Input may be truncated when context grows."
                  : "Expert Mode: Running with truncated input. Results may be misleading."
                : "Warning: selected context too small. Input will be truncated."
              }
            </div>
          )}

          <button
            onClick={handleRunAll}
            disabled={!prompt.trim() || isRunning || inputTokenEstimate > 1000000}
            className="w-full py-3 text-sm sm:text-base font-bold mb-6 rounded-lg flex items-center justify-center gap-2 text-white disabled:cursor-not-allowed hover:brightness-110 transition-all"
            style={{ backgroundColor: (!prompt.trim() || isRunning || inputTokenEstimate > 1000000) ? '#2a4a9f' : '#1a3a8f' }}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 animate-spin" />
                Testing All Models...
              </>
            ) : inputTokenEstimate > 1000000 ? (
              <>
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Prompt Too Long (Max 1M tokens)
              </>
            ) : (
              <>
                <Play className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Run Wind Tunnel Test
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500 mb-3">
            For each size band, we auto-pick the best model that fits your cost + context constraints.
          </p>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[900px] sm:min-w-0">
                <div className="grid grid-cols-6 border-b border-gray-200" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                  {COLUMNS.map(col => {
                    const model = getModelForColumn(col);
                    const isRecommended = showResults && col === recommendedModel;
                    const visuals = COLUMN_VISUALS[col];
                    const isOverBudget = overBudgetBands.has(col);
                    return (
                      <div 
                        key={col} 
                        id={`band-${col}`}
                        className={`p-3 sm:p-4 text-center transition-opacity duration-150 ${visuals.accentBorder} ${isRecommended ? 'bg-[#fff8eb]' : visuals.headerBg} ${col !== 'Frontier' ? 'border-r border-gray-200' : ''} ${isOverBudget ? 'opacity-40' : ''}`}
                      >
                        <div className={`${visuals.headerSize} tracking-tight`}>{col}</div>
                        <div className={`text-xs font-semibold mt-0.5 ${col === 'Frontier' ? 'text-[#EA580C]' : col === '72B' || col === '685B' ? 'text-violet-600' : col === '14B' || col === '32B' ? 'text-emerald-600' : 'text-blue-600'}`}>
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

                <div className="grid grid-cols-6" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                  {COLUMNS.map(col => {
                    const model = getModelForColumn(col);
                    const displayModel = getModelForDisplay(col); // Always returns a model for display
                    const { disabled, reason, warning } = isModelDisabled(col);
                    const response = responses[col];
                    const isLoading = response?.loading;
                    const hasError = response?.error;
                    // TEMP FIX: Check if this is the special "search unavailable" marker
                    const isSearchUnavailable = response?.content === "__SEARCH_UNAVAILABLE__";
                    const hasContent = response?.content && !isSearchUnavailable;
                    const isRecommended = showResults && col === recommendedModel;
                    
                    // IMPORTANT: If we have results (content, loading, error, or search unavailable), 
                    // ALWAYS show them even if model would be "disabled" under current settings.
                    // This preserves results from Expert Mode runs when Expert Mode is later toggled off.
                    // Use displayModel (which always exists) to render results even when getModelForColumn returns null.
                    const hasResults = hasContent || isLoading || hasError || isSearchUnavailable;

                    // Check if mode is unavailable for this column
                    const modeUnavailableReason = getModeUnavailableReason(col);

                    // Only show disabled state when:
                    // 1. No results AND model is null (reasoning/search mode on unsupported models), OR
                    // 2. No results AND model is disabled due to cost/other constraints
                    if ((!model && !hasResults) || (disabled && !hasResults)) {
                      const isCostExceeded = reason.includes("Exceeds");
                      const minCostForBand = getMinimumCostForBand(col, inputTokenEstimate);
                      const costExplanations = getCostMultiplierExplanation(contextSize);
                      const cheapestBand = getCheapestEligibleBand(costCap, inputTokenEstimate);
                      
                      // Special UI for mode unavailability (only Reasoning mode now, Search works on all tiers)
                      if (modeUnavailableReason) {
                        return (
                          <div 
                            key={col}
                            className={`p-3 min-h-[280px] flex flex-col items-center justify-center transition-all duration-150 bg-purple-50/50 ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}`}
                          >
                            <div className="w-10 h-10 mb-3 rounded-full flex items-center justify-center bg-purple-100">
                              <Brain className="w-5 h-5 text-purple-400" />
                            </div>
                            <span className="text-sm font-medium text-purple-600 text-center mb-1">
                              Not Available
                            </span>
                            <span className="text-xs text-gray-500 text-center px-4">
                              {modeUnavailableReason}
                            </span>
                            <div className="mt-4 p-2 bg-white rounded-lg border border-purple-100">
                              <p className="text-[10px] text-gray-500 text-center">
                                Chain-of-thought reasoning requires larger models.
                              </p>
                              <p className="text-[10px] text-purple-600 font-medium text-center mt-1">
                                Try 70B or Frontier
                              </p>
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div 
                          key={col}
                          className={`p-3 min-h-[280px] flex flex-col transition-all duration-150 ${
                            isCostExceeded ? 'bg-gray-100' : 'bg-gray-50'
                          } ${col !== 'Frontier' ? 'border-r border-gray-200' : ''}`}
                        >
                          {isCostExceeded ? (
                            <div className="flex flex-col h-full">
                              <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                                <DollarSign className="w-6 h-6 mb-2 text-gray-400" />
                                <h4 className="text-sm font-bold text-gray-700 mb-1">Over budget for this band</h4>
                                <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                                  This size class can't run under your ${costCap.toFixed(2)}/query cap.
                                </p>
                                <div className="text-[10px] text-gray-500 mb-2 p-1.5 bg-white rounded border border-gray-200">
                                  <span className="font-medium">Cheapest here:</span> ~${minCostForBand.toFixed(4)}/query
                                </div>
                                {costExplanations.length > 0 && (
                                  <div className="text-[10px] text-gray-400 mb-3 space-y-0.5">
                                    {costExplanations.map((exp, i) => (
                                      <p key={i}>{exp}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className="mt-auto space-y-1.5 px-1">
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleIncreaseBudgetForBand(col);
                                  }}
                                  className="w-full text-[10px] h-7 bg-[#1a3a8f] hover:bg-[#2a4a9f] text-white"
                                >
                                  Increase to ${Math.min(Math.ceil(minCostForBand * 100) / 100, 0.25).toFixed(2)}
                                </Button>
                                {cheapestBand && cheapestBand !== col && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      scrollToCheapestBand();
                                    }}
                                    className="w-full text-[10px] h-6 text-gray-600 border-gray-300"
                                  >
                                    See cheaper bands
                                  </Button>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="w-full text-[9px] text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 mt-1">
                                      <Info className="w-2.5 h-2.5" />
                                      Why did this happen?
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-[240px] bg-white border-gray-200 text-gray-700 p-3">
                                    <p className="font-bold text-gray-900 text-xs mb-2">Why this band is locked out</p>
                                    <ul className="text-[10px] text-gray-600 space-y-1 list-disc list-inside mb-2">
                                      <li>This band's models cost more because they use more compute per token.</li>
                                      <li>Your context window and reasoning mode increase compute.</li>
                                      <li>Budget caps remove models that can't fit within real-world constraints.</li>
                                    </ul>
                                    <p className="text-[9px] text-gray-500 italic border-t border-gray-100 pt-2 mt-2">
                                      Engineering rule: capability is useless if you can't afford to run it.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center px-2">
                              <Lock className="w-5 h-5 sm:w-6 sm:h-6 mb-2 text-gray-400" />
                              <span className="text-xs sm:text-sm font-medium text-gray-400 text-center">
                                {model?.name}
                              </span>
                              <span className="text-xs text-gray-400 text-center mt-1">
                                {reason}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    const cardVisuals = COLUMN_VISUALS[col];
                    // Use displayModel for rendering (always exists), fallback to model for constraint checks
                    const renderModel = displayModel!;
                    const latencyConfig = getLatencyBarConfig(renderModel.expectedLatency);
                    const capabilityConfig = getCapabilityVisuals(renderModel.expectedAccuracy, col);
                    const estimatedCost = estimateCost(renderModel);
                    const costConfig = getCostVisuals(estimatedCost);
                    
                    return (
                      <div
                        key={col}
                        onClick={() => response && hasContent && openModal(col, renderModel, response)}
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
                          <div className={`font-bold text-gray-900 text-base ${cardVisuals.prominence === 'large' ? 'text-[#1a3a8f]' : ''}`}>
                            {/* Split model name and mode suffix onto separate lines for alignment */}
                            {(() => {
                              let displayName = isSearchUnavailable 
                                ? renderModel.name.replace(" + Search", "").replace(" + Reasoning + Search", " + Reasoning")
                                : renderModel.name;
                              
                              // Extract mode suffix if present
                              const suffixMatch = displayName.match(/( \+ Reasoning \+ Search| \+ Reasoning| \+ Search)$/);
                              if (suffixMatch) {
                                const baseName = displayName.replace(suffixMatch[0], "");
                                const suffix = suffixMatch[0].trim();
                                return (
                                  <div className="flex flex-col items-center">
                                    <span>{baseName}</span>
                                    <span className="text-xs font-semibold text-gray-500">{suffix}</span>
                                  </div>
                                );
                              }
                              return displayName;
                            })()}
                          </div>
                          {/* Search-only indicator - show when reasoning is ON but not available for this tier */}
                          {reasoningMode && !REASONING_MODELS[col] && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="mt-1.5 inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium border border-gray-200 touch-manipulation">
                                  <Search className="w-3 h-3" />
                                  <span>Search only</span>
                                  <Info className="w-2.5 h-2.5 ml-0.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="bg-white border-gray-200 text-gray-700 max-w-[220px] p-3">
                                <p className="font-bold text-gray-700 text-xs mb-1.5">Search Only at This Tier</p>
                                <p className="text-[10px] text-gray-600 mb-2">
                                  Smaller models can search the web but lack the parameter count for chain-of-thought reasoning.
                                </p>
                                <p className="text-[10px] text-blue-600 font-medium">
                                  For Reasoning + Search, try 70B or Frontier.
                                </p>
                              </TooltipContent>
                            </Tooltip>
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
                          <div className="space-y-2">
                            <div className={`grid grid-cols-[1fr_auto] items-center gap-x-3 py-1 transition-all rounded px-1 -mx-1 ${
                              costFlash ? 'bg-amber-100 scale-[1.02]' : ''
                            }`}>
                              <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium">
                                <DollarSign className="w-4 h-4 flex-shrink-0" /> Est. Cost
                              </span>
                              <span className={`font-mono text-sm tabular-nums text-right transition-all ${
                                costFlash ? 'text-amber-700 font-bold' : 'text-gray-700'
                              }`}>
                                ${estimatedCost.toFixed(4)}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-1">
                              <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium">
                                <Target className="w-4 h-4 flex-shrink-0" /> Capability
                              </span>
                              <span className={`text-sm font-semibold text-right ${capabilityConfig.textColor}`}>
                                {capabilityConfig.label}
                              </span>
                            </div>

                            {/* GAP 2A: Skill tag - always visible */}
                            <div className="text-xs text-gray-500 italic py-2 border-t border-gray-100 mt-1.5 min-h-[36px] flex items-center">
                              {getSkillTag(col)}
                            </div>

                            {/* GAP 2B: Benchmarks - Expert Mode only */}
                            {expertMode && (
                              <>
                                {/* MMLU with delta vs baseline */}
                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium cursor-help">
                                        <BarChart3 className="w-4 h-4 flex-shrink-0" /> MMLU <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-[220px]">
                                      <p className="text-xs font-medium">MMLU: School-style knowledge & reasoning</p>
                                      <p className="text-xs text-gray-500 mt-1">{model!.benchmarks.mmlu ? formatMmluDelta(model!.benchmarks.mmlu) : ""}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <div className="text-right flex items-center justify-end gap-1">
                                    <span className="text-sm font-mono text-gray-700 tabular-nums">
                                      {model!.benchmarks.mmlu?.toFixed(0)}%
                                    </span>
                                    {col !== "8B" && model!.benchmarks.mmlu && (
                                      <span className="text-xs text-emerald-600">
                                        +{(model!.benchmarks.mmlu - BASELINE_MMLU).toFixed(0)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium cursor-help">
                                        <Code2 className="w-4 h-4 flex-shrink-0" /> HumanEval <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-[200px]">
                                      <p className="text-xs">HumanEval: How well it writes correct code. Higher % = better coder.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="text-sm font-mono text-gray-700 tabular-nums text-right">
                                    {model!.benchmarks.humanEval ? `${model!.benchmarks.humanEval.toFixed(0)}%` : "—"}
                                  </span>
                                </div>

                                {/* Reasoning Depth per band - shows capability regardless of toggle */}
                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium cursor-help">
                                        <Brain className="w-4 h-4 flex-shrink-0" /> Reasoning <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-[220px]">
                                      <p className="text-xs font-medium">Reasoning capability for this size band</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {col === "8B" || col === "14B" || col === "32B" 
                                          ? "Too small for step-by-step reasoning" 
                                          : col === "72B" 
                                            ? "Can do basic chain-of-thought" 
                                            : "Full deep reasoning capability"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className={`text-sm font-medium text-right ${getReasoningDepthForBand(col).color}`}>
                                    {getReasoningDepthForBand(col).label}
                                  </span>
                                </div>
                              </>
                            )}

                            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-1">
                              <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium">
                                {model!.modality === "text" ? (
                                  <FileText className="w-4 h-4 flex-shrink-0" />
                                ) : (
                                  <Image className="w-4 h-4 flex-shrink-0" />
                                )}
                                Input
                              </span>
                              <span className="text-sm font-medium text-right text-gray-500">
                                {model!.modality === "text" ? "Text" : "Vision"}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-1">
                              <span className="text-gray-600 flex items-center gap-1.5 text-sm font-medium">
                                <Clock className="w-4 h-4 flex-shrink-0" /> Speed
                              </span>
                              <span className="text-sm text-gray-400 italic text-right">
                                Run test
                              </span>
                            </div>

                            {/* GAP 2B: Technical Details - Expert Mode only */}
                            {expertMode && (
                              <button
                                onClick={() => setExpandedTechDetails(prev => ({ ...prev, [col]: !prev[col] }))}
                                className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 pt-2 mt-1 border-t border-gray-100"
                              >
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  Technical Details
                                </span>
                                {expandedTechDetails[col] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}

                            {expertMode && expandedTechDetails[col] && (
                              <div className="space-y-1.5 pt-1 text-xs">
                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-500 flex items-center gap-1 cursor-help">
                                        <Cpu className="w-3 h-3" /> Architecture
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">Model architecture type and attention mechanism</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className={`font-medium text-right ${model!.technical.architecture.type === "Sparse MoE" ? "text-purple-600" : "text-gray-600"}`}>
                                    {model!.technical.architecture.type === "Sparse MoE" ? "MoE" : "Dense"}
                                  </span>
                                </div>

                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-500 flex items-center gap-1 cursor-help">
                                        <Database className="w-3 h-3" /> Training
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">Training data sources: {model!.technical.training.dataSources.join(", ")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="text-gray-600 text-right">
                                    {model!.technical.training.dataDate}
                                  </span>
                                </div>

                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-500 flex items-center gap-1 cursor-help">
                                        <Settings className="w-3 h-3" /> Fine-tuning
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">Fine-tuning: {model!.technical.finetuning.method}</p>
                                      {model!.technical.finetuning.variants && (
                                        <p className="text-xs mt-1">Variants: {model!.technical.finetuning.variants.join(", ")}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className={`font-medium text-right ${
                                    model!.technical.finetuning.method === "RLHF" ? "text-blue-600" :
                                    model!.technical.finetuning.method === "DPO" ? "text-green-600" :
                                    "text-gray-600"
                                  }`}>
                                    {model!.technical.finetuning.method}
                                  </span>
                                </div>

                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-500 flex items-center gap-1 cursor-help">
                                        <Zap className="w-3 h-3" /> Inference
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">Precision: {model!.technical.inference.precision}</p>
                                      {model!.technical.inference.optimizations && (
                                        <p className="text-xs mt-1">Optimizations: {model!.technical.inference.optimizations.join(", ")}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="text-gray-600 text-right">
                                    {model!.technical.inference.precision}
                                  </span>
                                </div>

                                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-500 flex items-center gap-1 cursor-help">
                                        <Shield className="w-3 h-3" /> Safety
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">Safety methods: {model!.technical.safety.methods.join(", ")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className={`font-medium text-right ${model!.technical.safety.aligned ? "text-green-600" : "text-red-600"}`}>
                                    {model!.technical.safety.aligned ? "Aligned" : "Unaligned"}
                                  </span>
                                </div>
                              </div>
                            )}
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

                    {/* TEMP FIX: Special UI for search unavailable on 3B and 70B */}
                    {isSearchUnavailable && (
                      <div className="text-center py-4 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 mb-3 rounded-full flex items-center justify-center bg-blue-100">
                          <Search className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-blue-600 text-center mb-1">
                          Search Not Available
                        </span>
                        <span className="text-xs text-gray-500 text-center px-4">
                          Web search is temporarily unavailable for this model size.
                        </span>
                        <div className="mt-4 p-2 bg-white rounded-lg border border-blue-100">
                          <p className="text-[10px] text-gray-500 text-center">
                            Search works best with mid-size or larger models.
                          </p>
                          <p className="text-[10px] text-blue-600 font-medium text-center mt-1">
                            Try 8B, 14B, or Frontier
                          </p>
                        </div>
                      </div>
                    )}

                    {hasContent && (() => {
                      const actualLatencyCategory = getLatencyCategory(response.latency || 0);
                      const actualLatencyConfig = getLatencyBarConfig(actualLatencyCategory);
                      const actualCostConfig = getCostVisuals(response.cost || 0);
                      return (
                        <div className="flex flex-col flex-grow">
                          {/* Success indicator */}
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
                          
                          {/* 1. Latency & Cost metrics (always shown) */}
                          <div className="mb-3 space-y-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-gray-500 flex items-center gap-1">
                                        Latency
                                        <Info className="w-3 h-3 text-gray-400" />
                                      </span>
                                      <span className={`font-mono font-bold ${actualLatencyConfig.color.replace('bg-', 'text-')}`}>
                                        {((response.latency || 0) / 1000).toFixed(2)}s
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${actualLatencyConfig.width} ${actualLatencyConfig.color} rounded-full`}></div>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent 
                                  side="bottom" 
                                  align="center" 
                                  sideOffset={8}
                                  className="max-w-[220px] p-3 bg-gray-900 text-white border-0 shadow-xl"
                                >
                                  <p className="font-semibold mb-2 text-white text-xs">Why latency varies:</p>
                                  <ul className="space-y-1.5 text-gray-200 text-[11px]">
                                    <li>• <span className="font-medium text-white">Cold start:</span> First query spins up model</li>
                                    <li>• <span className="font-medium text-white">MoE:</span> Routing adds overhead</li>
                                    <li>• <span className="font-medium text-white">Provider:</span> Infrastructure varies</li>
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">Cost</span>
                              <span className={`font-mono ${actualCostConfig.size} ${actualCostConfig.color} ${actualCostConfig.style}`}>
                                ${response.cost?.toFixed(4)}
                              </span>
                            </div>
                          </div>

                          {/* 2. Expert Mode: Full model details (BEFORE response) */}
                          {expertMode && (
                            <div className="mb-3 space-y-1.5 pt-2 border-t border-gray-100">
                              {/* Est. Cost */}
                              <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                <span className="text-gray-600 flex items-center gap-1.5 text-xs font-medium">
                                  <DollarSign className="w-3 h-3 flex-shrink-0" /> Est. Cost
                                </span>
                                <span className="font-mono text-xs tabular-nums text-right text-gray-700">
                                  ${estimatedCost.toFixed(4)}
                                </span>
                              </div>

                              {/* Capability */}
                              <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                <span className="text-gray-600 flex items-center gap-1.5 text-xs font-medium">
                                  <Target className="w-3 h-3 flex-shrink-0" /> Capability
                                </span>
                                <span className={`text-xs font-semibold text-right ${capabilityConfig.textColor}`}>
                                  {capabilityConfig.label}
                                </span>
                              </div>

                              {/* Skill tag */}
                              <div className="text-xs text-gray-500 italic py-1.5 border-t border-gray-100 min-h-[28px] flex items-center">
                                {getSkillTag(col)}
                              </div>

                              {/* MMLU with delta */}
                              <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-600 flex items-center gap-1.5 text-xs font-medium cursor-help">
                                      <BarChart3 className="w-3 h-3 flex-shrink-0" /> MMLU <Info className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-[220px]">
                                    <p className="text-xs font-medium">MMLU: School-style knowledge & reasoning</p>
                                    <p className="text-xs text-gray-500 mt-1">{renderModel.benchmarks.mmlu ? formatMmluDelta(renderModel.benchmarks.mmlu) : ""}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <div className="text-right">
                                  <span className="text-xs font-mono text-gray-700 tabular-nums">
                                    {renderModel.benchmarks.mmlu?.toFixed(0)}%
                                  </span>
                                  {col !== "8B" && renderModel.benchmarks.mmlu && (
                                    <span className="text-[10px] text-emerald-600 ml-1">
                                      +{(renderModel.benchmarks.mmlu - BASELINE_MMLU).toFixed(0)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-600 flex items-center gap-1.5 text-xs font-medium cursor-help">
                                      <Code2 className="w-3 h-3 flex-shrink-0" /> HumanEval <Info className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-[200px]">
                                    <p className="text-xs">HumanEval: How well it writes correct code. Higher % = better coder.</p>
                                  </TooltipContent>
                                </Tooltip>
                                <span className="text-xs font-mono text-gray-700 tabular-nums text-right">
                                  {renderModel.benchmarks.humanEval ? `${renderModel.benchmarks.humanEval.toFixed(0)}%` : "—"}
                                </span>
                              </div>

                              {/* Reasoning Depth */}
                              <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-600 flex items-center gap-1.5 text-xs font-medium cursor-help">
                                      <Brain className="w-3 h-3 flex-shrink-0" /> Reasoning <Info className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-[220px]">
                                    <p className="text-xs font-medium">Reasoning capability for this size band</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {col === "8B" || col === "14B" || col === "32B" 
                                        ? "Too small for step-by-step reasoning" 
                                        : col === "72B" 
                                          ? "Can do basic chain-of-thought" 
                                          : "Full deep reasoning capability"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                                <span className={`text-xs font-medium text-right ${getReasoningDepthForBand(col).color}`}>
                                  {getReasoningDepthForBand(col).label}
                                </span>
                              </div>

                              <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                <span className="text-gray-600 flex items-center gap-1.5 text-xs font-medium">
                                  {renderModel.modality === "text" ? (
                                    <FileText className="w-3 h-3 flex-shrink-0" />
                                  ) : (
                                    <Image className="w-3 h-3 flex-shrink-0" />
                                  )}
                                  Input
                                </span>
                                <span className="text-xs font-medium text-right text-gray-500">
                                  {renderModel.modality === "text" ? "Text" : "Vision"}
                                </span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTechDetails(prev => ({ ...prev, [col]: !prev[col] }));
                                }}
                                className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 pt-2 mt-1 border-t border-gray-100"
                              >
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  Technical Details
                                </span>
                                {expandedTechDetails[col] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {expandedTechDetails[col] && (
                                <div className="space-y-1 pt-1 text-xs">
                                  <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                    <span className="text-gray-500 flex items-center gap-1">
                                      <Cpu className="w-3 h-3 flex-shrink-0" /> Architecture
                                    </span>
                                    <span className={`font-medium text-right ${renderModel.technical.architecture.type === "Sparse MoE" ? "text-purple-600" : "text-gray-600"}`}>
                                      {renderModel.technical.architecture.type === "Sparse MoE" ? "MoE" : "Dense"}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                    <span className="text-gray-500 flex items-center gap-1">
                                      <Database className="w-3 h-3 flex-shrink-0" /> Training
                                    </span>
                                    <span className="text-gray-600 text-right">{renderModel.technical.training.dataDate}</span>
                                  </div>
                                  <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                    <span className="text-gray-500 flex items-center gap-1">
                                      <Settings className="w-3 h-3 flex-shrink-0" /> Fine-tuning
                                    </span>
                                    <span className={`font-medium text-right ${
                                      renderModel.technical.finetuning.method === "RLHF" ? "text-blue-600" :
                                      renderModel.technical.finetuning.method === "DPO" ? "text-green-600" : "text-gray-600"
                                    }`}>
                                      {renderModel.technical.finetuning.method}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                    <span className="text-gray-500 flex items-center gap-1">
                                      <Zap className="w-3 h-3 flex-shrink-0" /> Inference
                                    </span>
                                    <span className="text-gray-600 text-right">{renderModel.technical.inference.precision}</span>
                                  </div>
                                  <div className="grid grid-cols-[1fr_70px] items-center gap-x-2 py-0.5">
                                    <span className="text-gray-500 flex items-center gap-1">
                                      <Shield className="w-3 h-3 flex-shrink-0" /> Safety
                                    </span>
                                    <span className={`font-medium text-right ${renderModel.technical.safety.aligned ? "text-green-600" : "text-red-600"}`}>
                                      {renderModel.technical.safety.aligned ? "Aligned" : "Unaligned"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 3. Response content (at the END) */}
                          <div className={`${expertMode ? 'pt-2 border-t border-gray-200' : ''}`}>
                            <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words flex-grow overflow-hidden line-clamp-4">
                              {response.content}
                            </div>
                            <p className="text-xs text-[#1a3a8f] font-bold mt-2 hover:underline text-center cursor-pointer">
                              View Full Response →
                            </p>
                          </div>
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

          {/* No Models Fit Budget Warning */}
          {noModelsInBudget && !isRunning && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 text-amber-700 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-bold">No models fit your budget</span>
              </div>
              <p className="text-sm text-amber-600">
                Increase the cost cap slider or select a smaller context window to enable models.
              </p>
            </div>
          )}

          {/* Difficulty Nudge - suggests harder prompts when all models give similar answers */}
          {isEasyPrompt && allModelsComplete && (
            <div className="mt-4 text-center animate-fade-in">
              <p className="text-sm text-gray-500 mb-2">
                💡 All models handled this one easily — try a harder prompt to see real capability differences
              </p>
              <button
                onClick={loadChallengePrompt}
                className="text-sm text-[#1a3a8f] hover:text-[#2a4a9f] font-medium hover:underline"
              >
                Try a Challenge Prompt →
              </button>
            </div>
          )}

          {/* Run Again teaching prompt - shows after first test completes */}
          {testRunCount === 1 && !isRunning && !isEasyPrompt && (
            <div className="text-center py-4 animate-fade-in">
              <button 
                onClick={handleRunAll}
                className="text-sm text-gray-500 hover:text-[#1a3a8f] hover:bg-gray-100 transition-all px-4 py-2 rounded-lg border border-gray-200 hover:border-[#1a3a8f]/30 cursor-pointer flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Run the test again — what changes?
              </button>
            </div>
          )}

          {/* Cost vs Capability Pareto Chart */}
          {COLUMNS.some(col => responses[col]?.content) && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <span className="font-bold text-sm text-gray-900">Cost vs Capability</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px] bg-white border-gray-200 text-gray-700">
                    <p className="text-xs font-medium mb-1">The Pareto Frontier</p>
                    <p className="text-xs">Models on the orange dashed line are "optimal" - no other model is both cheaper AND better. Models below the line are "dominated."</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {(() => {
                const chartModels = COLUMNS.map(col => {
                  const model = getModelForColumn(col);
                  if (!model) return null;
                  const response = responses[col];
                  const hasResult = response?.content && !response?.error;
                  const rawCost = response?.cost;
                  const cost = (typeof rawCost === 'number' && rawCost > 0) ? rawCost : estimateCost(model);
                  const mmlu = model.benchmarks.mmlu || 70;
                  const { disabled } = isModelDisabled(col);
                  const isRec = showResults && col === recommendedModel;
                  return { col, cost, mmlu, hasResult, disabled, isRec };
                }).filter(Boolean) as { col: string; cost: number; mmlu: number; hasResult: boolean; disabled: boolean; isRec: boolean }[];
                
                const minMmlu = 60;
                const maxMmlu = 95;
                
                const FIXED_X_POSITIONS: Record<string, number> = {
                  "8B": 5,
                  "14B": 25,
                  "32B": 45,
                  "72B": 70,
                  "Frontier": 95
                };
                
                const getX = (col: string) => {
                  return FIXED_X_POSITIONS[col] || 50;
                };
                
                const getY = (mmlu: number) => {
                  return 100 - ((mmlu - minMmlu) / (maxMmlu - minMmlu)) * 100;
                };
                
                const paretoFrontier = chartModels
                  .filter(m => m.hasResult && !m.disabled)
                  .filter(m => !chartModels.some(o => 
                    o.col !== m.col && 
                    o.hasResult && 
                    !o.disabled && 
                    o.cost <= m.cost && 
                    o.mmlu >= m.mmlu && 
                    (o.cost < m.cost || o.mmlu > m.mmlu)
                  ))
                  .sort((a, b) => getX(a.col) - getX(b.col));
                
                return (
                  <div className="relative h-[200px]">
                    <div className="absolute left-0 top-2 bottom-8 w-8 flex flex-col justify-between text-[10px] text-gray-400 pr-1">
                      <span className="text-right">{maxMmlu}%</span>
                      <span className="text-right">{Math.round((maxMmlu + minMmlu) / 2)}%</span>
                      <span className="text-right">{minMmlu}%</span>
                    </div>
                    
                    <div className="absolute left-8 right-4 bottom-0 h-6 flex justify-between text-[10px] text-gray-400 pt-1">
                      <span>Cheap</span>
                      <span>Cost →</span>
                      <span>Expensive</span>
                    </div>
                    
                    <div className="absolute left-8 right-4 top-2 bottom-8 bg-gray-50/50 border-l-2 border-b-2 border-gray-300">
                      {[0, 25, 50, 75, 100].map(pct => (
                        <div key={pct} className="absolute w-full border-t border-dashed border-gray-200" style={{ top: `${pct}%` }} />
                      ))}
                      
                      {paretoFrontier.length >= 2 && (
                        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                          <polyline
                            points={paretoFrontier.map(m => {
                              const xPct = getX(m.col);
                              const yPct = getY(m.mmlu);
                              return `${xPct}%,${yPct}%`;
                            }).join(' ')}
                            fill="none"
                            stroke="#f5a623"
                            strokeWidth="2"
                            strokeDasharray="6 3"
                          />
                        </svg>
                      )}
                      
                      {chartModels.map((m, i) => {
                        const xPct = getX(m.col);
                        const yPct = getY(m.mmlu);
                        const isOnFrontier = paretoFrontier.some(f => f.col === m.col);
                        const labelOffsetY = i % 2 === 0 ? -20 : 16;
                        const fillColor = m.isRec ? '#f5a623' : m.disabled ? '#d1d5db' : m.col === 'Frontier' ? '#f97316' : '#1a3a8f';
                        const textColor = m.isRec ? '#f5a623' : m.disabled ? '#9ca3af' : m.col === 'Frontier' ? '#ea580c' : '#1e40af';
                        const size = m.isRec ? 16 : 12;
                        return (
                          <div key={m.col} className="absolute" style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)' }}>
                            <div 
                              className="rounded-full"
                              style={{ 
                                width: size, 
                                height: size, 
                                backgroundColor: fillColor,
                                border: isOnFrontier ? '2px solid #f5a623' : '1px solid white',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                              }} 
                            />
                            <div 
                              className="absolute text-[10px] font-bold whitespace-nowrap"
                              style={{ 
                                left: '50%', 
                                top: labelOffsetY, 
                                transform: 'translateX(-50%)', 
                                color: textColor 
                              }}
                            >
                              {m.col}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f5a623]"></span> Recommended</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#1a3a8f]"></span> Open Source</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Frontier</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-dashed border-[#f5a623]"></span> Pareto Frontier</span>
              </div>
            </div>
          )}

          {showResults && allModelsComplete && (
            <div className="mt-6 p-4 bg-gradient-to-r from-[#1a3a8f]/5 to-[#f5a623]/5 rounded-lg border border-gray-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-[#1a3a8f]" />
                    Save & Share Results
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Save this test as a benchmark or share to the public leaderboard.
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
                      {((selectedModel.response.latency || 0) / 1000).toFixed(2)}s
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
                        <div className="text-xs text-gray-500 mb-1">Model Bands</div>
                        <div className="text-lg text-gray-900">
                          6 Columns
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          3B → 7B → 14B → 70B → Frontier → Reasoning
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
                          <p className="text-gray-600">Small models (4B-14B) cannot do deep reasoning reliably. Only 70B+ models have enough parameters for chain-of-thought.</p>
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
                          <p className="text-gray-600">Fast models (4B-7B) respond quickly but make more mistakes. Slow models (70B+) are more accurate but take longer.</p>
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
                    {inputPercentage > 100 && <li>Choose a larger <strong>Context Window</strong> or shorten your input</li>}
                  </ul>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showReasoningExplainModal} onOpenChange={setShowReasoningExplainModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black">
                <Brain className="w-5 h-5 text-[#1a3a8f]" />
                <span className="text-[#1a3a8f]">Why Reasoning Mode Needs Big Models</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium">
                  Reasoning mode is locked for 4B, 7B, and 14B models because they lack the capacity to "think step-by-step" reliably.
                </p>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-bold text-gray-900">What is Reasoning Mode?</h4>
                <p className="text-sm text-gray-700">
                  When reasoning mode is enabled, the model "shows its work" before giving an answer. It breaks down complex problems into steps, checks its logic, and explains its thinking process.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-gray-900">Why Do Small Models Fail at Reasoning?</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex gap-3">
                    <span className="text-[#1a3a8f] font-bold">1.</span>
                    <div>
                      <strong>Limited Working Memory</strong> — Small models can only hold a few concepts in mind at once. Multi-step reasoning requires juggling many pieces of information simultaneously.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[#1a3a8f] font-bold">2.</span>
                    <div>
                      <strong>Shallow Pattern Matching</strong> — With fewer parameters, small models rely on surface-level patterns rather than deep logical connections. They guess rather than reason.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[#1a3a8f] font-bold">3.</span>
                    <div>
                      <strong>Error Compounding</strong> — Each reasoning step has some error rate. In small models, errors compound quickly, leading to completely wrong conclusions.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-gray-900">The Parameter Threshold</h4>
                <p className="text-sm text-gray-700">
                  Research shows that chain-of-thought reasoning becomes reliable around <strong>70 billion parameters</strong>. Below this threshold, models often generate plausible-sounding but incorrect reasoning chains.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-center">
                    <div className="font-bold text-red-600">4B - 14B</div>
                    <div className="text-red-500">Too small for reliable reasoning</div>
                  </div>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-center">
                    <div className="font-bold text-emerald-600">70B+</div>
                    <div className="text-emerald-500">Large enough for deep reasoning</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-gray-900">Cost Trade-off</h4>
                <p className="text-sm text-gray-700">
                  Reasoning mode typically costs <strong>3-5× more</strong> because the model generates more tokens while thinking. This is why we recommend using reasoning only when you need it for complex problems like math, logic puzzles, or multi-step analysis.
                </p>
              </div>

              <Button 
                onClick={() => setShowReasoningExplainModal(false)}
                className="w-full bg-[#1a3a8f] hover:bg-[#2a4a9f]"
              >
                Got it
              </Button>
            </div>
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
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Privacy reminder:</strong> Your prompt will be publicly visible. Please don't include any personal information, private data, or sensitive content.
                </p>
              </div>
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
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-200 mb-2">
                        <p className="text-sm text-gray-700 font-mono line-clamp-2">{entry.prompt}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        {entry.results && (
                          <div className="flex flex-wrap gap-2 flex-1">
                            {Object.entries(entry.results).map(([col, result]) => (
                              <div 
                                key={col}
                                className={`px-2 py-1 rounded text-xs ${
                                  col === entry.recommendedModel 
                                    ? 'bg-[#f5a623]/20 text-[#f5a623] font-bold' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {col}: {(result.latency / 1000).toFixed(2)}s / ${result.cost.toFixed(4)}
                              </div>
                            ))}
                          </div>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                toast({
                                  title: "Flagged for review",
                                  description: "Thank you for helping keep our community safe.",
                                });
                              }}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Report inappropriate content</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* SPEC-EXACT: "Won't Fit" Modal with deliberate confirmation */}
        <Dialog open={showWontFitModal} onOpenChange={(open) => {
          if (!open) {
            setWontFitConfirmed(false);
            setPendingWontFitContext(null);
          }
          setShowWontFitModal(open);
        }}>
          <DialogContent className="max-w-md bg-white border-gray-200 text-gray-900 mx-2 sm:mx-auto w-[calc(100%-1rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 font-black text-red-600">
                <ShieldAlert className="w-6 h-6" />
                Context Won't Fit
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Your prompt has <span className="font-bold">{inputTokenEstimate.toLocaleString()}</span> tokens, 
                but <span className="font-bold">{CONTEXT_SIZES.find(s => s.value === pendingWontFitContext)?.label || 'the selected context'}</span> only holds <span className="font-bold">{(CONTEXT_SIZES.find(s => s.value === pendingWontFitContext)?.tokens || 0).toLocaleString()}</span> tokens.
              </p>
              
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium mb-2">
                  What this means:
                </p>
                <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                  <li>Your prompt will be cut off (truncated)</li>
                  <li>The AI won't see your complete question</li>
                  <li>Results may be incomplete or misleading</li>
                </ul>
              </div>
              
              <p className="text-sm text-gray-600">
                We recommend using <span className="font-bold text-emerald-600">{CONTEXT_SIZES.find(s => s.value === recommendedContextTier)?.label}</span> instead — 
                it's the smallest context that fits your full prompt.
              </p>
              
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  onClick={() => {
                    setContextSize(recommendedContextTier);
                    setShowWontFitModal(false);
                    setWontFitConfirmed(false);
                    setPendingWontFitContext(null);
                    setContextAutoSelected(false);
                    setShowContextMismatch(false);
                    setPendingRecommendedTier(null);
                    toast({
                      title: "Context Upgraded",
                      description: `Switched to ${CONTEXT_SIZES.find(s => s.value === recommendedContextTier)?.label} — your complete prompt will now be processed.`,
                    });
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  Use {CONTEXT_SIZES.find(s => s.value === recommendedContextTier)?.label} (recommended)
                </Button>
                
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Advanced:</p>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={wontFitConfirmed}
                      onChange={(e) => setWontFitConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900">
                      I understand results may be misleading
                    </span>
                  </label>
                  <Button
                    variant="outline"
                    onClick={handleWontFitConfirm}
                    disabled={!wontFitConfirmed}
                    className={`w-full mt-2 text-gray-600 border-gray-300 ${!wontFitConfirmed ? 'opacity-50' : ''}`}
                  >
                    Run truncated experiment (advanced)
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
