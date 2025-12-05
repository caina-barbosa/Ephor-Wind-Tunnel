# EPHOR WIND TUNNEL

## Overview

Ephor Wind Tunnel is an educational AI comparison tool designed to teach students about LLM engineering dimensions. It allows users to send a single prompt to five different AI model size bands (3B, 7B, 14B, 70B, Frontier) simultaneously and compare their responses in real-time. Global toggles for **Reasoning** and **Search** modes allow students to explore chain-of-thought reasoning and web-augmented generation across supported tiers. The project aims to illustrate key engineering concepts such as model size vs. capability tradeoffs, cost vs. performance optimization, chain-of-thought reasoning, context window economics, and latency vs. accuracy tradeoffs. The business vision is to provide an intuitive platform for learning complex LLM concepts, fostering a deeper understanding of AI engineering.

## User Preferences

Preferred communication style: Simple, everyday language.
CRITICAL: All interactive elements must be clickable for touch device support (use `touch-manipulation` class).
CRITICAL: DO NOT make changes without asking first.

## System Architecture

### UI/UX Decisions

The frontend uses React 18+ with TypeScript and Vite, styled with Tailwind CSS and shadcn/ui components. It features a minimal Apple-inspired design with a clean color palette (Deep Royal Blue for primary actions, Orange for recommendations, Purple for reasoning, neutral grays). The layout is a full-screen grid presenting **five model columns** (3B, 7B, 14B, 70B, Frontier) with visual cues for model size, latency, and cost. Column styling: 3B/7B (blue accent), 14B/70B (green accent), Frontier (orange accent). Educational elements include a context window auto-teaching mechanism, budget cap visual feedback, and prompt difficulty nudges. Key features like the Cost vs Capability Pareto chart, detailed technical accordions per model, and a "Why This Model?" explanation are integrated to enhance learning.

### Global Mode Toggles

*   **Reasoning Toggle** (purple): Activates chain-of-thought reasoning for supported tiers. Only 70B (DeepSeek R1) and Frontier (Claude with extended thinking) support reasoning mode. Smaller tiers show "Not Available" with educational guidance.
*   **Search Toggle** (blue): Activates web search mode using Perplexity models. 7B uses Sonar ($1/M), 14B/70B/Frontier use Sonar Pro ($3/M). 3B shows "Not Available" with guidance.
*   Only one mode can be active at a time (mutually exclusive).

### Technical Implementations

The application allows users to select context window sizes (8K-1M) and set a cost cap slider ($0.00-$0.25). Global Reasoning and Search toggles replace the dedicated Reasoning column, allowing students to explore these capabilities across multiple tiers. An "Expert Mode" enables overriding cost and context limits for experimental learning. A "Benchmark Library" allows saving and rerunning prompts. Results can be shared to a public leaderboard. The system dynamically adjusts model availability and recommendations based on user-defined constraints.

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
*   **File Upload for Context Sizing**: Helps students understand context window economics with:
    - "+" button next to prompt textarea (Claude/ChatGPT style UI)
    - Support for images (.png, .jpg, .gif, .webp), text files (.txt, .md), and PDFs
    - Files up to 10MB supported with automatic server-side processing
    - Large images (>3.5MB) are automatically compressed to fit Claude's 5MB API limit
    - Image compression uses sharp library: resize to max 1920px, JPEG quality 85
    - Estimated token count per file displayed in preview chips
    - Image tokens estimated based on dimensions (~765 tokens for 1024x1024)
    - Text file tokens counted at ~4 characters per token
    - PDF tokens estimated at ~250 tokens per KB
    - File tokens automatically added to Input Gauge total
    - Only Frontier (Claude) supports vision/image analysis - other tiers receive text description
    - Remove button (X) on each file chip
    - Clear button resets both prompt and uploaded files
    - Educational toasts when compression happens (explains API limits and compression concept)
    - Teaching point: understand real-world context consumption
*   **Multi-Segment Input Gauge**: Visual breakdown of context consumption with:
    - Stacked bar showing distinct segments for each token source
    - Prompt tokens (blue) - text typed by user
    - Image tokens (purple) - uploaded images
    - Text file tokens (emerald) - uploaded documents
    - Search tokens (striped blue) - estimated ~20,000 tokens when Search mode is on
    - Buffer tokens (amber) - reserved headroom in Expert Mode
    - Color-coded legend explaining each segment
    - Cumulative positioning ensures segments stack sequentially without overlap
    - All overflow detection uses total including search estimate
    - Teaching point: visualize how different inputs consume context
*   **Search Mode Context Overflow Learning**: Educational flow when enabling Search:
    - Warning toast: "Watch your Input Gauge!" (explains 20,000+ token overhead)
    - NO automatic upgrade - students must manually select larger context
    - Input Gauge shows striped blue search segment causing overflow
    - Overflow warning turns red prompting student to fix it
    - Tooltip tip: "Search works best with 128K+ context"
    - Teaching point: students learn by seeing overflow and choosing the fix themselves

### System Design Choices

The architecture is a client-server model with a React frontend and an Express.js backend. State management on the frontend is handled by local React state. The backend uses a RESTful API to manage requests and integrates with multiple AI model providers.

## External Dependencies

**AI Model Providers**:
*   Anthropic API (`api.anthropic.com`) for Claude Sonnet 4.5.
*   Together AI API (`api.together.xyz`) for Qwen2.5-7B, Qwen2.5-72B, DeepSeek R1 Distill 70B, and DeepSeek R1.
*   Replit AI Integration for OpenRouter for Chinese open source models: DeepSeek-R1-0528-Qwen3-8B (4B primary), DeepSeek-R1-14B (14B primary), Qwen3-14B (14B secondary), and Qwen2-72B (70B secondary), billed through Replit credits.

**Model Configuration by Band**:
*   3B: Primary = Qwen3-Next-A3B (Together AI MoE 80B/3B active)
*   7B: Primary = Qwen2.5-7B (Together AI), Secondary = DeepSeek-R1-Distill-Qwen-7B (OpenRouter)
*   14B: Primary = Qwen3-14B (OpenRouter), Secondary = DeepSeek-R1-Distill-Qwen-14B (OpenRouter)
*   70B: Primary = Qwen2.5-72B (Together AI), Secondary = Qwen2-72B (OpenRouter)
*   Frontier: Primary = Claude Sonnet 4.5 (Anthropic), Secondary = Moonshot Kimi K2 (OpenRouter)
*   Reasoning: DeepSeek R1 (Together AI) - Always uses chain-of-thought reasoning

**Search Models** (when Search toggle is ON):
*   Uses OpenRouter's `:online` suffix for web search on the same models
*   All tiers support search - uses Exa for open source models (~$0.02/request)
*   Claude (Frontier) uses native Anthropic search
*   3B: Qwen3-Next-A3B + Search
*   7B: Qwen2.5-7B + Search  
*   14B: Qwen3-14B + Search
*   70B: Qwen2.5-72B + Search
*   Frontier: Claude Sonnet 4.5 + Search (native)

**Reasoning Models** (when Reasoning toggle is ON):
*   70B: DeepSeek R1 (Together AI) with chain-of-thought
*   Frontier: Claude Sonnet 4.5 with extended thinking
*   3B/7B/14B: Not available (too small for reasoning)

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