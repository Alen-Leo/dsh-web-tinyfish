/**
 * Fetch-provider tests: target-URL preflight, byte capping, request shaping,
 * per-URL failure mapping, and error mapping — against a stubbed fetch.
 * @module dsh-web-tinyfish/tests/fetch
 */

import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { WebError } from '@deepseek-ai/dsh-web'
import { TinyFishFetchProvider, capTextBytes, mapTinyFishFetchResponse } from '../src/fetch.ts'
import { validateTargetUrl } from '../src/target-url.ts'
import type { ApiKeySource, ResolvedFetchOptions } from '../src/types.ts'
import { jsonResponse, stubFetch } from './helpers.ts'

function keySource(value: string | undefined): ApiKeySource {
  return {
    refName: 'TINYFISH_API_KEY',
    resolve: async () => value,
    hasSyncSource: () => value !== undefined,
  }
}

function fetchOptions(overrides: Partial<ResolvedFetchOptions> = {}): () => ResolvedFetchOptions {
  return () => ({
    baseURL: 'https://api.fetch.tinyfish.test',
    requestTimeoutMs: 5000,
    format: 'markdown',
    maxTextBytes: 64 * 1024,
    key: keySource('test-key'),
    ...overrides,
  })
}

describe('validateTargetUrl', () => {
  it('admits a public HTTP(S) URL', () => {
    strictEqual(validateTargetUrl('https://example.com/page?a=1').hostname, 'example.com')
  })
  const cases: [string, string, string][] = [
    ['ftp://example.com/', 'WEB_INVALID_URL', 'scheme'],
    ['https://user:pass@example.com/', 'WEB_BLOCKED_URL', 'credentials'],
    ['not a url', 'WEB_INVALID_URL', 'invalid URL'],
    ['https://192.168.0.1/admin', 'WEB_BLOCKED_URL', 'forbidden'],
  ]
  for (const [input, code, fragment] of cases) {
    it(`refuses ${input}`, () => {
      try {
        validateTargetUrl(input)
        throw new Error('expected validateTargetUrl to throw')
      } catch (error) {
        if (!(error instanceof WebError)) throw error
        strictEqual(error.code, code)
        if (!error.message.includes(fragment)) throw new Error(`message misses "${fragment}": ${error.message}`)
      }
    })
  }
  it('refuses an over-long URL', () => {
    try {
      validateTargetUrl(`https://example.com/${'a'.repeat(2100)}`)
      throw new Error('expected validateTargetUrl to throw')
    } catch (error) {
      if (!(error instanceof WebError)) throw error
      strictEqual(error.code, 'WEB_INVALID_URL')
    }
  })
})

describe('capTextBytes', () => {
  it('keeps text within the budget untouched', () => {
    const kept = capTextBytes('hello', 100)
    deepStrictEqual(kept, { content: 'hello', truncated: false })
  })
  it('cuts ASCII at the byte budget', () => {
    const cut = capTextBytes('abcdef', 3)
    deepStrictEqual(cut, { content: 'abc', truncated: true })
  })
  it('never splits a multibyte character', () => {
    // 汉 encodes to 3 bytes; a 4-byte budget keeps exactly one character.
    const cut = capTextBytes('汉汉汉', 4)
    deepStrictEqual(cut, { content: '汉', truncated: true })
  })
})

