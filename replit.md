# EPHOR WIND TUNNEL

## Overview

Ephor Wind Tunnel is an educational AI comparison tool designed to teach students about LLM engineering dimensions. It allows users to send a single prompt to five different AI models (3B, 7B, 14B, 70B, Frontier) simultaneously and compare their responses in real-time. The project aims to illustrate key engineering concepts such as model size vs. capability tradeoffs, cost vs. performance optimization, reasoning mode constraints, context window economics, and latency vs. accuracy tradeoffs. The business vision is to provide an intuitive platform for learning complex LLM concepts, fostering a deeper understanding of AI engineering.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend uses React 18+ with TypeScript and Vite, styled with Tailwind CSS and shadcn/ui components. It features a minimal Apple-inspired design with a clean color palette (Deep Royal Blue for primary actions, Orange for recommendations, neutral grays). The layout is a full-screen grid presenting five model columns (4B, 7B, 14B, 70B, Frontier) with visual cues for model size, latency, and cost. Educational elements include a context window auto-teaching mechanism, budget cap visual feedback, and prompt difficulty nudges. Key features like the Cost vs Capability Pareto chart, detailed technical accordions per model, and a "Why This Model?" explanation are integrated to enhance learning.

### Technical Implementations

The application allows users to select context window sizes (8K-1M), set a cost cap slider ($0.00-$0.25), and toggle a reasoning mode (restricted to 70B+ models). An "Expert Mode" enables overriding cost and context limits for experimental learning. A "Benchmark Library" allows saving and rerunning prompts. Results can be shared to a public leaderboard. The system dynamically adjusts model availability and recommendations based on user-defined constraints.

### Feature Specifications

*   **LLM Engineering Dimensions**: Displays 10 key dimensions including Architecture, Parameters & Scaling, Training Data, Context Window, Benchmarks (MMLU%, HumanEval%), Fine-tuning Methods, Inference Optimization, Multimodality, Safety & Alignment, and Deployment Economics (Est. Cost, Speed).
*   **Context Window Management**: Auto-selects the smallest appropriate context, visually indicates token usage (used/unused), and provides cost-related feedback.
*   **Budget Cap with Educational "Over Budget" UI**: Filters out models exceeding a user-defined cost cap. When a band is over budget, it shows a comprehensive educational panel with:
    - Faded header (40% opacity) to indicate the band is locked
    - Gray card background with "Over budget for this band" title
    - Cost breakdown showing the minimum cost for that band
    - Context multiplier explanations (reasoning mode, context window impacts)
    - "Increase to $X.XX" CTA button to restore the band
    - "See cheaper bands" CTA button to scroll to eligible alternatives
    - "Why did this happen?" tooltip with educational content about budget constraints
    - Toast notifications when budget changes affect band availability
*   **Public Leaderboard**: Allows users to share test results with optional anonymity, including prompt, recommended model, settings, and performance data.
*   **Benchmark Library**: Users can save, load, and delete custom prompts for re-testing and comparison.
*   **Educational Prompts**: Includes a rotating set of challenge prompts to encourage deeper learning.
*   **Context Safety Buffer (Expert Mode)**: Teaches advanced context headroom concepts with:
    - Segmented control with Off/+10%/+25% buffer options
    - Effective tokens calculation (prompt × buffer multiplier)
    - Visual buffer bar in Input Gauge showing used tokens + reserved buffer
    - Dynamic context recommendations that factor in buffer needs
    - Warning panels when buffer forces context upgrade
    - Toast notifications for buffer state changes
    - Educational tooltips explaining buffer use cases (RAG, follow-ups, agent runs)
    - Teaching point: right-size context with just enough headroom

### System Design Choices

The architecture is a client-server model with a React frontend and an Express.js backend. State management on the frontend is handled by local React state. The backend uses a RESTful API to manage requests and integrates with multiple AI model providers.

## External Dependencies

**AI Model Providers**:
*   Anthropic API (`api.anthropic.com`) for Claude Sonnet 4.5.
*   Together AI API (`api.together.xyz`) for Qwen2.5-7B, Qwen2.5-72B, DeepSeek R1 Distill 70B, and DeepSeek R1.
*   Replit AI Integration for OpenRouter for Chinese open source models: DeepSeek-R1-0528-Qwen3-8B (4B primary), DeepSeek-R1-14B (14B primary), Qwen3-14B (14B secondary), and Qwen2-72B (70B secondary), billed through Replit credits.

**Model Configuration by Band**:
*   4B: Primary = DeepSeek-R1-0528-Qwen3-8B (OpenRouter), Secondary = DeepSeek-R1-0528-Qwen3-8B (OpenRouter)
*   7B: Primary = Qwen2.5-7B (Together AI), Secondary = DeepSeek-R1-Distill-Qwen-7B (OpenRouter)
*   14B: Primary = DeepSeek-R1-Distill-Qwen-14B (OpenRouter), Secondary = Qwen3-14B (OpenRouter)
*   70B: Primary = Qwen2.5-72B (Together AI), Secondary = Qwen2-72B (OpenRouter)
*   Frontier: Primary = Claude Sonnet 4.5 (Anthropic), Secondary = Moonshot Kimi K2 (OpenRouter)

**Database Service**:
*   Neon Serverless PostgreSQL (via Drizzle ORM).

**Development & UI Libraries**:
*   Vite (Frontend build tool).
*   TypeScript (Language).
*   Radix UI (Accessible component primitives).
*   Tailwind CSS (Styling).
*   Lucide React (Icons).
*   Drizzle ORM (Database operations).

**Environment Variables**:
*   `DATABASE_URL`
*   `ANTHROPIC_API_KEY`
*   `CEREBRAS_API_KEY`
*   `TOGETHER_API_KEY`
*   `AI_INTEGRATIONS_OPENROUTER_BASE_URL`
*   `AI_INTEGRATIONS_OPENROUTER_API_KEY`