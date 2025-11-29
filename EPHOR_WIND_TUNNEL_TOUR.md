# EPHOR WIND TUNNEL
## The AI Engineering Intuition Machine for Students

**A revolutionary educational tool that teaches students how real ML engineers evaluate and choose AI models.**

---

## Executive Summary

Ephor Wind Tunnel is not just a UI—it's an **AI engineering intuition machine**. It teaches the same truths that take ML engineers years to internalize:

- Bigger models ≠ always better
- Reasoning is expensive
- Context is memory, and memory is cost
- Constraints shape decisions
- Speed vs accuracy is the real tradeoff
- Cost matters more than capability in production

Students submit a single prompt and watch 5 AI models race to answer it—learning by direct comparison.

---

## The 5-Column Model Grid

Students see models organized by size, creating immediate visual hierarchy:

| 3B | 7B | 17B | 70B | Frontier |
|----|----|----|-----|----------|
| Llama 3.2 3B | Qwen 2.5 7B | Llama 4 Maverick 17B | Llama 3.3 70B | Claude Sonnet 4.5 |
| Cheapest | Fast | Multimodal | Powerful | State-of-the-art |
| $0.00006/1K | $0.0001/1K | $0.0002/1K | $0.0006/1K | $0.015/1K |

**Visual Teaching**: Column headers scale in size and boldness—small models feel small, Frontier feels premium.

---

## 10 Engineering Dimensions Taught

Every model card displays key dimensions that students must learn to evaluate LLMs:

### Visible at a Glance:
1. **Parameters & Scaling** — Column headers (3B → Frontier)
2. **Deployment Economics** — Est. Cost per query
3. **Capability** — Basic / Good / Strong / Excellent
4. **Benchmarks** — MMLU % and HumanEval % scores
5. **Multimodality** — Text-only vs Vision-capable
6. **Speed** — Latency measured after each test

### In Technical Details (Click to Expand):
7. **Architecture** — Dense Transformer vs Sparse MoE
8. **Training Data** — Year trained, data sources
9. **Fine-tuning Methods** — SFT, RLHF, DPO badges
10. **Inference Optimization** — Precision (BF16, FP16, INT8)
11. **Safety & Alignment** — Aligned status with methods

---

## The Control Panel

### Context Window Selector
- Options: **8K / 32K / 128K / 1M tokens**
- **Input Gauge** shows: "Your prompt uses X of Y tokens (Z%)"
- **Teaching**: When context increases, cost increases. Memory is expensive.

### Cost Cap Slider
- Range: **$0.00 to $0.25** per query
- As students move it, expensive models gray out
- Remaining affordable models stay lit
- **Teaching**: "Model choice always happens under compute + cost constraints."

### Reasoning Mode Toggle
- **OFF**: All 5 models available (fast, cheap)
- **ON**: Only 70B and Frontier available
- Small models show: "Reasoning requires 70B+"
- **Teaching**: "Small models can't do deep reasoning—it's just noise."

### Expert Mode
- Allows students to **override constraints** and run anyway
- Shows amber warning badge: "OVERRIDE"
- **Teaching**: Students learn failure modes by breaking rules and seeing results

---

## How a Test Works

1. **Student enters a prompt** (e.g., "Explain quantum entanglement")
2. **System recommends** the cheapest model that fits all constraints
3. **Student clicks "Run Wind Tunnel Test"**
4. **All 5 models race simultaneously**:
   - Circular progress spinners (NOT text streaming)
   - Students see big models take longer
   - Reasoning mode takes significantly longer
5. **Results appear**:
   - Latency bars (green = fast, red = slow)
   - Actual cost incurred
   - Click any card to see full response
6. **Pareto Frontier Chart** appears showing cost vs capability tradeoff

---

## Killer Feature #1: "Why This Model?"

Next to the recommended model's orange **PICK** badge, students can click **"Why?"**

A modal explains:
- Why this model was chosen
- Cost justification
- Latency expectation
- Reasoning compatibility
- Context fit

**Teaching**: Engineers must justify their model choices.

---

## Killer Feature #2: Pareto Frontier Chart

After running a test, an interactive chart appears showing:
- All 5 models plotted on **Cost vs Capability** axes
- Recommended model highlighted in orange
- Dashed line showing the Pareto frontier

**Teaching**: "Every ML system lives on a Pareto frontier. You can't have the best of everything."

---

## Killer Feature #3: Model Council

Students can run a **peer review** where all 5 models judge each other:

1. Each model receives all 5 anonymized responses
2. Each model ranks and critiques the others (1-5 with reasoning)
3. Consensus rankings calculated by averaging votes
4. Claude (as "Chairman") synthesizes a final answer

**Teaching**: Even AI models disagree. Evaluation is nuanced.

---

## Killer Feature #4: Benchmark Library

Students can **save prompts** and rerun them later:
- Name and describe benchmarks
- Load saved benchmarks with one click
- Track results over time

**Teaching**: Real ML engineers build benchmark suites.

---

## Killer Feature #5: Public Leaderboard

Students can **share results** to a public leaderboard:
- Opt-in with privacy reminder (no personal info in prompts)
- Optional display name or anonymous
- Shows: prompt, recommended model, settings, per-model results

**Students compete to find**:
- The cheapest model that gives correct reasoning
- The fastest model that passes a complex query
- The smallest model that can solve X

**Teaching**: This is the "Kaggle of K-12 AI."

---

## What the UI Does NOT Do (By Design)

| Anti-Pattern | Why We Avoid It |
|--------------|-----------------|
| Stream chain-of-thought text | Confuses "more text = better reasoning" |
| Hide cost | Cost is a core teaching principle |
| Allow reasoning on small models | Models bad engineering practice |
| Default to fastest model | Teaches constraint-based engineering instead |

---

## The Engineering Truths Students Internalize

By using Ephor Wind Tunnel repeatedly, students build intuition for:

| Truth | How They Learn It |
|-------|-------------------|
| Bigger ≠ always better | Small models sometimes win on speed |
| Reasoning is expensive | Cost jumps when reasoning mode is ON |
| Context = memory = cost | Cost indicator changes with context size |
| Constraints shape decisions | Cost cap disables expensive options |
| Speed vs accuracy tradeoff | Latency bars show the cost of capability |
| Cost matters in production | Budget slider forces real-world thinking |

---

## Technical Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (Neon serverless)
- **AI Providers**:
  - Anthropic (Claude Sonnet 4.5)
  - Cerebras (Llama 3.3 70B)
  - Together AI (Llama 3.2 3B, Qwen 2.5 7B, Llama 4 Maverick, DeepSeek R1)

---

## Summary

**Ephor Wind Tunnel is the most original AI education UI we've seen.**

It's a flight simulator for AI intuition—teaching students the engineering truths that take professional ML engineers years to internalize.

Students don't just pick models. They learn:
- Why constraints matter
- Why cost shapes decisions
- Why bigger isn't always better
- Why reasoning has a price

**This is AI engineering education, embodied in interface design.**

---

*Ready to deploy and share with students.*
