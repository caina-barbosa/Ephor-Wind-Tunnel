# EPHOR WIND TUNNEL

## Overview

Ephor Wind Tunnel is an educational AI comparison tool designed to teach students about LLM engineering dimensions. The application enables users to send a single prompt to 5 AI models simultaneously, organized by model size (3B, 7B, 14B, 70B, Frontier), and compare responses in real-time.

The system teaches key engineering concepts:
- Model size vs capability tradeoffs
- Cost vs performance optimization
- Reasoning mode constraints (only works on 70B+)
- Context window economics
- Latency vs accuracy tradeoffs

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2025-11-29**: Expert Mode (Override Constraints)
  - Added "Expert Mode" toggle below control panel
  - When enabled, users can run models that exceed cost cap or context limits
  - Overridden models show amber "OVERRIDE" warning badge with tooltip
  - Helps students learn what happens when they ignore constraints
  - Note: Reasoning mode restrictions (70B+ requirement) cannot be overridden
- **2025-11-29**: Model Council and Benchmark Library
  - **Model Council Feature**: All 5 models judge each other's responses (peer review)
    - Each model receives all 5 anonymized responses
    - Each model ranks and critiques all responses (1-5 ranking with reasoning)
    - Consensus rankings calculated by averaging all judges' votes
    - Claude (Chairman) synthesizes a final answer from the best insights
    - ~$0.50-$2.00 per council run (31 API calls total)
  - **Benchmark Library**: Save and rerun test prompts
    - "Benchmark Library" button in header opens library modal
    - Save any prompt with name and optional description
    - Load saved benchmarks to re-run tests
    - Delete unwanted benchmarks
  - **Database Schema**: New tables for benchmarks and runs
    - `benchmarks` table: id, name, description, prompt, createdAt
    - `benchmark_runs` table: id, benchmarkId, prompt, runAt, settings, responses, councilEvaluations, consensusRankings, chairmanSynthesis
  - **API Endpoints**:
    - `POST /api/council/run` - Run the Model Council peer review
    - `GET /api/benchmarks` - List all saved benchmarks
    - `POST /api/benchmarks` - Save a new benchmark
    - `GET /api/benchmarks/:id` - Get benchmark with runs
    - `DELETE /api/benchmarks/:id` - Delete a benchmark
    - `GET /api/benchmark-runs/:id` - Get a specific run
- **2025-11-29**: Integrated Cost vs Capability Chart
  - Removed Cost Curve button from top right corner
  - Added inline Pareto frontier chart below model grid (appears after running tests)
  - Chart plots all 5 models on cost vs capability axes with logarithmic cost scale
  - Recommended model highlighted in orange, tested models in blue, disabled in gray
  - Dashed line shows the Pareto frontier curve
  - Legend explains dot colors (Recommended, Tested, Disabled)
- **2025-11-29**: Connected "Why?" to Recommended Model
  - Moved "Why This Model?" from top right button to directly under PICK badge
  - Small "Why?" link with info icon next to recommended model
  - Keeps explanation visually connected to the recommendation
