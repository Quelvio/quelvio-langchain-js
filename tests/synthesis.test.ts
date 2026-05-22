import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { QuelvioClient, asynthesizeAnswer, synthesizeAnswer } from '../src/index.js';
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

describe('synthesizeAnswer', () => {
  it('returns { answer, sources, queryId } from the API response', async () => {
    const { fetch: fetchImpl } = captureRequests(() => jsonResponse(200, queryResponsePayload()));
    const client = new QuelvioClient({
      apiKey: TEST_API_KEY,
      baseUrl: TEST_BASE_URL,
      fetch: fetchImpl,
    });
    const result = await synthesizeAnswer("what's our refund policy?", { client });
    expect(result.answer).toContain('Refunds are processed');
    expect(result.sources).toHaveLength(2);
    expect(result.queryId).toBe('q_01HW9X3J7K8N0V4P2QXYZA');
  });

  it('asynthesizeAnswer mirrors synthesizeAnswer (Python parity alias)', async () => {
    const { fetch: fetchImpl } = captureRequests(() => jsonResponse(200, queryResponsePayload()));
    const client = new QuelvioClient({
      apiKey: TEST_API_KEY,
      baseUrl: TEST_BASE_URL,
      fetch: fetchImpl,
    });
    const result = await asynthesizeAnswer('hi', { client });
    expect(result.queryId).toBe('q_01HW9X3J7K8N0V4P2QXYZA');
    expect(result.sources).toHaveLength(2);
  });
});
