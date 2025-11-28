# EPHOR ARBITRAGE

## Overview
EPHOR ARBITRAGE is a clean, minimal multi-model AI chat interface focused on demonstrating **Speed Arbitrage** - comparing fast, budget-friendly AI models while tracking performance versus the premium Claude baseline. The application uses direct API integrations with 5 speed-optimized providers plus Together AI for 2 additional models (8 total). The interface emphasizes performance metrics, real-time cost tracking, and competitive analysis between models.

## Model Lineup (8 Models Total)
1. **Claude Sonnet 4.5** - anthropic/claude-sonnet-4.5 - $3.00/$15.00 (Premium baseline)
2. **Cerebras: Llama 3.3 70B** - meta-llama/llama-3.3-70b-instruct:cerebras - $0.60/$0.60 (Wafer-scale chip - FASTEST)
3. **Groq: Llama 4 Maverick** - meta-llama/llama-4-maverick:groq - $0.11/$0.34 (Groq LPU - Very fast)
4. **DeepSeek-V3** - deepseek/deepseek-chat - $0.14/$0.56 (Chinese, cost-effective)
5. **MiniMax M2** - minimax/minimax-m2 - $0.30/$1.20 (Chinese, quality-focused)
6. **Kimi K2 (Moonshot)** - moonshotai/kimi-k2 - $1.00/$3.00 (via OpenRouter - faster than Together AI)
7. **Qwen 2.5 72B (Alibaba)** - qwen/qwen-2.5-72b-instruct - $0.18/$0.18 (via Together AI - Turbo)
8. **GLM-4.6 (Zhipu)** - z-ai/glm-4-32b - $0.10/$0.10 (via Together AI)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18+ with TypeScript, Vite for fast HMR.
- **UI Component System**: shadcn/ui (New York style) based on Radix UI primitives, styled with Tailwind CSS and Class Variance Authority (CVA).
- **State Management**: TanStack Query for server state, local React state for UI interactions.
- **Layout Pattern**: Fixed left sidebar, centered main content with responsive design.
- **Chat Management**: Features chat deletion with accessibility support, confirmation dialogs, and toast notifications.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript.
- **API Design**: RESTful endpoints for chat and message management, JSON format with Zod validation.
- **AI Integration Strategy**: 5 models use direct API integrations, 2 models via Together AI, 1 model via OpenRouter:
  - **Anthropic**: Direct API (api.anthropic.com) for Claude Sonnet 4.5
  - **Cerebras**: Direct API (api.cerebras.ai) for Llama 3.3 70B
  - **Groq**: Direct API (api.groq.com) for Llama 4 Maverick
  - **DeepSeek**: Direct API (api.deepseek.com) for DeepSeek-V3
  - **MiniMax**: Direct API (api.minimax.chat) for MiniMax M2
  - **Together AI**: Direct API (api.together.xyz) for Qwen 2.5 72B Turbo and GLM-4.6
  - **OpenRouter**: Via OpenRouter API (openrouter.ai) for Kimi K2 (faster than Together AI)
- **Cost Tracking**: Real-time token usage and cost tracking using actual token counts from API responses. Claude Sonnet 4.5 serves as baseline for savings calculations.
- **Auto Router Feature**: Intelligent query routing that analyzes query complexity and routes to optimal model:
  - **Ultra-Fast Path (Score < 0)**: Simple factual queries → Groq: Llama 4 Maverick
  - **Fast Path (Score 0-2)**: Moderate complexity → Kimi K2 (Moonshot)
  - **Premium Path (Score >= 3)**: Complex analysis → Claude Sonnet 4.5
  - **Code Path**: Detected code markers → DeepSeek-V3
  - Scoring signals: +2 for "analyze/explain/compare", +2 for long queries (>30 words), -2 for short queries (<10 words), -1 for "what is/who is" starters
  - UI displays routing decision badge with path icon and stats box showing score and detected signals
- **Compete Feature**: Democratic peer review system for ranking AI responses:
  1. **PEER REVIEW**: All 8 models judge all 8 anonymized responses (shuffled and labeled A-H). Each model ranks responses from best (1) to worst (8) based on factual accuracy, completeness, clarity, and depth.
  2. **RANKING**: The final ranking is determined by averaging each response's rank across all 8 judges. Lowest average rank = #1.
  3. **CHAIRMAN'S SYNTHESIS**: Claude Sonnet 4.5 combines the best insights from all responses with citations (e.g., [Cerebras: Llama 3.3 70B]), incorporating peer critiques.
  - Results are persistent and displayed in a dedicated UI.
- **Storage Layer**: PostgreSQL database (Neon-backed) with Drizzle ORM for type-safe data access.

### Data Storage Solutions
- **Database**: PostgreSQL (Neon serverless) for persistent storage.
- **Schema**: `chats` table (id, title, model_id, created_at), `messages` table (id, chat_id, role, content, model_name, compete_results, cost_stats, timestamp).
- **Technology**: @neondatabase/serverless driver, Drizzle ORM.
- **Cost Stats Storage**: Assistant messages store cost_stats as JSONB containing inputTokens, outputTokens, responseTimeMs (TTFT), totalTimeMs, tokensPerSecond, cost, claudeCost, saved, savedPercent.
- **Speed Tracking**: 
  - **TTFT (Time to First Token)**: Displayed in milliseconds, measures latency until first token appears. Fast models like Groq and Cerebras typically show 20-100ms TTFT.
  - **Throughput (tokens/sec)**: Calculated as outputTokens ÷ (totalTimeMs / 1000). Shows generation speed after first token. Fast models can achieve 500+ tok/s.
  - All 8 model API integrations use streaming mode to measure both TTFT and total response time accurately.
  - Stats display format: "⚡ 170ms TTFT | 📊 450 tok/s | 💰 98% saved"
- **Model Display Order**: Responses always display in consistent order: Claude Sonnet 4.5, Cerebras: Llama 3.3 70B, Groq: Llama 4 Maverick, DeepSeek-V3, MiniMax M2, Kimi K2 (Moonshot), Qwen 2.5 72B (Alibaba), GLM-4.6 (Zhipu).

### Authentication and Authorization
- **Current State**: No authentication or authorization implemented; all API endpoints are publicly accessible.

## External Dependencies

### AI Services (Direct API Integrations)
- **Anthropic**: Direct Claude API. Requires `ANTHROPIC_API_KEY`.
- **Cerebras**: Direct Cerebras API. Requires `CEREBRAS_API_KEY`.
- **Groq**: Direct Groq API. Requires `GROQ_API_KEY`.
- **DeepSeek**: Direct DeepSeek API. Requires `DEEPSEEK_API_KEY`.
- **MiniMax**: Direct MiniMax API. Requires `MINIMAX_API_KEY` and `MINIMAX_GROUP_ID`.
- **Together AI**: Together AI API. Requires `TOGETHER_API_KEY`. Used for Qwen 2.5 72B Turbo and GLM-4.6.
- **OpenRouter**: OpenRouter API. Requires `OPENROUTER_API_KEY`. Used for Kimi K2.

### UI Component Libraries
- **Radix UI**: Headless component primitives.
- **shadcn/ui**: Pre-styled components built on Radix UI.
- **Lucide React**: Icon library.
- **Embla Carousel**: Carousel functionality.
- **CMDK**: Command menu component.
- **React Hook Form**: Form state management with Zod validation.
- **date-fns**: Date manipulation.

### Build & Development
- **Vite**: Frontend build tool and dev server.
- **esbuild**: Backend bundling.
- **TypeScript**: Type checking.
- **Tailwind CSS**: Utility-first CSS framework.
- **PostCSS**: CSS processing.
