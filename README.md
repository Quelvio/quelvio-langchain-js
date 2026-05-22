# @quelvio/langchain

> Quelvio for LangChain.js — your company's brain as a LangChain tool and retriever.

`@quelvio/langchain` is the official TypeScript / JavaScript integration
that plugs Quelvio's enterprise knowledge API into
[LangChain.js](https://js.langchain.com). It ships two first-class
building blocks — a `Retriever` for RAG chains and a `Tool` for agents —
both wired to your organization's connected sources (Google Drive,
SharePoint, Confluence, Slack, Notion, and the rest of your content
fabric) and scoped to the running user's individual permissions.

[![npm version](https://img.shields.io/npm/v/@quelvio/langchain.svg)](https://www.npmjs.com/package/@quelvio/langchain)
[![Node.js](https://img.shields.io/node/v/@quelvio/langchain.svg)](https://www.npmjs.com/package/@quelvio/langchain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Why Quelvio (and not vanilla RAG)?

A naive RAG pipeline embeds every chunk it can find and ranks by cosine
similarity. That's why most internal copilots confidently quote a
three-year-old draft. Quelvio is a managed company-brain that does the
work a generic vector store can't:

- **Authority scoring.** Every chunk is ranked by *who authored it*, *how
  fresh it is*, and *how many downstream documents reference it* — not
  just semantic similarity to the question.
- **Lifecycle awareness.** Drafts, deprecated docs, and superseded
  decisions are demoted automatically; chunks return a `lifecycle_state`
  the LLM can quote when hedging.
- **Per-employee permissioning.** Every query is scoped to the running
  user's identity. Results never include documents the user can't
  already read in the source system (Drive ACLs, Confluence space
  restrictions, SharePoint groups).
- **Synthesized answers with citations.** The API returns a final answer
  *plus* the chunks that informed it, so your agent can hand the user a
  link to the source of truth, not a hallucination.

## Install

```bash
npm install @quelvio/langchain @langchain/core
# or
pnpm add @quelvio/langchain @langchain/core
# or
yarn add @quelvio/langchain @langchain/core
```

Requires Node.js 20+ and `@langchain/core` 0.3.x as a peer dependency.

## Quickstart

### As a retriever (RAG chain)

```ts
import { QuelvioRetriever } from '@quelvio/langchain';

const retriever = new QuelvioRetriever({ apiKey: 'qlv_pat_...' }); // or set QUELVIO_API_KEY
const docs = await retriever.invoke("what's our refund policy?");

for (const d of docs) {
  console.log(`${d.metadata.title} (authority=${d.metadata.authority_score ?? '—'})`);
  console.log(d.pageContent.slice(0, 200));
  console.log('---');
}
```

Each returned `Document` carries the chunk's `source_url`,
`authority_score`, `taxonomy_domain`, `chunk_id`, and (when present) the
author's name, email, and department on `metadata`.

### As an agent tool

```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { QuelvioTool } from '@quelvio/langchain';

const llm = new ChatAnthropic({ model: 'claude-sonnet-4-6' });
const tools = [new QuelvioTool({ apiKey: 'qlv_pat_...' })];

const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are a helpful assistant. Use the quelvio_query tool whenever the user asks ' +
      'about internal company information.',
  ],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

const agent = await createToolCallingAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools });

const { output } = await executor.invoke({ input: "What's our parental leave policy?" });
console.log(output);
```

The tool's name is `quelvio_query` and its schema accepts `question`
(required) plus optional `mode` (`fast` | `standard` | `deep`),
`max_sources` (1–50), and `domain` (taxonomy domain filter).

### One-shot synthesis

For the simplest case — single answer, no chain, no agent:

```ts
import { synthesizeAnswer } from '@quelvio/langchain';

const result = await synthesizeAnswer('what is our deployment process?');
console.log(result.answer);
for (const source of result.sources) {
  console.log(`  • ${source.title} → ${source.source_url}`);
}
```

## Authentication

`@quelvio/langchain` resolves a bearer token from the first non-empty
source, in order:

| Precedence | Source                          | Notes                                                |
| ---------- | ------------------------------- | ---------------------------------------------------- |
| 1          | `apiKey: '…'` constructor arg   | Highest priority; never persisted, never logged.     |
| 2          | `QUELVIO_API_KEY` env var       | Best for CI, notebooks, and one-off scripts.         |

Three token types are accepted — the wire format is identical, so the
library does not need to know which kind you provided:

- **Personal Access Token (PAT).** Long-lived bearer tied to a human
  user. Generate at <https://enterprise.quelvio.com/account> → *Personal
  API Keys* → *Create token*. Best for ad-hoc use and CI.
- **OAuth access token.** Short-lived token from the device-code flow
  (`quelvio login` in the [CLI](https://github.com/Quelvio/quelvio-cli)).
- **Service Account key.** Long-lived, machine-scoped. Generate at
  *Settings* → *Service Accounts*. Best for production agents.

The token is held privately on the client (via a `#private` field and a
closure); it never appears in `toString()`, `JSON.stringify()`, or any
error message emitted by this library.

## Configuration

| Constructor arg / env var       | Default                       | Purpose                                                 |
| ------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `apiKey` / `QUELVIO_API_KEY`    | *(required)*                  | Bearer token (PAT, OAuth, or Service Account).          |
| `baseUrl` / `QUELVIO_API_BASE`  | `https://api.quelvio.com`     | API base — point at `api-dev` for staging.              |
| `timeoutMs`                     | `30000`                       | Per-request HTTP timeout in milliseconds.               |
| `maxRetries`                    | `3`                           | Retries for transient 5xx / network errors.             |
| `limit` (retriever) / `defaultMaxSources` (tool) | `5`        | Max chunks returned per query (1–50).                   |
| `mode` / `defaultMode`          | `'standard'`                  | `fast` / `standard` / `deep`.                           |
| `domainFilter` (retriever) / `domain` (tool) | `null`           | Restrict to one taxonomy domain.                        |

## Examples

### 1. Simple Q&A with citations

```ts
import { QuelvioRetriever } from '@quelvio/langchain';

const retriever = new QuelvioRetriever(); // reads QUELVIO_API_KEY

const docs = await retriever.invoke('how do we handle on-call escalations?');
for (const d of docs) {
  const title = d.metadata.title;
  const url = d.metadata.source_url ?? '(no link)';
  const authority = d.metadata.authority_score ?? '—';
  console.log(`[authority ${authority}] ${title}`);
  console.log(`  ${url}`);
  console.log(`  ${d.pageContent.slice(0, 160)}\n`);
}
```

### 2. Agent that combines Quelvio + web search

```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { z } from 'zod';
import { QuelvioTool } from '@quelvio/langchain';

const calculator = new DynamicStructuredTool({
  name: 'calculator',
  description: 'Evaluate a simple arithmetic expression. Supports + - * / ( ).',
  schema: z.object({ expression: z.string() }),
  func: async ({ expression }) => {
    // Tiny safe evaluator — only digits, whitespace, and arithmetic operators.
    if (!/^[\d+\-*/().\s]+$/.test(expression)) throw new Error('unsupported chars');
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression});`)();
    return String(result);
  },
});

const tools = [new QuelvioTool(), new TavilySearchResults({ maxResults: 3 }), calculator];

const llm = new ChatAnthropic({ model: 'claude-sonnet-4-6' });
const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'Use quelvio_query for anything about THIS company. Use the web search for ' +
      'external/public information. Use the calculator for math. Always cite ' +
      'Quelvio sources by URL.',
  ],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

const agent = await createToolCallingAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools, verbose: true });

