/**
 * Composition tests on a real cordis `Context`: both providers register on a
 * real `ctx.web`, the settings card installs and switches live, duplicate
 * registration fails loud, and disposal removes the providers.
 * @module dsh-web-tinyfish/tests/apply
 */

import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { Context, Service } from '@deepseek-ai/cordis'
import WebRuntime, { WebError } from '@deepseek-ai/dsh-web'
import * as webTinyfish from '../src/index.ts'
import { jsonResponse, stubFetch } from './helpers.ts'

const stubs: Array<() => void> = []

afterEach(() => {
  while (stubs.length > 0) stubs.pop()!()
})

/** A minimal settings service capturing `installSection` calls. */
class FakeSettingsService extends Service {
  readonly installed: Array<{ namespace: string, hooks: SettingsSectionHooks }> = []

  constructor(ctx: Context) {
    super(ctx, 'settings')
  }

  installSection(_ctx: Context, namespace: string, _schema: unknown, _config: unknown, hooks: SettingsSectionHooks): void {
    this.installed.push({ namespace, hooks })
  }
}

interface SettingsSectionHooks {
  setSource(source: () => unknown): void
  onChange(): void
}

async function boot(config: webTinyfish.WebTinyfishConfig, withSettings = false) {
  const ctx = new Context()
  await ctx.plugin(WebRuntime)
  if (withSettings) await ctx.plugin(FakeSettingsService)
  const fiber = await ctx.plugin(webTinyfish, config)
  return { ctx, fiber }
}

describe('apply', () => {
  it('sends the query to the configured endpoint with the resolved key', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    stubs.push(restore)
    const { ctx } = await boot({ apiKey: 'k', search: { baseURL: 'https://search.example.test' } })
    await ctx.web.search({ query: 'q' })
    strictEqual(new URL(calls[0]!.url).host, 'search.example.test')
    strictEqual(calls[0]!.headers['x-api-key'], 'k')
    strictEqual(calls[0]!.init.redirect, 'error')
  })

  it('routes a seam fetch through the TinyFish provider', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({
      results: [{ url: 'https://example.com/page', text: 'content' }],
      errors: [],
    }))
    stubs.push(restore)
    const { ctx } = await boot({ apiKey: 'k', fetch: { baseURL: 'https://fetch.example.test' } })
    const result = await ctx.web.fetch({ url: 'https://example.com/page' })
    strictEqual(result.body.kind, 'text')
    strictEqual(new URL(calls[0]!.url).host, 'fetch.example.test')
    const body = JSON.parse(String(calls[0]!.init.body)) as { urls: string[] }
    deepStrictEqual(body.urls, ['https://example.com/page'])
  })

  it('resolves the key from the inherited process environment', async () => {
    const previous = process.env.TINYFISH_API_KEY
    process.env.TINYFISH_API_KEY = 'env-key'
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    stubs.push(restore)
    try {
      const { ctx } = await boot({ search: { baseURL: 'https://search.example.test' } })
      await ctx.web.search({ query: 'q' })
      strictEqual(calls[0]!.headers['x-api-key'], 'env-key')
    } finally {
      if (previous === undefined) delete process.env.TINYFISH_API_KEY
      else process.env.TINYFISH_API_KEY = previous
    }
  })

  it('trims padded config values before forwarding them', async () => {
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    stubs.push(restore)
    const { ctx } = await boot({
      apiKey: ' k ',
      search: { baseURL: 'https://search.example.test', location: ' US ', language: ' en ', includeDomains: [' github.com '] },
    })
    await ctx.web.search({ query: 'q' })
    const params = new URL(calls[0]!.url).searchParams
    strictEqual(params.get('location'), 'US')
    strictEqual(params.get('language'), 'en')
    strictEqual(params.get('include_domains'), 'github.com')
    strictEqual(calls[0]!.headers['x-api-key'], 'k')
  })

  it('installs the settings card and applies a committed section live', async () => {
    const { ctx } = await boot({ apiKey: 'k', search: { baseURL: 'https://before.example.test' } }, true)
    const settings = ctx.get('settings') as unknown as FakeSettingsService
    strictEqual(settings.installed.length, 1)
    strictEqual(settings.installed[0]!.namespace, 'web-tinyfish')
    const { calls, restore } = stubFetch(() => jsonResponse({ results: [] }))
    stubs.push(restore)
    settings.installed[0]!.hooks.setSource(() => ({ apiKey: 'k2', search: { baseURL: 'https://after.example.test' } }))
    await ctx.web.search({ query: 'q' })
    strictEqual(new URL(calls[0]!.url).host, 'after.example.test')
    strictEqual(calls[0]!.headers['x-api-key'], 'k2')
  })

  it('rejects a misconfigured section at load', async () => {
    await rejects(boot({ search: { recencyMinutes: 60, afterDate: '2026-06-01' } }), /recencyMinutes/)
    await rejects(boot({ search: { afterDate: '2026/06/01' } }), /YYYY-MM-DD/)
    await rejects(boot({ search: { pubYearMin: 2020, domainType: 'news' } }), /research_paper/)
    await rejects(boot({ fetch: { includeSelectors: Array.from({ length: 21 }, () => 'div') } }), /at most 20/)
  })

  it('fails loud on a duplicate provider registration', async () => {
    const { ctx } = await boot({ apiKey: 'k' })
    await rejects(
      Promise.resolve(ctx.plugin(webTinyfish, { apiKey: 'k2' })),
      (error: unknown) => error instanceof WebError && error.code === 'WEB_DUPLICATE_PROVIDER',
    )
  })

  it('removes both providers when the plugin fiber is disposed', async () => {
    const { ctx, fiber } = await boot({ apiKey: 'k' })
    await fiber.dispose()
    await rejects(
      ctx.web.search({ query: 'q' }),
      (error: unknown) => error instanceof WebError && error.code === 'WEB_PROVIDER_UNAVAILABLE',
    )
  })
})
