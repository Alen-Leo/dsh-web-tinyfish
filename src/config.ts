/**
 * Constants, the cordis config schema, and cross-field validation for
 * `dsh-web-tinyfish`.
 * @module dsh-web-tinyfish/config
 */

import { createRequire } from 'node:module'
import z from '@deepseek-ai/schemastery'
import type { FetchConfig, SearchConfig } from './types.ts'

/** Provider id both providers register under on the `ctx.web` seam. */
export const TINYFISH_PROVIDER_ID = 'tinyfish'

/** Credential reference resolved per request when `apiKeyEnv` is unset. */
export const DEFAULT_API_KEY_ENV = 'TINYFISH_API_KEY'

/** Launch-environment variable overriding the search endpoint base. */
export const SEARCH_BASE_URL_ENV = 'TINYFISH_SEARCH_BASE_URL'

/** Launch-environment variable overriding the fetch endpoint base. */
export const FETCH_BASE_URL_ENV = 'TINYFISH_FETCH_BASE_URL'

/** TinyFish public Search API endpoint. */
export const DEFAULT_SEARCH_BASE_URL = 'https://api.search.tinyfish.ai'

/** TinyFish public Fetch API endpoint. */
export const DEFAULT_FETCH_BASE_URL = 'https://api.fetch.tinyfish.ai'

/**
 * Default whole-request timeout for both TinyFish APIs (150s).
 *
 * TinyFish budgets 110s per URL, applies a 120s ceiling to the whole fetch
 * request, and asks clients to wait at least 150s to receive its structured
 * `timeout` entry instead of a client-side abort. The same budget must also
 * exceed `fetch.perUrlTimeoutMs`, or that setting can never take effect.
 * `tool-web` bounds each call first (`fetchTimeoutMs` / `searchTimeoutMs`,
 * 30s by default), so raise those too when a long fetch is wanted.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 150_000

/** Default extraction format for fetched pages. */
export const DEFAULT_FETCH_FORMAT = 'markdown' as const

/** Default local byte cap on extracted text (512 KiB). */
export const DEFAULT_MAX_TEXT_BYTES = 512 * 1024

const { version } = createRequire(import.meta.url)('../package.json') as { version?: string }

/** This package's version, surfaced through the request `User-Agent`. */
export const PLUGIN_VERSION = version ?? '0'

/** Attribution header sent on every TinyFish request. Bump with the package. */
export const USER_AGENT = `dsh-web-tinyfish/${PLUGIN_VERSION}`

/** Maximum accepted fetch-target URL length, mirroring the local provider. */
export const MAX_TARGET_URL_LENGTH = 2048

/** `YYYY-MM-DD` shape required by the search date bounds. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Config schema. Every field is `volatile()`, so the harness projects the
 * plugin's live configuration into a settings form keyed by the entry id and
 * hands `apply` stable references the plugin reads per request.
 */
export const Config = z.object({
  apiKey: z.string().role('secret').volatile(),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV).volatile(),
  requestTimeoutMs: z.number().step(1).min(100).default(DEFAULT_REQUEST_TIMEOUT_MS).volatile(),
  search: z.object({
    baseURL: z.string(),
    location: z.string(),
    language: z.string(),
    includeDomains: z.array(z.string()),
    excludeDomains: z.array(z.string()),
    recencyMinutes: z.number().step(1).min(1).max(5_256_000),
    afterDate: z.string(),
    beforeDate: z.string(),
    domainType: z.union(['web', 'news', 'research_paper'] as const),
    pubYearMin: z.number().step(1).min(0).max(9999),
    pubYearMax: z.number().step(1).min(0).max(9999),
  }).volatile(),
  fetch: z.object({
    baseURL: z.string(),
    format: z.union(['markdown', 'html'] as const),
    ttlSeconds: z.number().step(1).min(0),
    perUrlTimeoutMs: z.number().step(1).min(1).max(110_000),
    maxTextBytes: z.number().step(1).min(1024),
    includeSelectors: z.array(z.string()),
    excludeSelectors: z.array(z.string()),
  }).volatile(),
})

