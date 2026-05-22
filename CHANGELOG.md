# Changelog

All notable changes to `@quelvio/langchain` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-22

Initial release. JavaScript/TypeScript sibling of the Python
[`quelvio-langchain`](https://pypi.org/project/quelvio-langchain/) package.

### Added

- `QuelvioClient` — async HTTP client wrapping the Quelvio enterprise API
  (`POST /v1/enterprise/query`, `GET /v1/enterprise/domains`,
  `GET /v1/enterprise/sources/{query_id}`).
- `QuelvioRetriever` — LangChain.js retriever extending `BaseRetriever`.
  Returns `Document`s with `chunk_id`, `source_url`, `authority_score`,
  `taxonomy_domain`, and author metadata.
- `QuelvioTool` — LangChain.js tool extending `StructuredTool`. Schema
  accepts `question` (required) plus optional `mode`, `max_sources`,
  `domain`. Output is a synthesized answer + citation list.
- `synthesizeAnswer()` — one-shot helper that returns a final answer plus
  cited sources without wiring a retriever or agent.
- Typed exceptions: `QuelvioError`, `QuelvioAuthError`, `QuelvioBadRequestError`,
  `QuelvioNotFoundError`, `QuelvioRateLimitError`, `QuelvioServerError`,
  `QuelvioTimeoutError`, `QuelvioNetworkError`.
- API key resolution from the `apiKey` constructor argument or the
  `QUELVIO_API_KEY` environment variable. The token is held privately
  and never appears in `toString()`, `JSON.stringify()`, or any error
  message.
- Configurable base URL via `baseUrl` or `QUELVIO_API_BASE`. Trailing
  slashes are stripped.
- Exponential backoff with jitter for transient 5xx errors and network
  timeouts. Configurable `maxRetries` (default 3).
- Dual ESM + CommonJS distribution. Compatible with `@langchain/core` 0.3.x.

[0.1.0]: https://github.com/Quelvio/quelvio-langchain-js/releases/tag/v0.1.0