const { output } = await executor.invoke({
  input:
    'How does our refund window compare to the industry standard, and how many ' +
    'refunds did we process last quarter?',
});
console.log(output);
```

### 3. RAG chain with Quelvio as the retriever

```ts
import { ChatAnthropic } from '@langchain/anthropic';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import type { Document } from '@langchain/core/documents';
import { QuelvioRetriever } from '@quelvio/langchain';

const retriever = new QuelvioRetriever({ mode: 'deep', limit: 8 });

const prompt = ChatPromptTemplate.fromTemplate(
  "Answer the user's question using ONLY the context below. After your " +
    'answer, list the source URLs you used.\n\n' +
    'Context:\n{context}\n\n' +
    'Question: {question}',
);

const formatDocs = (docs: Document[]): string =>
  docs
    .map((d) => `[${d.metadata.title} — ${d.metadata.source_url ?? '(no url)'}]\n${d.pageContent}`)
    .join('\n\n');

const llm = new ChatAnthropic({ model: 'claude-sonnet-4-6' });

const chain = RunnableSequence.from([
  {
    context: async (input: string) => formatDocs(await retriever.invoke(input)),
    question: new RunnablePassthrough(),
  },
  prompt,
  llm,
  new StringOutputParser(),
]);

console.log(await chain.invoke('Summarize our Q4 OKR review decisions.'));
```

## Related packages

- **[`@quelvio/cli`](https://github.com/Quelvio/quelvio-cli)** — query
  the brain from your terminal, scriptable in CI, JSON output.
- **[`quelvio-langchain` (Python)](https://pypi.org/project/quelvio-langchain/)** —
  the Python sibling of this package. Identical surface area, same API.
- **[`@quelvio/mcp-server`](https://github.com/Quelvio/quelvio-mcp-server)** —
  use Quelvio from any Model Context Protocol client (Claude Desktop,
  Cursor, VS Code, etc.).
- **[Quelvio docs](https://docs.quelvio.com)** — concepts, API reference,
  source connectors.

## Development

```bash
git clone https://github.com/Quelvio/quelvio-langchain-js
cd quelvio-langchain-js
pnpm install
pnpm test
```

Build, type-check, lint:

```bash
pnpm build
pnpm typecheck
pnpm lint
```

## Contributing

Issues and pull requests welcome at
<https://github.com/Quelvio/quelvio-langchain-js>. Please run `pnpm
lint`, `pnpm typecheck`, and `pnpm test` before opening a PR.

## License

MIT — see [LICENSE](./LICENSE).
