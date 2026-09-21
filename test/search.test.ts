/**
 * Search-provider tests: response normalization, request shaping, credential
 * handling, and error mapping — all against a stubbed fetch.
 * @module dsh-web-tinyfish/tests/search
 */

import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { WebError } from '@deepseek-ai/dsh-web'
import { TinyFishSearchProvider, mapTinyFishSearchResponse } from '../src/search.ts'
import type { ApiKeySource, ResolvedSearchOptions, SearchFilters } from '../src/types.ts'
import { jsonResponse, stubFetch, type RecordedFetch } from './helpers.ts'

function keySource(value: string | undefined): ApiKeySource {
  return {
    refName: 'TINYFISH_API_KEY',
    resolve: async () => value,
    hasSyncSource: () => value !== undefined,
  }
}

function searchOptions(overrides: { filters?: SearchFilters, key?: ApiKeySource, baseURL?: string } = {}): () => ResolvedSearchOptions {
  return () => ({
    baseURL: overrides.baseURL ?? 'https://api.search.tinyfish.test',
    requestTimeoutMs: 5000,
    key: overrides.key ?? keySource('test-key'),
    filters: overrides.filters ?? {},
  })
}

describe('mapTinyFishSearchResponse', () => {
  it('maps a full item and omits null/empty optional fields', () => {
    deepStrictEqual(
      mapTinyFishSearchResponse({
        results: [
          { url: 'https://a.test', title: 'A', snippet: 'first', date: '2026-01-02' },
          { url: 'https://b.test', title: null, snippet: '', date: null },
        ],
      }, undefined),
      {
        sources: [
          { url: 'https://a.test', title: 'A', snippet: 'first', publishedAt: '2026-01-02' },
          { url: 'https://b.test' },
        ],
        truncated: false,
      },
    )
  })
  it('skips items without a URL and deduplicates by URL', () => {
    deepStrictEqual(
      mapTinyFishSearchResponse({
        results: [
          { title: 'no url' },
          { url: 'https://a.test', snippet: 'one' },
          { url: 'https://a.test', snippet: 'dup' },
          { url: 'https://b.test', snippet: 'two' },
        ],
      }, undefined).sources,
      [{ url: 'https://a.test', snippet: 'one' }, { url: 'https://b.test', snippet: 'two' }],
    )
  })
  it('caps at maxResults and flags the cut', () => {
    const payload = {
      results: [
        { url: 'https://a.test' }, { url: 'https://b.test' }, { url: 'https://c.test' },
      ],
    }
    const capped = mapTinyFishSearchResponse(payload, 2)
    strictEqual(capped.sources.length, 2)
    strictEqual(capped.truncated, true)
    const exact = mapTinyFishSearchResponse(payload, 3)
    strictEqual(exact.truncated, false)
  })
  it('tolerates a missing results array', () => {
    deepStrictEqual(mapTinyFishSearchResponse({}, undefined), { sources: [], truncated: false })
  })
})

