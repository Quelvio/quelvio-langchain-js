/**
 * `@quelvio/langchain` — Quelvio for LangChain.js.
 *
 * Public API barrel. Mirrors the Python sibling package's surface area
 * (https://pypi.org/project/quelvio-langchain/), adapted to TypeScript /
 * JavaScript idioms.
 */

export {
  buildQueryBody,
  boundLimit,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  normalizeMode,
  QuelvioClient,
  type QuelvioClientOptions,
  type QuelvioSource,
  type QueryOptions,
} from './client.js';
export {
  QuelvioAuthError,
  QuelvioBadRequestError,
  QuelvioError,
  QuelvioNetworkError,
  QuelvioNotFoundError,
  QuelvioRateLimitError,
  QuelvioServerError,
  QuelvioTimeoutError,
} from './exceptions.js';
export { QuelvioRetriever, type QuelvioRetrieverOptions } from './retriever.js';
export {
  asynthesizeAnswer,
  type SynthesizeAnswerOptions,
  type SynthesizedAnswer,
  synthesizeAnswer,
} from './synthesis.js';
export {
  QuelvioTool,
  type QuelvioToolInput,
  QuelvioToolInputSchema,
  type QuelvioToolOptions,
} from './tool.js';
export {
  type ChunkResult,
  ChunkResultSchema,
  type DomainCoverage,
  DomainCoverageSchema,
  type DomainsListResponse,
  DomainsListResponseSchema,
  type QueryMode,
  QueryModeSchema,
  type QueryRequest,
  QueryRequestSchema,
  type QueryResponse,
  QueryResponseSchema,
  type SourceChunk,
  SourceChunkSchema,
  type SourceDetailResponse,
  SourceDetailResponseSchema,
} from './types.js';
export { VERSION } from './version.js';
