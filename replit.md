# EPHOR ARBITRAGE

## Overview

EPHOR ARBITRAGE is a multi-model AI chat interface designed to demonstrate "Speed Arbitrage" - comparing fast, budget-friendly AI models against premium options while tracking performance and cost metrics. The application enables users to query multiple AI models simultaneously, compare their responses through a democratic peer review system, and analyze cost savings versus premium models like Claude Sonnet 4.5.

The system supports 8+ AI models from various providers (Anthropic, Cerebras, Groq, DeepSeek, MiniMax, Moonshot, Alibaba, Zhipu) with features including intelligent auto-routing based on query complexity, competitive response ranking, and comprehensive cost tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript, built using Vite for fast development with Hot Module Replacement (HMR).

**UI Component System**: The application uses shadcn/ui components (New York style) built on Radix UI primitives. Components are styled with Tailwind CSS and use Class Variance Authority (CVA) for variant management. The design follows a minimalist approach inspired by LMArena with generous whitespace and centered content.

**Layout Structure**: Fixed left sidebar (200px) containing branding and chat history, with centered main content area (max-width: 3xl) for optimal reading. The layout uses a clean, uncluttered interface with functional clarity.

**State Management**: TanStack Query (React Query) handles server state management and data fetching. Local React state manages UI interactions. Query client provides caching and optimistic updates.

**Routing**: Uses Wouter for lightweight client-side routing with two main routes: home (`/`) and chat detail (`/chat/:chatId`).

**Chat Management**: Features include chat creation, deletion with confirmation dialogs, accessibility support via keyboard shortcuts, and toast notifications for user feedback.

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js. Separate entry points for development (`index-dev.ts` with Vite integration) and production (`index-prod.ts` with static file serving).

**API Design**: RESTful API endpoints following JSON format with Zod schema validation. Key endpoints handle chat CRUD operations, message creation, and AI model completions.

**Database Layer**: Drizzle ORM for type-safe database operations with PostgreSQL via Neon serverless driver. WebSocket support through `ws` package for serverless PostgreSQL connections.

**AI Integration Strategy**: Multi-provider approach with three integration patterns:

1. **Direct API Integration (5 models)**: Anthropic (Claude Sonnet 4.5), Cerebras (Llama 3.3 70B), Groq (Llama 4 Maverick), DeepSeek (DeepSeek-V3), MiniMax (MiniMax M2) - Each has dedicated service module with streaming support
2. **Together AI Integration (3+ models)**: Qwen 2.5 72B Turbo, GLM-4.6, and additional models (Qwen 3B/7B/14B, DeepSeek-R1, QwQ-32B) via Together AI's unified API
3. **OpenRouter Integration (1 model)**: Kimi K2 (Moonshot) for faster routing than Together AI alternative

All integrations support streaming for Time-to-First-Token (TTFT) measurement and real-time response generation.

**Cost Tracking System**: Real-time token usage tracking using actual token counts from API responses. Calculates per-message costs, Claude baseline comparisons, and savings metrics (absolute and percentage). Cost statistics include input/output tokens, response times, throughput (tokens/second), and comparative cost analysis.

**Auto-Router Feature**: Intelligent query routing system that analyzes query complexity using a scoring algorithm:

- **Scoring Signals**: Long queries (+2 points), premium keywords like "analyze/explain" (+2 points), code detection (-999 to force code-optimized model), short queries (-2 points), simple fact queries (-1 point)
- **Routing Paths**: 
  - Ultra-Fast (score < 0): Groq Llama 4 Maverick
  - Fast (score 0-2): Kimi K2
  - Premium (score >= 3): Claude Sonnet 4.5
  - Code: DeepSeek-V3 (when code markers detected)
- UI displays routing decision with badge showing selected path, score, and detected signals

**Compete Feature**: Democratic peer review system for ranking AI responses:

1. **Peer Review Phase**: All 8 models evaluate all 8 anonymized responses (shuffled and labeled A-H), ranking from best (1) to worst (8) based on accuracy, completeness, and clarity
2. **Ranking Calculation**: Final ranking determined by averaging each response's rank across all judges (lowest average = #1)
3. **Chairman's Synthesis**: Claude Sonnet 4.5 generates a comprehensive synthesis combining best insights from all responses with citations (e.g., `[Cerebras: Llama 3.3 70B]`)

**Performance Optimization**: Streaming responses with TTFT measurement, timeout management (90s default), abort controllers for request cancellation, and connection pooling for database operations.

### Data Storage Architecture

**Database Schema**: PostgreSQL with two main tables:

- `chats`: Stores chat sessions (id, title, modelId, createdAt)
- `messages`: Stores individual messages with relations to chats (id, chatId, role, content, modelName, competeResults, costStats, timestamp)

**ORM Layer**: Drizzle ORM provides type-safe database operations with schema-driven development. Uses `drizzle-zod` for automatic Zod schema generation from database schema.

**Data Models**: TypeScript interfaces define cost statistics (CostStats), routing information (RoutingInfo), and message metadata. JSON columns store complex data like compete results and cost statistics.

**Session Management**: Uses `connect-pg-simple` for PostgreSQL-backed session storage with Express sessions.

## External Dependencies

**AI Model Providers**:
- Anthropic API (`api.anthropic.com`) - Claude Sonnet 4.5
- Cerebras API (`api.cerebras.ai`) - Llama 3.3 70B with wafer-scale chip acceleration
- Groq API (`api.groq.com`) - Llama 4 Maverick with LPU architecture
- DeepSeek API (`api.deepseek.com`) - DeepSeek-V3 and DeepSeek-R1
- MiniMax API (`api.minimax.io`) - MiniMax M2
- Together AI API (`api.together.xyz`) - Qwen models, GLM-4, QwQ-32B
- OpenRouter API (`openrouter.ai`) - Kimi K2 (Moonshot)

**Database Service**:
- Neon Serverless PostgreSQL - Cloud-hosted PostgreSQL with serverless driver and WebSocket support

**Development Tools**:
- Vite - Frontend build tool with HMR
- Drizzle Kit - Database migrations and schema management
- TypeScript - Type safety across frontend and backend
- ESBuild - Production build bundling for server code

**UI Libraries**:
- Radix UI - Unstyled, accessible component primitives
- Tailwind CSS - Utility-first CSS framework
- React Markdown - Markdown rendering for AI responses
- Lucide React - Icon library
- date-fns - Date formatting utilities

**Required Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Anthropic API authentication
- `CEREBRAS_API_KEY` - Cerebras API authentication
- `GROQ_API_KEY` - Groq API authentication
- `DEEPSEEK_API_KEY` - DeepSeek API authentication
- `MINIMAX_API_KEY` - MiniMax API authentication
- `MINIMAX_GROUP_ID` - MiniMax group identifier
- `OPENROUTER_API_KEY` - OpenRouter API authentication
- `TOGETHER_API_KEY` - Together AI API authentication