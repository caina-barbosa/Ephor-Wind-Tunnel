# EPHOR WIND TUNNEL

## Overview

EPHOR WIND TUNNEL is a multi-model AI comparison interface designed to test and compare AI models across different size categories. The application enables users to send a single prompt to 10 AI models simultaneously, organized by model size (3B, 7B, 14B, 70B, Frontier), and view their responses in a clean grid layout.

The system supports 10 AI models from various providers (Anthropic, Cerebras, DeepSeek, Moonshot, Together AI) with models categorized by parameter count for easy comparison.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2025-11-28**: Complete UI redesign - replaced chat interface with Wind Tunnel grid layout organized by model size columns (3B, 7B, 14B, 70B, Frontier)

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript, built using Vite for fast development with Hot Module Replacement (HMR).

**UI Component System**: The application uses shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS.

**Layout Structure**: Full-screen grid layout with:
- Prompt input and "Run All" button at the top
- 5-column grid organized by model size: 3B, 7B, 14B, 70B, Frontier
- Each cell displays model name with "reasoning" badge where applicable
- Gray empty state initially, loading state during generation, response preview when complete

**Model Grid Configuration**:
- **3B Column**: Qwen 2.5 3B
- **7B Column**: Qwen 2.5 7B
- **14B Column**: Qwen 2.5 14B
- **70B Column**: Llama 3.3 70B (non-reasoning), DeepSeek R1 Distill 70B (reasoning)
- **Frontier Column**: Claude Sonnet 4.5, DeepSeek V3, DeepSeek R1 (reasoning), QwQ 32B (reasoning), Kimi K2

**State Management**: Local React state manages prompt input and model responses. Each model response tracks loading state, error state, and content.

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js.

**API Design**: RESTful API with key endpoint:
- `POST /api/wind-tunnel/run` - Runs a single model with the given prompt

**AI Integration Strategy**: Multi-provider approach:

1. **Direct API Integration**: Anthropic (Claude Sonnet 4.5), Cerebras (Llama 3.3 70B), DeepSeek (DeepSeek-V3)
2. **Together AI Integration**: Qwen 2.5 (3B/7B/14B), DeepSeek R1 Distill 70B, DeepSeek R1, QwQ-32B
3. **OpenRouter Integration**: Kimi K2 (Moonshot)

**Database Layer**: Drizzle ORM with PostgreSQL via Neon serverless driver (available for future features).

## External Dependencies

**AI Model Providers**:
- Anthropic API (`api.anthropic.com`) - Claude Sonnet 4.5
- Cerebras API (`api.cerebras.ai`) - Llama 3.3 70B
- DeepSeek API (`api.deepseek.com`) - DeepSeek-V3
- Together AI API (`api.together.xyz`) - Qwen models, DeepSeek R1, QwQ-32B
- OpenRouter API (`openrouter.ai`) - Kimi K2 (Moonshot)

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
- `DEEPSEEK_API_KEY` - DeepSeek API authentication
- `OPENROUTER_API_KEY` - OpenRouter API authentication
- `TOGETHER_API_KEY` - Together AI API authentication