/** True for a defined string with at least one non-whitespace character. */
export function nonEmpty(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value.trim().length > 0
}

/** First policy problem with one domain list, or `undefined` when it passes. */
function domainListProblem(domains: readonly string[] | undefined, field: string): string | undefined {
  if (domains === undefined) return undefined
  for (const entry of domains) {
    if (entry.trim().length === 0) return `${field} entries must be non-empty`
    if (entry.includes('/') || entry.includes('://')) {
      return `${field} entries must be bare hostnames, got "${entry}"`
    }
  }
  return undefined
}

/** First policy problem with one selector list, or `undefined` when it passes. */
function selectorListProblem(selectors: readonly string[] | undefined, field: string): string | undefined {
  if (selectors === undefined || selectors.length === 0) return undefined
  if (selectors.length > 20) return `${field} accepts at most 20 entries`
  for (const entry of selectors) {
    if (entry.length === 0) return `${field} entries must be non-empty`
    if (entry.length > 1000) return `${field} entries must be at most 1000 characters`
  }
  return undefined
}

/**
 * Cross-field validation the flat schema cannot express. The plugin calls it
 * at load — so a misconfigured composition fails loud — and again per request,
 * where the caller turns the message into a provider error. The harness
 * validates a settings write against the schema only, so a cross-field
 * combination that no single field can reject (a freshness window beside a
 * date bound, say) still has to be caught here at its first use.
 * @param search - the resolved search section, or its projected filters.
 * @param fetch - the resolved fetch section, or its projected options.
 */
export function validateConfig(
  search: SearchConfig | undefined,
  fetch?: FetchConfig,
): void {
  const prefix = 'dsh-web-tinyfish: '
  if (search !== undefined) {
    for (const [field, list] of [
      ['search.includeDomains', search.includeDomains],
      ['search.excludeDomains', search.excludeDomains],
    ] as const) {
      const problem = domainListProblem(list, field)
      if (problem !== undefined) throw new Error(prefix + problem)
    }
    if (search.recencyMinutes !== undefined
      && (search.afterDate !== undefined || search.beforeDate !== undefined)) {
      throw new Error(prefix + 'search.recencyMinutes cannot combine with search.afterDate or search.beforeDate')
    }
    for (const [field, value] of [
      ['search.afterDate', search.afterDate],
      ['search.beforeDate', search.beforeDate],
    ] as const) {
      if (value !== undefined && !ISO_DATE.test(value)) {
        throw new Error(prefix + `${field} must be YYYY-MM-DD, got "${value}"`)
      }
    }
    if (search.afterDate !== undefined && search.beforeDate !== undefined
      && search.afterDate > search.beforeDate) {
      throw new Error(prefix + `search.afterDate (${search.afterDate}) must not exceed search.beforeDate (${search.beforeDate})`)
    }
    if ((search.pubYearMin !== undefined || search.pubYearMax !== undefined)
      && search.domainType !== 'research_paper') {
      throw new Error(prefix + 'search.pubYearMin and search.pubYearMax require search.domainType "research_paper"')
    }
    if (search.pubYearMin !== undefined && search.pubYearMax !== undefined
      && search.pubYearMin > search.pubYearMax) {
      throw new Error(prefix + `search.pubYearMin (${search.pubYearMin}) must not exceed search.pubYearMax (${search.pubYearMax})`)
    }
  }
  if (fetch !== undefined) {
    for (const [field, list] of [
      ['fetch.includeSelectors', fetch.includeSelectors],
      ['fetch.excludeSelectors', fetch.excludeSelectors],
    ] as const) {
      const problem = selectorListProblem(list, field)
      if (problem !== undefined) throw new Error(prefix + problem)
    }
  }
}
