/**
 * `dsh-web-tinyfish` — TinyFish-backed search and fetch providers for the
 * DeepSeek Harness web capability seam (`ctx.web`).
 * @module dsh-web-tinyfish
 */

import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
// Type-only: pulls the ctx.settings merge into this program without requiring
// the service at runtime.
import type {} from '@deepseek-ai/dsh-settings'
import { apiKeySource } from './credentials.ts'
import {
  Config,
  DEFAULT_FETCH_BASE_URL, DEFAULT_FETCH_FORMAT, DEFAULT_MAX_TEXT_BYTES, DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SEARCH_BASE_URL, FETCH_BASE_URL_ENV, SEARCH_BASE_URL_ENV, SETTINGS_NAMESPACE,
  nonEmpty, validateConfig,
} from './config.ts'
import { TinyFishFetchProvider } from './fetch.ts'
import { TinyFishSearchProvider } from './search.ts'
import type {
  Config as TinyfishConfig, ResolvedFetchOptions, ResolvedSearchOptions, SearchConfig, SearchFilters,
} from './types.ts'

export { Config, validateConfig } from './config.ts'
export {
  DEFAULT_API_KEY_ENV, DEFAULT_FETCH_BASE_URL, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_SEARCH_BASE_URL,
  SETTINGS_NAMESPACE, TINYFISH_PROVIDER_ID,
} from './config.ts'
export { TinyFishFetchProvider } from './fetch.ts'
export { TinyFishSearchProvider, mapTinyFishSearchResponse } from './search.ts'
export type {
  ApiKeySource, Config as WebTinyfishConfig, ResolvedFetchOptions, ResolvedSearchOptions, SearchFilters,
} from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-tinyfish'

/** The web seam both providers register into. */
export const inject = ['web'] as const

/** Read the endpoint base from the section or the launch environment. */
function resolveBaseURL(configured: string | undefined, envName: string, fallback: string, ctx: Context): string {
  if (configured !== undefined) return configured.trim()
  const fromEnv = launchEnvironmentOf(ctx).get(envName)?.value
  return nonEmpty(fromEnv) ? fromEnv.trim() : fallback
}

/** Project the search section into non-empty filters; absent fields stay out. */
function buildFilters(search: SearchConfig | undefined): SearchFilters {
  const section = search ?? {}
  return {
    // Values pass `nonEmpty` (whitespace-trimming presence check) before this
    // projection, so trimming here only strips stray padding from config or
    // settings edits — the wire values stay bare.
    ...(nonEmpty(section.location) ? { location: section.location.trim() } : {}),
    ...(nonEmpty(section.language) ? { language: section.language.trim() } : {}),
    ...(section.includeDomains !== undefined && section.includeDomains.length > 0
      ? { includeDomains: section.includeDomains.map(domain => domain.trim()) }
      : {}),
    ...(section.excludeDomains !== undefined && section.excludeDomains.length > 0
      ? { excludeDomains: section.excludeDomains.map(domain => domain.trim()) }
      : {}),
    ...(section.recencyMinutes !== undefined ? { recencyMinutes: section.recencyMinutes } : {}),
    ...(nonEmpty(section.afterDate) ? { afterDate: section.afterDate } : {}),
    ...(nonEmpty(section.beforeDate) ? { beforeDate: section.beforeDate } : {}),
    ...(section.domainType !== undefined ? { domainType: section.domainType } : {}),
    ...(section.pubYearMin !== undefined ? { pubYearMin: section.pubYearMin } : {}),
    ...(section.pubYearMax !== undefined ? { pubYearMax: section.pubYearMax } : {}),
  }
}

/** Project one section into the fully-defaulted inputs of a search request. */
function buildSearchOptions(ctx: Context, config: TinyfishConfig): ResolvedSearchOptions {
  validateConfig(config)
  return {
    baseURL: resolveBaseURL(config.search?.baseURL, SEARCH_BASE_URL_ENV, DEFAULT_SEARCH_BASE_URL, ctx),
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    key: apiKeySource(ctx, config),
    filters: buildFilters(config.search),
  }
}

/** Project one section into the fully-defaulted inputs of a fetch request. */
function buildFetchOptions(ctx: Context, config: TinyfishConfig): ResolvedFetchOptions {
  validateConfig(config)
  const section = config.fetch ?? {}
  return {
    baseURL: resolveBaseURL(section.baseURL, FETCH_BASE_URL_ENV, DEFAULT_FETCH_BASE_URL, ctx),
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    format: section.format ?? DEFAULT_FETCH_FORMAT,
    maxTextBytes: section.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES,
    key: apiKeySource(ctx, config),
    ...(section.ttlSeconds !== undefined ? { ttlSeconds: section.ttlSeconds } : {}),
    ...(section.perUrlTimeoutMs !== undefined ? { perUrlTimeoutMs: section.perUrlTimeoutMs } : {}),
    ...(section.includeSelectors !== undefined && section.includeSelectors.length > 0
      ? { includeSelectors: section.includeSelectors }
      : {}),
    ...(section.excludeSelectors !== undefined && section.excludeSelectors.length > 0
      ? { excludeSelectors: section.excludeSelectors }
      : {}),
  }
}

/**
 * Register the TinyFish search and fetch providers with `ctx.web`. A settings
 * service, when present, installs the `web-tinyfish` configuration card; both
 * providers read the current section per request, so a committed settings
 * change applies without re-registration.
 */
export function apply(ctx: Context, config: TinyfishConfig): void {
  validateConfig(config)
  let current: () => TinyfishConfig = () => config
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
      setSource: (source) => {
        current = source
      },
      // Nothing resolves at registration: each request projects the section,
      // so a committed change needs no re-registration.
      onChange: () => {},
    })
  })
  ctx.web.registerSearchProvider(new TinyFishSearchProvider(() => buildSearchOptions(ctx, current())))
  ctx.web.registerFetchProvider(new TinyFishFetchProvider(() => buildFetchOptions(ctx, current())))
}
