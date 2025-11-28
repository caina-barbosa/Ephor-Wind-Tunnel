# LLM WIND TUNNEL

## Overview

LLM WIND TUNNEL is an educational AI comparison tool designed to teach students about LLM engineering dimensions. The application enables users to send a single prompt to 5 AI models simultaneously, organized by model size (3B, 7B, 14B, 70B, Frontier), and compare responses in real-time.

The system teaches key engineering concepts:
- Model size vs capability tradeoffs
- Cost vs performance optimization
- Reasoning mode constraints (only works on 70B+)
- Context window economics
- Latency vs accuracy tradeoffs

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2025-11-28**: Major UI redesign matching the "LLM Wind Tunnel" educational spec
  - Dark theme with modern gradient styling
  - Input token gauge showing usage vs context capacity
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

**UI Component System**: The application uses shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS. Dark theme with slate colors.

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
- **14B Column**: Qwen3 14B (OpenRouter via Replit AI) - Medium, $0.0002/1K tokens
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
   - DeepSeek R1 Distill 70B (reasoning)
   - DeepSeek R1 (reasoning)

4. **Replit AI Integration for OpenRouter**
   - Qwen3 14B
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
   - Color-coded latency (green/yellow/red)
   - Recommended model highlighting
   - "Why This Model?" explanations

4. **Compare and Learn**: Side-by-side comparison of responses helps students see:
   - Quality differences by model size
   - Speed differences by model type
   - Cost differences across providers