describe('TinyFishSearchProvider', () => {
  it('sends the query plus every configured filter with refused redirects', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({
      results: [{ url: 'https://a.test', title: 'A', snippet: 's', date: '2026-01-02' }],
    }))
    try {
      const provider = new TinyFishSearchProvider(searchOptions({
        filters: {
          location: 'US', language: 'en',
          includeDomains: ['github.com', 'arxiv.org'], excludeDomains: ['pinterest.com'],
          recencyMinutes: 1440, domainType: 'news',
        },
      }))
      const result = await provider.search({ query: 'web agents', maxResults: 5 })
      strictEqual(calls.length, 1)
      const sent = new URL(calls[0]!.url)
      strictEqual(sent.host, 'api.search.tinyfish.test')
      strictEqual(sent.searchParams.get('query'), 'web agents')
      strictEqual(sent.searchParams.get('location'), 'US')
      strictEqual(sent.searchParams.get('language'), 'en')
      strictEqual(sent.searchParams.get('include_domains'), 'github.com,arxiv.org')
      strictEqual(sent.searchParams.get('exclude_domains'), 'pinterest.com')
      strictEqual(sent.searchParams.get('recency_minutes'), '1440')
      strictEqual(sent.searchParams.get('domain_type'), 'news')
      strictEqual(calls[0]!.init.redirect, 'error')
      strictEqual(calls[0]!.headers['x-api-key'], 'test-key')
      strictEqual(calls[0]!.headers.accept, 'application/json')
      deepStrictEqual(result.sources, [{ url: 'https://a.test', title: 'A', snippet: 's', publishedAt: '2026-01-02' }])
      strictEqual(result.truncated, false)
    } finally { restore() }
  })

  it('sends only the query when no filter is configured', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    try {
      await new TinyFishSearchProvider(searchOptions()).search({ query: 'q' })
      strictEqual(new URL(calls[0]!.url).searchParams.size, 1)
    } finally { restore() }
  })

  it('trims a whitespace-padded resolved key before sending', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    try {
      await new TinyFishSearchProvider(searchOptions({ key: keySource('  test-key \n') })).search({ query: 'q' })
      strictEqual(calls[0]!.headers['x-api-key'], 'test-key')
    } finally { restore() }
  })

  it('forwards date bounds and publication-year bounds', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    try {
      const provider = new TinyFishSearchProvider(searchOptions({
        filters: { afterDate: '2026-06-01', beforeDate: '2026-06-18', domainType: 'research_paper', pubYearMin: 2020, pubYearMax: 2026 },
      }))
      await provider.search({ query: 'papers' })
      const params = new URL(calls[0]!.url).searchParams
      strictEqual(params.get('after_date'), '2026-06-01')
      strictEqual(params.get('before_date'), '2026-06-18')
      strictEqual(params.get('pub_year_min'), '2020')
      strictEqual(params.get('pub_year_max'), '2026')
    } finally { restore() }
  })

  it('maps a 401 envelope to a credential failure carrying the TinyFish code', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({ error: { code: 'INVALID_API_KEY', message: 'Invalid or expired API key' } }, 401))
    try {
      await rejects(
        new TinyFishSearchProvider(searchOptions()).search({ query: 'q' }),
        (error: unknown) => error instanceof WebError
          && error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING'
          && error.message.includes('INVALID_API_KEY'),
      )
      strictEqual(calls.length, 1)
    } finally { restore() }
  })

  it('maps 429 and 400 envelopes to provider failures carrying the TinyFish code', async () => {
    for (const [status, body, expected] of [
      [429, { error: { code: 'RATE_LIMITED', message: 'too many' } }, 'rate limited'],
      [400, { error: { code: 'INVALID_INPUT', message: 'Field "query"' } }, 'INVALID_INPUT'],
    ] as const) {
      const { restore } = stubFetch(() => jsonResponse(body, status))
      try {
        await rejects(
          new TinyFishSearchProvider(searchOptions()).search({ query: 'q' }),
          (error: unknown) => error instanceof WebError && error.code === 'WEB_PROVIDER_ERROR' && error.message.includes(expected),
        )
      } finally { restore() }
    }
  })

  it('fails before any request when no layer holds a key', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({}))
    try {
      const provider = new TinyFishSearchProvider(searchOptions({ key: keySource(undefined) }))
      strictEqual(provider.available(), false)
      await rejects(
        provider.search({ query: 'q' }),
        (error: unknown) => error instanceof WebError
          && error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING'
          && error.message.includes('TINYFISH_API_KEY'),
      )
      strictEqual(calls.length, 0)
    } finally { restore() }
  })

  it('admits a configured private-network endpoint (local mocks, LAN gateways)', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    try {
      await new TinyFishSearchProvider(searchOptions({ baseURL: 'http://127.0.0.1:9/' })).search({ query: 'q' })
      strictEqual(calls.length, 1)
      strictEqual(new URL(calls[0]!.url).host, '127.0.0.1:9')
    } finally { restore() }
  })

  it('reports an unprocessable success body as a provider failure', async () => {
    const { restore } = stubFetch(() => new Response('not json', { status: 200 }))
    try {
      await rejects(
        new TinyFishSearchProvider(searchOptions()).search({ query: 'q' }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_PROVIDER_ERROR' && error.message.includes('unprocessable'),
      )
    } finally { restore() }
  })

  it('is available with a literal key and any parseable http(s) endpoint', () => {
    strictEqual(new TinyFishSearchProvider(searchOptions()).available(), true)
    strictEqual(new TinyFishSearchProvider(searchOptions({ baseURL: 'https://localhost/' })).available(), true)
    strictEqual(new TinyFishSearchProvider(searchOptions({ baseURL: 'ftp://example.com/' })).available(), false)
  })
})
