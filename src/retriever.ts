/**
 * `QuelvioRetriever` — a LangChain.js {@link BaseRetriever} backed by
 * Quelvio's enterprise knowledge API.
 *
 * Drop this into any LangChain RAG chain. Each call to `invoke()` makes
 * exactly one HTTP request to `POST /v1/enterprise/query` and converts
 * the returned chunks to LangChain `Document` objects, preserving per-
 * chunk provenance (source URL, authority score, taxonomy domain,
 * chunk id) in the `metadata` dict.
 */

import type { CallbackManagerForRetrieverRun } from '@langchain/core/callbacks/manager';
import { Document } from '@langchain/core/documents';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';

import { QuelvioClient, type QuelvioClientOptions } from './client.js';
import type { ChunkResult, QueryResponse } from './types.js';

export interface QuelvioRetrieverOptions extends BaseRetrieverInput, QuelvioClientOptions {
  /** Maximum number of chunks to retrieve (1 to 50). Defaults to 5. */
  limit?: number;
  /** `fast` | `standard` (default) | `deep`. */
  mode?: string;
  /** Restrict retrieval to a single taxonomy domain. */
  domainFilter?: string | null;
  /** Inject a pre-built {@link QuelvioClient} for connection reuse. */
  client?: QuelvioClient;
}

function chunkToDocument(chunk: ChunkResult): Document {
  const metadata: Record<string, unknown> = {
    chunk_id: chunk.chunk_id,
    content_piece_id: chunk.content_piece_id,
    title: chunk.title,
    score: chunk.score,
    rank: chunk.rank,
  };
  if (chunk.authority_score !== undefined && chunk.authority_score !== null) {
    metadata.authority_score = chunk.authority_score;
  }
  if (chunk.taxonomy_domain) metadata.taxonomy_domain = chunk.taxonomy_domain;
  if (chunk.source_url) {
    metadata.source_url = chunk.source_url;
    metadata.source = chunk.source_url;
  }
  if (chunk.author_name) metadata.author_name = chunk.author_name;
  if (chunk.author_email) metadata.author_email = chunk.author_email;
  if (chunk.department) metadata.department = chunk.department;
  return new Document({ pageContent: chunk.excerpt, metadata });
}

function responseToDocuments(response: QueryResponse): Document[] {
  const docs = response.results.map(chunkToDocument);
  if (docs.length > 0) {
    // Stash the query_id on the first document so callers can re-resolve
    // provenance later via `QuelvioClient.getSourceDetail`.
    docs[0]!.metadata.query_id = response.query_id;
  }
  return docs;
}

export class QuelvioRetriever extends BaseRetriever {
  static override lc_name(): string {
    return 'QuelvioRetriever';
  }

  override lc_namespace = ['quelvio', 'retrievers'];

  readonly limit: number;
  readonly mode: string;
  readonly domainFilter: string | null;

  readonly #client: QuelvioClient;

  constructor(options: QuelvioRetrieverOptions = {}) {
    super(options);
    this.limit = options.limit ?? 5;
    this.mode = options.mode ?? 'standard';
    this.domainFilter = options.domainFilter ?? null;

    if (options.client) {
      this.#client = options.client;
    } else {
      const clientOpts: QuelvioClientOptions = { source: 'langchain-js-retriever' };
      if (options.apiKey !== undefined) clientOpts.apiKey = options.apiKey;
      if (options.baseUrl !== undefined) clientOpts.baseUrl = options.baseUrl;
      if (options.timeoutMs !== undefined) clientOpts.timeoutMs = options.timeoutMs;
      if (options.maxRetries !== undefined) clientOpts.maxRetries = options.maxRetries;
      if (options.fetch !== undefined) clientOpts.fetch = options.fetch;
      this.#client = new QuelvioClient(clientOpts);
    }
  }

  override toString(): string {
    return `QuelvioRetriever(limit=${this.limit}, mode=${this.mode}, domainFilter=${
      this.domainFilter ?? 'null'
    })`;
  }

  override async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun,
  ): Promise<Document[]> {
    if (!query || !query.trim()) {
      throw new TypeError('query must be a non-empty string');
    }
    const response = await this.#client.query({
      query,
      limit: this.limit,
      mode: this.mode,
      domainFilter: this.domainFilter,
    });
    return responseToDocuments(response);
  }
}
