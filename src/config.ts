/**
 * Constants, the cordis config schema, and cross-field validation for
 * `dsh-web-tinyfish`.
 * @module dsh-web-tinyfish/config
 */

import { createRequire } from 'node:module'
import z from '@deepseek-ai/schemastery'
import type { Config as TinyfishConfig } from './types.ts'

/** Provider id both providers register under on the `ctx.web` seam. */
export const TINYFISH_PROVIDER_ID = 'tinyfish'

/** Settings namespace the configuration card installs under. */
export const SETTINGS_NAMESPACE = 'web-tinyfish'

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

/** Default whole-request timeout for both TinyFish APIs. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 45_000

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

export const Config: z<TinyfishConfig> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  requestTimeoutMs: z.number().step(1).min(100).default(DEFAULT_REQUEST_TIMEOUT_MS),
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
  }),
  fetch: z.object({
    baseURL: z.string(),
    format: z.union(['markdown', 'html'] as const),
    ttlSeconds: z.number().step(1).min(0),
    perUrlTimeoutMs: z.number().step(1).min(1).max(110_000),
    maxTextBytes: z.number().step(1).min(1024),
    includeSelectors: z.array(z.string()),
    excludeSelectors: z.array(z.string()),
  }),
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
 * at load so a misconfiguration fails loud, and per request so a broken
 * settings section fails at its first use.
 * @param config - the section to check.
 */
export function validateConfig(config: TinyfishConfig): void {
  const prefix = 'dsh-web-tinyfish: '
  const search = config.search
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
  const fetch = config.fetch
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