- **2025-11-29**: Educational Visual Redesign - "Teaching Through Design"
  - Visual hierarchy in column headers:
    - 3B/7B: Smaller, lighter gray text (small models feel small)
    - 14B: Medium size and weight
    - 70B: Larger, bolder text
    - Frontier: Largest, boldest, Deep Royal Blue (#1a3a8f)
  - Visual latency bars (not just text):
    - Fast (<500ms): Short green bar (w-[25%])
    - Medium (500-2000ms): Medium orange bar (w-[55%])
    - Slow (>2000ms): Full-width red bar
  - Cost scaling visuals:
    - Cheap models: Small, subtle gray text
    - Expensive models: Large, bold red text with red background
  - Capability progression (4-bar visual meter):
    - Basic: 1 bar, gray
    - Good: 2 bars, light blue
    - Strong: 3 bars, medium blue
    - Excellent: 4 bars, deep royal blue
  - Prominent recommended badge:
    - Bright orange pill badge with glow effect
    - Entire recommended card has orange ring/glow
  - Card contrast by model size:
    - Small models (3B/7B): Lighter backgrounds, no shadow
    - Medium models (14B/70B): White, subtle shadows
    - Frontier: White with prominent shadow and blue border
  - Progress and completion states:
    - Progress circles colored by model prominence
    - Completion checkmarks colored by actual latency result
- **2025-11-29**: Minimal Apple-Style Design Refresh (base layer)
  - Simplified color palette to minimal scheme
  - Clean, professional Apple-inspired aesthetic
- **2025-11-28**: Complete Timeback Brand Rebrand (superseded by minimal design)
- **2025-11-28**: Simplified recommendation logic for better education
  - Recommendation now picks the CHEAPEST model that fits all constraints
  - No more keyword/complexity detection - transparent filtering only
  - Logic: (1) Filter by cost cap, (2) Filter by context window, (3) Filter by reasoning mode, (4) Pick cheapest
  - Students learn by experimenting: start cheap, compare results, upgrade if needed
  - Title changed to all caps: "EPHOR WIND TUNNEL"
  - Enhanced INPUT GAUGE with prominent blue styling, large token display, and explanatory text
  - Added "Estimated Capability" display in "Why This Model?" modal
  - Added context overflow check: models disabled when input exceeds selected context window
- **2025-11-28**: Renamed to "Ephor Wind Tunnel" with educational features
  - Changed latency metric from TTFT to Total Latency (full response time)
  - Mobile-responsive design: stacked controls, horizontal scrolling grid, touch-friendly dialogs
  - Enhanced "Input vs Context Capacity" gauge with clear X/Y tokens display and percentage
  - Added "Capability" indicator per model (Basic/Good/Strong/Excellent) with tooltips
  - Context window selector (8K/32K/128K/1M) with explanatory text
  - Cost cap slider ($0.00-$0.25) that disables expensive models
  - Reasoning mode toggle with 70B+ restriction
  - Color-coded latency indicators (Fast/Medium/Slow)
  - Circular progress spinners during model execution
  - "Why This Model?" explanation dialog
  - Recommended model highlighting based on constraints
- **2025-11-28**: Switched OpenRouter to use Replit AI Integration (billed to Replit credits)

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript, built using Vite for fast development with Hot Module Replacement (HMR).

**UI Component System**: The application uses shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS. Features a minimal Apple-inspired design with a white background, Deep Royal Blue (#1a3a8f) for primary actions, Orange (#f5a623) for recommended highlights, and neutral gray tones throughout.

**Layout Structure**: Full-screen grid layout with:
- Prompt input with token count gauge
- Control panel: Context Window, Cost Cap Slider, Reasoning Toggle
- "Run Wind Tunnel Test" button
- 5-column grid organized by model size: 3B, 7B, 14B, 70B, Frontier
- Each cell displays: model name, latency indicator, estimated cost, reasoning depth
- Circular progress spinners during execution
- Click-to-expand full response modal
- "Why This Model?" explanation modal

**Model Grid Configuration**:

NON-REASONING MODE:
- **3B Column**: Llama 3.2 3B (Together AI) - Fast, $0.00006/1K tokens
- **7B Column**: Qwen 2.5 7B (Together AI) - Fast, $0.0001/1K tokens
- **17B Column**: Llama 4 Maverick 17B (Together AI) - Fast, $0.0002/1K tokens
- **70B Column**: Llama 3.3 70B (Cerebras) - Medium, $0.0006/1K tokens
- **Frontier Column**: Claude Sonnet 4.5 (Anthropic) - Slow, $0.015/1K tokens

REASONING MODE (toggle ON):
- **3B Column**: DISABLED - "Reasoning requires 70B+"
- **7B Column**: DISABLED - "Reasoning requires 70B+"
- **14B Column**: DISABLED - "Reasoning requires 70B+"
- **70B Column**: DeepSeek R1 Distill 70B (Together AI) - Slow, Deep Reasoning
- **Frontier Column**: DeepSeek R1 (Together AI) - Slow, Deep Reasoning

**State Management**: Local React state manages:
- Prompt input and token estimation
- Context size selection
- Cost cap value
- Reasoning mode toggle
- Model responses with loading/error states
- Recommended model calculation

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js.

**API Design**: RESTful API with key endpoint:
- `POST /api/wind-tunnel/run` - Runs a single model with the given prompt, returns content, TTFT, and cost

**AI Integration Strategy**: Multi-provider approach:

1. **Anthropic Direct API** (`api.anthropic.com`)
   - Claude Sonnet 4.5

2. **Cerebras Direct API** (`api.cerebras.ai`)
   - Llama 3.3 70B

3. **Together AI API** (`api.together.xyz`)
   - Llama 3.2 3B
   - Qwen 2.5 7B
   - Llama 4 Maverick 17B
   - DeepSeek R1 Distill 70B (reasoning)
   - DeepSeek R1 (reasoning)

4. **Replit AI Integration for OpenRouter**
   - Kimi K2 (available for other uses)
   - Uses AI_INTEGRATIONS_OPENROUTER_BASE_URL and AI_INTEGRATIONS_OPENROUTER_API_KEY
   - Billed to Replit credits (no separate API key needed)

**Database Layer**: Drizzle ORM with PostgreSQL via Neon serverless driver (available for future features).

## External Dependencies

**AI Model Providers**:
- Anthropic API (`api.anthropic.com`) - Claude Sonnet 4.5
- Cerebras API (`api.cerebras.ai`) - Llama 3.3 70B
- Together AI API (`api.together.xyz`) - Llama 3.2 3B, Qwen 2.5 7B, DeepSeek models
- Replit AI Integration for OpenRouter - Qwen3 14B

**Database Service**:
- Neon Serverless PostgreSQL

**Development Tools**:
- Vite - Frontend build tool with HMR
- TypeScript - Type safety across frontend and backend
- Drizzle ORM - Database operations

**UI Libraries**:
- Radix UI - Accessible component primitives
- Tailwind CSS - Utility-first CSS framework
- Lucide React - Icon library

**Required Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Anthropic API authentication
- `CEREBRAS_API_KEY` - Cerebras API authentication
- `TOGETHER_API_KEY` - Together AI API authentication
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL` - Replit AI Integration for OpenRouter (auto-configured)
- `AI_INTEGRATIONS_OPENROUTER_API_KEY` - Replit AI Integration for OpenRouter (auto-configured)

## Educational Design Principles

Based on the "LLM Wind Tunnel for Kids" specification:

1. **Engineering Truth in UI**: The interface visually teaches that:
   - Reasoning only works on large models (70B+)
   - Cost rises nonlinearly with capability
   - Speed vs accuracy is the real tradeoff
   - Context = memory = cost

2. **Constraint-Based Learning**: Students must work within:
   - Budget limits (cost cap slider)
   - Model capability limits (reasoning restrictions)
   - Context size limits

3. **Visual Feedback**: 
   - Progress spinners (not text streaming)
   - Latency badges (Fast/Medium/Slow) in neutral gray
   - Orange highlight for recommended model
   - "Why This Model?" explanations

4. **Compare and Learn**: Side-by-side comparison of responses helps students see:
   - Quality differences by model size
   - Speed differences by model type
   - Cost differences across providers
