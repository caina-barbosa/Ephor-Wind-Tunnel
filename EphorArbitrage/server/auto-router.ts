export interface RoutingDecision {
  modelId: string;
  modelName: string;
  route: "ultra-fast" | "fast" | "premium" | "code";
  routeLabel: string;
  routeIcon: string;
  score: number;
  signalsDetected: string[];
}

const CODE_MARKERS = ["```", "function ", "def ", "const ", "import ", "class ", "export ", "async ", "await ", "return ", "if (", "for (", "while ("];

const PREMIUM_KEYWORDS_2PT = [
  "analyze", "explain why", "compare", "contrast",
  "step by step", "in depth", "detailed", "comprehensive",
  "write an essay", "write a story", "draft", "compose"
];

const PREMIUM_KEYWORDS_1PT = [
  "why", "should i", "would", "could you explain",
  "pros and cons", "advantages", "disadvantages"
];

const FAST_STARTS = ["what is", "who is", "when did", "define", "how many"];

const FAST_KEYWORDS = [
  "capital of", "population of", "who won", "what year",
  "translate", "say in", "how do you say"
];

export function calculateRoutingScore(query: string): { score: number; signals: string[] } {
  const lowerQuery = query.toLowerCase().trim();
  const wordCount = query.split(/\s+/).filter(w => w.length > 0).length;
  
  let score = 0;
  const signals: string[] = [];

  for (const marker of CODE_MARKERS) {
    if (query.includes(marker)) {
      signals.push(`code: "${marker.trim()}"`);
      return { score: -999, signals };
    }
  }

  if (wordCount > 30) {
    score += 2;
    signals.push(`long query (${wordCount} words): +2`);
  }

  for (const keyword of PREMIUM_KEYWORDS_2PT) {
    if (lowerQuery.includes(keyword)) {
      score += 2;
      signals.push(`"${keyword}": +2`);
    }
  }

  for (const keyword of PREMIUM_KEYWORDS_1PT) {
    if (lowerQuery.includes(keyword)) {
      score += 1;
      signals.push(`"${keyword}": +1`);
    }
  }

  if (wordCount < 10) {
    score -= 2;
    signals.push(`short query (${wordCount} words): -2`);
  }

  for (const start of FAST_STARTS) {
    if (lowerQuery.startsWith(start)) {
      score -= 1;
      signals.push(`starts with "${start}": -1`);
      break;
    }
  }

  for (const keyword of FAST_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      score -= 1;
      signals.push(`"${keyword}": -1`);
    }
  }

  return { score, signals };
}

export function routeQuery(query: string): RoutingDecision {
  const { score, signals } = calculateRoutingScore(query);
  
  if (score === -999) {
    return {
      modelId: "deepseek/deepseek-chat",
      modelName: "DeepSeek-V3",
      route: "code",
      routeLabel: "Code Path",
      routeIcon: "💻",
      score: 0,
      signalsDetected: signals,
    };
  }

  if (score <= 0) {
    return {
      modelId: "meta-llama/llama-4-maverick:groq",
      modelName: "Groq: Llama 4 Maverick",
      route: "ultra-fast",
      routeLabel: "Ultra-Fast Path",
      routeIcon: "⚡",
      score,
      signalsDetected: signals,
    };
  }

  if (score >= 1 && score <= 2) {
    return {
      modelId: "moonshotai/kimi-k2",
      modelName: "Kimi K2 (Moonshot)",
      route: "fast",
      routeLabel: "Balanced Path",
      routeIcon: "🚀",
      score,
      signalsDetected: signals,
    };
  }

  return {
    modelId: "anthropic/claude-sonnet-4.5",
    modelName: "Claude Sonnet 4.5",
    route: "premium",
    routeLabel: "Premium Path",
    routeIcon: "💎",
    score,
    signalsDetected: signals,
  };
}

export function logRoutingDecision(query: string, decision: RoutingDecision, ttft: number): void {
  console.log("\n=== AUTO ROUTER DECISION ===");
  console.log(`Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  console.log(`Score: ${decision.score}`);
  console.log(`Signals: ${decision.signalsDetected.length > 0 ? decision.signalsDetected.join(", ") : "none"}`);
  console.log(`Route: ${decision.routeIcon} ${decision.routeLabel} → ${decision.modelName}`);
  console.log(`TTFT: ${ttft}ms`);
  console.log("============================\n");
}
