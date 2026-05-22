/**
 * `QuelvioTool` — a LangChain.js {@link StructuredTool} for agents.
 *
 * Use this when you want an LLM agent to *decide* whether to query the
 * company's knowledge brain. The tool returns a synthesized natural-
 * language answer plus a list of cited sources (titles + URLs), which
 * the agent can quote back to the user.
 */

import type { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { QuelvioClient, type QuelvioClientOptions } from './client.js';
import type { QueryResponse } from './types.js';

const DEFAULT_DESCRIPTION =
  "Search the organization's connected knowledge brain (Google Drive, " +
  'SharePoint, Confluence, Slack, Notion, and other internal sources) ' +
  'for an authoritative, cited answer. Use this whenever the user asks ' +
  'about internal company information — policies, processes, decisions, ' +
  'people, products, projects, or anything else that lives in the ' +
  "company's systems rather than on the public internet. The answer is " +
  "scoped to the running user's individual access permissions, so " +
  'results never include documents they cannot already see. Returns a ' +
  'synthesized answer plus a list of cited sources (titles + URLs).';

export const QuelvioToolInputSchema = z.object({
  question: z
    .string()
    .min(1)
    .describe(
      "The natural-language question to ask the company's knowledge brain. " +
        'Phrase it as the user would ask it — do not pre-process or keyword-extract.',
    ),
  mode: z
    .enum(['fast', 'standard', 'deep'])
    .optional()
    .describe(
      "Synthesis depth: 'fast' for low-latency retrieval-only, 'standard' " +
        "(default) for retrieval + synthesis, 'deep' for multi-pass " +
        'reasoning over a wider window.',
    ),
  max_sources: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of source chunks to retrieve (1 to 50, default 5).'),
  domain: z
    .string()
    .optional()
    .describe(
      "Optional taxonomy domain to restrict retrieval to (e.g. 'engineering', 'legal', 'people-ops').",
    ),
});

export type QuelvioToolInput = z.infer<typeof QuelvioToolInputSchema>;

export interface QuelvioToolOptions extends QuelvioClientOptions {
  /** Override the tool name (default: `quelvio_query`). */
  name?: string;
  /** Override the LLM-facing description. */
  description?: string;
  /** Default synthesis mode used when the agent omits `mode`. */
  defaultMode?: string;
  /** Default chunk limit used when the agent omits `max_sources`. */
  defaultMaxSources?: number;
  /** Inject a pre-built {@link QuelvioClient} for connection reuse. */
  client?: QuelvioClient;
}

function formatResponse(response: QueryResponse): string {
  const lines: string[] = [];
  if (response.synthesis) {
    lines.push(response.synthesis.trim());
    lines.push('');
  }
  if (response.results.length > 0) {
    lines.push('Sources:');
    response.results.forEach((chunk, idx) => {
      const label = chunk.title || chunk.chunk_id;
      if (chunk.source_url) {
        lines.push(`  [${idx + 1}] ${label} — ${chunk.source_url}`);
      } else {
        lines.push(`  [${idx + 1}] ${label}`);
      }
    });
  }
  if (lines.length === 0) {
    return "No matching content was found in the company's knowledge brain.";
  }
  return lines.join('\n').trimEnd();
}

export class QuelvioTool extends StructuredTool<typeof QuelvioToolInputSchema> {
  static override lc_name(): string {
    return 'QuelvioTool';
  }

  override get lc_namespace(): string[] {
    return ['quelvio', 'tools'];
  }

  override name = 'quelvio_query';
  override description = DEFAULT_DESCRIPTION;
  override schema = QuelvioToolInputSchema;

  readonly defaultMode: string;
  readonly defaultMaxSources: number;

  readonly #client: QuelvioClient;

  constructor(options: QuelvioToolOptions = {}) {
    super();
    if (options.name) this.name = options.name;
    if (options.description) this.description = options.description;
    this.defaultMode = options.defaultMode ?? 'standard';
    this.defaultMaxSources = options.defaultMaxSources ?? 5;

    if (options.client) {
      this.#client = options.client;
    } else {
      const clientOpts: QuelvioClientOptions = { source: 'langchain-js-tool' };
      if (options.apiKey !== undefined) clientOpts.apiKey = options.apiKey;
      if (options.baseUrl !== undefined) clientOpts.baseUrl = options.baseUrl;
      if (options.timeoutMs !== undefined) clientOpts.timeoutMs = options.timeoutMs;
      if (options.maxRetries !== undefined) clientOpts.maxRetries = options.maxRetries;
      if (options.fetch !== undefined) clientOpts.fetch = options.fetch;
      this.#client = new QuelvioClient(clientOpts);
    }
  }

  override toString(): string {
    return `QuelvioTool(name=${this.name}, defaultMode=${this.defaultMode}, defaultMaxSources=${this.defaultMaxSources})`;
  }

  protected async _call(
    input: QuelvioToolInput,
    _runManager?: CallbackManagerForToolRun,
  ): Promise<string> {
    if (!input.question || !input.question.trim()) {
      throw new TypeError('question must be a non-empty string');
    }
    const response = await this.#client.query({
      query: input.question,
      limit: input.max_sources ?? this.defaultMaxSources,
      mode: input.mode ?? this.defaultMode,
      domainFilter: input.domain ?? null,
    });
    return formatResponse(response);
  }
}
