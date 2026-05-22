/**
 * One-shot helpers for getting a synthesized answer from Quelvio.
 *
 * `synthesizeAnswer` is the lowest-ceremony entry point: useful when you
 * want a single async function call that returns a final answer +
 * citations, without wiring up a retriever or an agent.
 */

import { QuelvioClient, type QuelvioClientOptions } from './client.js';
import type { ChunkResult, QueryResponse } from './types.js';

export interface SynthesizedAnswer {
  /** Synthesized natural-language answer, or `null` for `mode: 'fast'`. */
  answer: string | null;
  /** Chunks that informed the answer, in rank order. */
  sources: ChunkResult[];
  /** Server-side query identifier — pass to `QuelvioClient.getSourceDetail`. */
  queryId: string;
}

export interface SynthesizeAnswerOptions extends QuelvioClientOptions {
  mode?: string;
  maxSources?: number;
  domainFilter?: string | null;
  client?: QuelvioClient;
}

function fromResponse(response: QueryResponse): SynthesizedAnswer {
  return {
    answer: response.synthesis ?? null,
    sources: [...response.results],
    queryId: response.query_id,
  };
}

/**
 * Ask Quelvio a question and return a synthesized answer plus citations.
 *
 * @example
 * ```ts
 * const { answer, sources } = await synthesizeAnswer("What's our refund policy?");
 * console.log(answer);
 * for (const s of sources) console.log(`  • ${s.title} → ${s.source_url}`);
 * ```
 */
export async function synthesizeAnswer(
  question: string,
  options: SynthesizeAnswerOptions = {},
): Promise<SynthesizedAnswer> {
  if (!question || !question.trim()) {
    throw new TypeError('question must be a non-empty string');
  }

  let client = options.client;
  if (!client) {
    const clientOpts: QuelvioClientOptions = { source: 'langchain-js-synthesis' };
    if (options.apiKey !== undefined) clientOpts.apiKey = options.apiKey;
    if (options.baseUrl !== undefined) clientOpts.baseUrl = options.baseUrl;
    if (options.timeoutMs !== undefined) clientOpts.timeoutMs = options.timeoutMs;
    if (options.maxRetries !== undefined) clientOpts.maxRetries = options.maxRetries;
    if (options.fetch !== undefined) clientOpts.fetch = options.fetch;
    client = new QuelvioClient(clientOpts);
  }

  const response = await client.query({
    query: question,
    limit: options.maxSources ?? 5,
    mode: options.mode ?? 'standard',
    domainFilter: options.domainFilter ?? null,
  });
  return fromResponse(response);
}

/**
 * Async alias of {@link synthesizeAnswer} — preserved for symmetry with
 * the Python sibling package, which exposes both `synthesize_answer` and
 * `asynthesize_answer`. In JavaScript, fetch is async-only, so both
 * names point at the same implementation.
 */
export const asynthesizeAnswer = synthesizeAnswer;
