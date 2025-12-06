# EPHOR WIND TUNNEL

## Overview

Ephor Wind Tunnel is an educational AI comparison tool designed to teach students about LLM engineering dimensions. It allows users to send a single prompt to six different AI model size bands (8B, 14B, 32B, 72B, 685B, Frontier) simultaneously and compare their responses in real-time. Open-source models include the Qwen family (Alibaba Cloud) and DeepSeek V3.2 for stability and consistency. Global toggles for **Reasoning** and **Search** modes allow students to explore chain-of-thought reasoning and web-augmented generation across supported tiers. The project aims to illustrate key engineering concepts such as model size vs. capability tradeoffs, cost vs. performance optimization, chain-of-thought reasoning, context window economics, and latency vs. accuracy tradeoffs. The business vision is to provide an intuitive platform for learning complex LLM concepts, fostering a deeper understanding of AI engineering.

## User Preferences

Preferred communication style: Simple, everyday language.
CRITICAL: All interactive elements must be clickable for touch device support (use `touch-manipulation` class).
CRITICAL: DO NOT make changes without asking first.

## System Architecture

### UI/UX Decisions

The frontend uses React 18+ with TypeScript and Vite, styled with Tailwind CSS and shadcn/ui components. It features a minimal Apple-inspired design with a clean color palette (Deep Royal Blue for primary actions, Orange for recommendations, Purple for reasoning, neutral grays). The layout is a full-screen grid presenting **six model columns** (8B, 14B, 32B, 72B, 685B, Frontier) with visual cues for model size, latency, and cost. Column styling by capability tier: 8B (blue - Good), 14B/32B (green - Strong), 72B/685B (violet - Excellent), Frontier (orange - Excellent). The "Excellent" capability label shows in violet for 72B/685B and orange for Frontier. Educational elements include a context window auto-teaching mechanism, budget cap visual feedback, and prompt difficulty nudges. Key features like the Cost vs Capability Pareto chart, detailed technical accordions per model, and a "Why This Model?" explanation are integrated to enhance learning.

### Global Mode Toggles

*   **Reasoning Toggle** (purple): Activates chain-of-thought reasoning for supported tiers. 72B (DeepSeek R1), 685B (DeepSeek V3.2 with reasoning_enabled), and Frontier (Claude with extended thinking) support reasoning mode. Smaller tiers show "Not Available" with educational guidance.
*   **Search Toggle** (blue): Activates web search mode using OpenRouter's `:online` suffix powered by Exa.ai (~$0.02/request). **Only 72B, 685B, and Frontier support search mode** - smaller tiers (8B/14B/32B) are disabled because OpenRouter's search variants have a 40K context limit but Exa returns 70K-140K tokens, causing guaranteed overflow.
*   Only one mode can be active at a time (mutually exclusive).

### Technical Implementations

The application allows users to select context window sizes (8K-1M) and set a cost cap slider ($0.00-$0.25). Global Reasoning and Search toggles replace the dedicated Reasoning column, allowing students to explore these capabilities across multiple tiers. An "Expert Mode" enables overriding cost and context limits for experimental learning. A "Benchmark Library" allows saving and rerunning prompts. Results can be shared to a public leaderboard. The system dynamically adjusts model availability and recommendations based on user-defined constraints.

### Feature Specifications

*   **LLM Engineering Dimensions**: Displays 10 key dimensions including Architecture, Parameters & Scaling, Training Data, Context Window, Benchmarks (MMLU%, HumanEval%), Fine-tuning Methods, Inference Optimization, Multimodality, Safety & Alignment, and Deployment Economics (Est. Cost, Speed).
*   **Cost vs Capability Pareto Chart**: Interactive visualization showing the cost/performance tradeoff with:
    - Y-axis uses actual MMLU benchmark scores (60-95% range normalized)
    - X-axis uses logarithmic cost scale for proper distribution across price points
    - Dynamic Pareto frontier line (orange dashed) connects optimal models
    - Highlights recommended model and shows which models are dominated
    - Updates live based on actual response costs after running tests
*   **Smart Model Recommendation**: Picks the smallest/cheapest model that completed successfully:
    - Filters out empty responses and explicit refusals
    - Sorts by cost (cheapest wins), uses latency as tiebreaker
    - For simple queries where all models succeed → picks cheapest (e.g., 8B)
    - For hard queries where smaller models fail → picks smallest that succeeded
    - Latency strings (fast/medium/slow) converted to ms for proper comparison
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
    - Warning toast: "Search needs 128K+ context!" with context-specific explanation
    - Explains why 32K isn't enough: search results vary 15K-35K, plus you need prompt + response room
    - NO automatic upgrade - students must manually select larger context
    - Input Gauge shows striped blue search segment causing overflow
    - Overflow warning turns red prompting student to fix it
    - Tooltip explains the "headroom" concept - why you can't fill context to the brim
    - Teaching point: students learn that estimates aren't guarantees, always leave buffer room

### System Design Choices

The architecture is a client-server model with a React frontend and an Express.js backend. State management on the frontend is handled by local React state. The backend uses a RESTful API to manage requests and integrates with multiple AI model providers.

## External Dependencies

**AI Model Providers**:
*   Anthropic API (`api.anthropic.com`) for Claude Sonnet 4.5.
*   Together AI API (`api.together.xyz`) for DeepSeek R1 (reasoning mode).
*   Replit AI Integration for OpenRouter for all Qwen models and Kimi K2, billed through Replit credits.

**Model Configuration by Band** (using stable Chinese open-source models via OpenRouter):
*   8B: Primary = Qwen3-8B (8.2B dense), Secondary = DeepSeek-R1-Distill-Qwen-7B
*   14B: Primary = Qwen3-14B (14B dense), Secondary = DeepSeek-R1-Distill-Qwen-14B
*   32B: Primary = Qwen3-32B (32B dense), Secondary = QwQ-32B (reasoning-focused)
*   72B: Primary = Qwen2.5-72B (72B dense), Secondary = Qwen2-72B
*   685B: Primary = DeepSeek V3.2 (685B MoE, 37B active) - Largest Chinese open-source model
*   Frontier: Primary = Claude Sonnet 4.5 (Anthropic), Secondary = Kimi K2 (Moonshot, 1T+ params)
*   Reasoning: DeepSeek R1 (Together AI) for 72B tier, DeepSeek V3.2 for 685B tier

**Search Models** (when Search toggle is ON):
*   Uses OpenRouter's `:online` suffix for web search powered by Exa.ai (~$0.02/request)
*   **Only 72B+ tiers support search mode** - smaller tiers disabled due to 40K context limit vs 70K-140K search results
*   8B: Not available (context too small)
*   14B: Not available (context too small)
*   32B: Not available (context too small)
*   72B: Qwen2.5-72B + Search
*   685B: DeepSeek V3.2 + Search
*   Frontier: Claude Sonnet 4 + Search (via OpenRouter)

**Reasoning Models** (when Reasoning toggle is ON):
*   72B: DeepSeek R1 (Together AI) with chain-of-thought
*   685B: DeepSeek V3.2 with reasoning_enabled parameter
*   Frontier: Claude Sonnet 4.5 with extended thinking
*   8B/14B/32B: Not available (too small for deep reasoning)

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