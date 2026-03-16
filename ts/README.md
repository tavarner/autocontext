# autoctx TypeScript Toolkit

`autoctx` is the Node/TypeScript package in this repo. It is the best entry point if you want a lightweight toolkit for:

- judging agent outputs against rubrics
- running multi-round improvement loops
- queueing and polling background tasks
- exposing those workflows over MCP
- embedding the toolkit directly in a TypeScript application

If you want the full multi-generation control plane, dashboard, training loop, scenario runner, and export/import flows, use the Python package in [`../autocontext`](../autocontext/README.md) instead.

## Install

```bash
npm install autoctx
```

From source:

```bash
cd ts
npm install
npm run build
```

## CLI Quick Start

The package ships an `autoctx` CLI with a focused command set:

```bash
npx autoctx judge -p "Write a haiku about testing" -o "Draft output" -r "Score clarity, format, and relevance"
npx autoctx improve -p "Write a haiku about testing" -o "Draft output" -r "Score clarity, format, and relevance" -n 3
npx autoctx queue -s my-task --priority 1
npx autoctx status
npx autoctx serve
```

`serve` starts the MCP server on stdio.

## Provider Configuration

The TypeScript package resolves its runtime provider from these environment variables:

- `AUTOCONTEXT_PROVIDER`: `anthropic`, `openai`, `openai-compatible`, `ollama`, or `vllm`
- `AUTOCONTEXT_MODEL`: override the default model name
- `AUTOCONTEXT_BASE_URL`: override the OpenAI-compatible base URL
- `AUTOCONTEXT_API_KEY`: generic API key override
- `ANTHROPIC_API_KEY`: fallback for Anthropic
- `OPENAI_API_KEY`: fallback for OpenAI-compatible providers

Examples:

```bash
ANTHROPIC_API_KEY=... npx autoctx judge -p "Write a haiku" -o "Draft" -r "Evaluate quality"

AUTOCONTEXT_PROVIDER=ollama \
AUTOCONTEXT_MODEL=llama3.1 \
npx autoctx improve -p "Write a haiku" -o "Draft" -r "Evaluate quality"
```

## Library Usage

```ts
import { createProvider, LLMJudge, ImprovementLoop, SimpleAgentTask } from "autoctx";

const provider = createProvider({
  providerType: "ollama",
  baseUrl: "http://localhost:11434/v1",
  model: "llama3.1",
});

const judge = new LLMJudge({
  provider,
  model: provider.defaultModel(),
  rubric: "Score clarity, correctness, and usefulness on a 0-1 scale.",
});

const result = await judge.evaluate({
  taskPrompt: "Explain binary search to a new engineer.",
  agentOutput: "Binary search checks the middle element and halves the search space.",
});

const task = new SimpleAgentTask(
  "Explain binary search to a new engineer.",
  "Score clarity, correctness, and usefulness on a 0-1 scale.",
  provider,
  provider.defaultModel(),
);

const loop = new ImprovementLoop({ task, maxRounds: 3, qualityThreshold: 0.9 });
const improved = await loop.run({ initialOutput: "Binary search is fast.", state: {} });
```

## MCP Usage

The package can expose evaluation tools over MCP:

```bash
ANTHROPIC_API_KEY=... npx autoctx serve
```

For a repo-level guide that compares CLI, MCP, and Python SDK integration paths, see [`../autocontext/docs/agent-integration.md`](../autocontext/docs/agent-integration.md).

Copy-paste integration snippets also live in [`../examples/README.md`](../examples/README.md).
