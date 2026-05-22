import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { QuelvioClient, QuelvioTool, QuelvioToolInputSchema } from '../src/index.js';
import {
  TEST_API_KEY,
  TEST_BASE_URL,
  captureRequests,
  jsonResponse,
  queryResponsePayload,
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.QUELVIO_API_KEY;
  delete process.env.QUELVIO_API_BASE;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function makeTool(extra: Partial<ConstructorParameters<typeof QuelvioTool>[0]> = {}) {
  const { fetch: fetchImpl, calls } = captureRequests(() =>
    jsonResponse(200, queryResponsePayload()),
  );
  const client = new QuelvioClient({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetch: fetchImpl,
  });
  const tool = new QuelvioTool({ client, ...extra });
  return { tool, calls };
}

describe('QuelvioTool', () => {
  it('exposes name=quelvio_query, a knowledge-brain description, and the input schema', () => {
    const tool = new QuelvioTool({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL });
    expect(tool.name).toBe('quelvio_query');
    expect(tool.description.toLowerCase()).toContain('knowledge brain');
    expect(tool.schema).toBe(QuelvioToolInputSchema);
  });

  it('schema accepts a bare {question} object with all other fields optional', () => {
    const parsed = QuelvioToolInputSchema.parse({ question: 'hi' });
    expect(parsed.question).toBe('hi');
    expect(parsed.mode).toBeUndefined();
    expect(parsed.max_sources).toBeUndefined();
    expect(parsed.domain).toBeUndefined();
  });

  it('schema rejects max_sources outside the 1–50 bounds', () => {
    expect(() => QuelvioToolInputSchema.parse({ question: 'hi', max_sources: 0 })).toThrow();
    expect(() => QuelvioToolInputSchema.parse({ question: 'hi', max_sources: 51 })).toThrow();
  });

  it('formats the response with a Sources: section and numbered citations', async () => {
    const { tool, calls } = makeTool();
    const result = await tool.invoke({ question: "what's our refund policy?" });

    expect(result).toContain('Refunds are processed within 14 days');
    expect(result).toContain('Sources:');
    expect(result).toContain('[1] Refund Policy v3');
    expect(result).toContain('https://drive.example/refund-policy-v3');
    expect(result).toContain('[2] Customer Success Playbook');

    expect(calls[0]?.url).toBe(`${TEST_BASE_URL}/v1/enterprise/query`);
    const body = calls[0]?.body as Record<string, unknown>;
    expect(body.query).toBe("what's our refund policy?");
  });

  it('passes optional mode / max_sources / domain through to the wire', async () => {
    const { tool, calls } = makeTool();
    await tool.invoke({
      question: 'who owns finance?',
      mode: 'fast',
      max_sources: 3,
      domain: 'finance',
    });
    const body = calls[0]?.body as Record<string, unknown>;
    expect(body.mode).toBe('fast');
    expect(body.limit).toBe(3);
    expect(body.domain_filter).toBe('finance');
  });

  it('rejects empty / whitespace questions before any HTTP request', async () => {
    const { tool, calls } = makeTool();
    await expect(tool.invoke({ question: '   ' as never })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('toString() / JSON.stringify do not leak the api key', () => {
    const tool = new QuelvioTool({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL });
    expect(tool.toString()).not.toContain(TEST_API_KEY);
    expect(JSON.stringify(tool)).not.toContain(TEST_API_KEY);
  });

  it('returns a friendly message when there are no results', async () => {
    const empty = {
      query: '?',
      query_id: 'q_empty',
      result_count: 0,
      risk_flag: {},
      results: [],
      synthesis: null,
    };
    const { fetch: fetchImpl } = captureRequests(() => jsonResponse(200, empty));
    const client = new QuelvioClient({
      apiKey: TEST_API_KEY,
      baseUrl: TEST_BASE_URL,
      fetch: fetchImpl,
    });
    const tool = new QuelvioTool({ client });
    const result = await tool.invoke({ question: 'anything' });
    expect(result).toContain('No matching content');
  });
});