describe('TinyFishFetchProvider', () => {
  it('posts one URL and maps a markdown result', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({
      results: [{
        url: 'https://example.com/page', final_url: 'https://example.com/page/',
        title: 'T', text: '# Hi\n\nbody',
      }],
      errors: [],
    }))
    try {
      const result = await new TinyFishFetchProvider(fetchOptions()).fetch({ url: 'https://example.com/page' })
      strictEqual(calls.length, 1)
      const sent = new URL(calls[0]!.url)
      strictEqual(sent.host, 'api.fetch.tinyfish.test')
      strictEqual(calls[0]!.init.method, 'POST')
      strictEqual(calls[0]!.init.redirect, 'error')
      strictEqual(calls[0]!.headers['x-api-key'], 'test-key')
      strictEqual(calls[0]!.headers['content-type'], 'application/json')
      const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>
      deepStrictEqual(body.urls, ['https://example.com/page'])
      strictEqual(body.format, 'markdown')
      deepStrictEqual(result, {
        url: 'https://example.com/page/',
        statusCode: 200,
        body: { kind: 'text', content: '# Hi\n\nbody' },
        truncated: false,
      })
    } finally { restore() }
  })

  it('maps an html-format result to an html body and forwards tuning', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({
      results: [{ url: 'https://example.com/page', text: '<h1>x</h1>' }],
      errors: [],
    }))
    try {
      const result = await new TinyFishFetchProvider(fetchOptions({
        format: 'html', ttlSeconds: 3600, perUrlTimeoutMs: 45000,
        includeSelectors: ['main, article'], excludeSelectors: ['nav'],
      })).fetch({ url: 'https://example.com/page' })
      const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>
      strictEqual(body.format, 'html')
      strictEqual(body.ttl, 3600)
      strictEqual(body.per_url_timeout_ms, 45000)
      deepStrictEqual(body.include_selectors, ['main, article'])
      deepStrictEqual(body.exclude_selectors, ['nav'])
      strictEqual(result.body.kind, 'html')
    } finally { restore() }
  })

  it('caps oversized text at the byte budget without splitting a character', async () => {
    const text = `${'汉'.repeat(100)}`
    const { restore } = stubFetch(() => jsonResponse({ results: [{ url: 'https://example.com/page', text }], errors: [] }))
    try {
      const result = await new TinyFishFetchProvider(fetchOptions({ maxTextBytes: 9 })).fetch({ url: 'https://example.com/page' })
      strictEqual(result.truncated, true)
      strictEqual(result.body.content, '汉汉汉')
    } finally { restore() }
  })

  it('maps a per-URL failure to a provider error carrying the code', async () => {
    const { restore } = stubFetch(() => jsonResponse({
      results: [],
      errors: [{ url: 'https://example.com/page', error: 'bot_blocked' }],
    }))
    try {
      await rejects(
        new TinyFishFetchProvider(fetchOptions()).fetch({ url: 'https://example.com/page' }),
        (error: unknown) => error instanceof WebError
          && error.code === 'WEB_PROVIDER_ERROR'
          && error.message.includes('bot_blocked')
          && error.message.includes('https://example.com/page'),
      )
    } finally { restore() }
  })

  it('surfaces selector retry hints from a selector_not_matched failure', () => {
    try {
      mapTinyFishFetchResponse({
        results: [],
        errors: [{
          url: 'https://example.com/page', error: 'selector_not_matched',
          unmatched_selectors: ['#price'], candidate_selectors: ['[id="price"]'],
        }],
      }, 'https://example.com/page', 'markdown', 1024)
      throw new Error('expected mapTinyFishFetchResponse to throw')
    } catch (error) {
      if (!(error instanceof WebError)) throw error
      if (!error.message.includes('#price') || !error.message.includes('[id="price"]')) {
        throw new Error(`message misses selector hints: ${error.message}`)
      }
    }
  })

  it('fails when the envelope carries neither a result nor an error', () => {
    try {
      mapTinyFishFetchResponse({ results: [], errors: [] }, 'https://example.com/page', 'markdown', 1024)
      throw new Error('expected mapTinyFishFetchResponse to throw')
    } catch (error) {
      if (!(error instanceof WebError)) throw error
      if (!error.message.includes('no content')) throw new Error(error.message)
    }
  })

  it('maps a 401 envelope to a credential failure', async () => {
    const { restore } = stubFetch(() => jsonResponse({ error: { code: 'INVALID_API_KEY' } }, 401))
    try {
      await rejects(
        new TinyFishFetchProvider(fetchOptions()).fetch({ url: 'https://example.com/page' }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING',
      )
    } finally { restore() }
  })

  it('fails before any request when no layer holds a key', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({}))
    try {
      const provider = new TinyFishFetchProvider(fetchOptions({ key: keySource(undefined) }))
      strictEqual(provider.available(), false)
      await rejects(
        provider.fetch({ url: 'https://example.com/page' }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING',
      )
      strictEqual(calls.length, 0)
    } finally { restore() }
  })

  it('preflights the target before contacting TinyFish', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({}))
    try {
      await rejects(
        new TinyFishFetchProvider(fetchOptions()).fetch({ url: 'https://user:pass@example.com/' }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_BLOCKED_URL',
      )
      await rejects(
        new TinyFishFetchProvider(fetchOptions()).fetch({ url: 'http://10.0.0.1/internal' }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_BLOCKED_URL',
      )
      strictEqual(calls.length, 0)
    } finally { restore() }
  })

  it('admits a configured private-network endpoint (local mocks, LAN gateways)', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({
      results: [{ url: 'https://example.com/page', text: 'content' }],
    }))
    try {
      const result = await new TinyFishFetchProvider(fetchOptions({ baseURL: 'http://192.168.1.5/' })).fetch({ url: 'https://example.com/page' })
      strictEqual(calls.length, 1)
      strictEqual(new URL(calls[0]!.url).host, '192.168.1.5')
      strictEqual(result.body.kind, 'text')
    } finally { restore() }
  })
})
