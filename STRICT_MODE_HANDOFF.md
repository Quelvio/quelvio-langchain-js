# Strict-Mode Sentinel Handoff (FE-13)

> **Docs PR.** The full reference implementation lives in
> [`Quelvio/quelvio-mcp-server`](https://github.com/Quelvio/quelvio-mcp-server/blob/main/STRICT_MODE_HANDOFF.md).
> This file copies the contract so an engineer touching
> `quelvio-langchain-js` can mirror the pattern locally without
> context-switching across repos.

## What backend PR #643 ships

Backend PR #643 emits two response headers globally on the search /
retrieval endpoints:

| Header | Value | Meaning |
| --- | --- | --- |
| `X-Quelvio-API-Version` | `2.0` | API contract version. Informational. |
| `X-Quelvio-Sentinel-Set` | `closed-v1` | Tenant is on the strict (closed) permission model. Some results may be filtered. |

When the sentinel header is present, SDK consumers may see fewer search
results than expected — the strict model only returns chunks for which
the calling employee has explicit access.

## Contract

When this retriever observes `X-Quelvio-Sentinel-Set` on any response:

1. Log a warning **once per process** (idempotent). Warning text:
   ```
   Quelvio v2 strict permission mode is active for your tenant.
   Some search results may be filtered to enforce explicit permissions.
   Learn more: https://docs.quelvio.com/permission-model
   ```
2. Surface via `console.warn` (LangChain.js doesn't ship a logger
   facade; `console.warn` is the convention used by the upstream
   integrations). Never throw.
3. Prefix with the structured event token
   `quelvio_sentinel_set_detected sentinel=<value>`.

## Where to wire it in `quelvio-langchain-js`

The HTTP call site is `src/client.ts:307`, inside the `#request` method.
This SDK mirrors the structure of `quelvio-vercel-ai-sdk` (both use a
`#fetch` field on the client), so the implementation transfers
near-verbatim.

Suggested layout:

- `src/sentinel.ts` — module-scoped `Set<string>` of observed values +
  `noteSentinelHeader(res: Response)` helper.
- Single call site inside `#request`.
- Vitest spec under `tests/` covering: absent, present once, repeated
  same value, two distinct values.

## Implementation crib

See [`Quelvio/quelvio-mcp-server` `src/sentinel.ts`](https://github.com/Quelvio/quelvio-mcp-server/blob/main/src/sentinel.ts)
and [`src/sentinel.test.ts`](https://github.com/Quelvio/quelvio-mcp-server/blob/main/src/sentinel.test.ts).

## Owner

FE-13 / antonis@rolle.io. Backend counterpart: PR #643 on
`Quelvio/quelvio-platform`.
