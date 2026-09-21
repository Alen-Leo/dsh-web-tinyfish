/**
 * The TinyFish-backed `WebSearchProvider`: forwards one query plus the
 * configured filters to the Search API and normalizes the response.
 * @module dsh-web-tinyfish/search
 */

import type {
  WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource,
} from '@deepseek-ai/dsh-web'
import { TINYFISH_PROVIDER_ID, USER_AGENT, nonEmpty } from './config.ts'
import { requireApiKey } from './credentials.ts'
import { bodyReadError, credentialedFetch, mapTinyFishApiError, parseEndpoint } from './endpoint.ts'
import type { ResolvedSearchOptions, TinyFishSearchResponse } from './types.ts'

/**
 * Normalize one Search API payload: keeps items with a URL, deduplicates by
 * URL, caps the list at `maxResults`, and flags the cut. Fields the seam
 * cannot carry (`position`, `site_name`, `publisher`, and the academic
 * `authors`/`venue`/`pub_year`/`citation_count`/`pdf_url`) are dropped.
 * @param payload - the decoded Search API response.
 * @param maxResults - the request's result bound, if any.
 * @returns the normalized search result.
 */
export function mapTinyFishSearchResponse(
  payload: TinyFishSearchResponse,
  maxResults: number | undefined,
): WebSearchResult {
  const sources: WebSearchSource[] = []
  const seen = new Set<string>()
  let truncated = false
  const items = Array.isArray(payload.results) ? payload.results : []
  for (const item of items) {
    if (typeof item.url !== 'string' || item.url.length === 0) continue
    if (seen.has(item.url)) continue
    if (maxResults !== undefined && sources.length >= maxResults) {
      truncated = true
      break
    }
    seen.add(item.url)
    sources.push({
      url: item.url,
      ...(nonEmpty(item.title) ? { title: item.title } : {}),
      ...(nonEmpty(item.snippet) ? { snippet: item.snippet } : {}),
      ...(nonEmpty(item.date) ? { publishedAt: item.date } : {}),
    })
  }
  return { sources, truncated }
}

/** The TinyFish search provider registered as `tinyfish`. */
export class TinyFishSearchProvider implements WebSearchProvider {
  readonly id = TINYFISH_PROVIDER_ID
  private readonly resolveOptions: () => ResolvedSearchOptions

  /**
   * @param resolveOptions - reads the current section per request, so a
   *   committed settings change applies without re-registration.
   */
  constructor(resolveOptions: () => ResolvedSearchOptions) {
    this.resolveOptions = resolveOptions
  }

  available(): boolean {
    try {
      const options = this.resolveOptions()
      if (!options.key.hasSyncSource()) return false
      parseEndpoint(options.baseURL, 'TinyFish search')
      return true
    } catch {
      return false
    }
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const options = this.resolveOptions()
    const endpoint = parseEndpoint(options.baseURL, 'TinyFish search')
    const apiKey = await requireApiKey(options.key, 'TinyFish search')
    const filters = options.filters
    const params = endpoint.searchParams
    params.set('query', request.query)
    if (nonEmpty(filters.location)) params.set('location', filters.location)
    if (nonEmpty(filters.language)) params.set('language', filters.language)
    if (filters.includeDomains !== undefined && filters.includeDomains.length > 0) {
      params.set('include_domains', filters.includeDomains.join(','))
    }
    if (filters.excludeDomains !== undefined && filters.excludeDomains.length > 0) {
      params.set('exclude_domains', filters.excludeDomains.join(','))
    }
    if (filters.recencyMinutes !== undefined) params.set('recency_minutes', String(filters.recencyMinutes))
    if (nonEmpty(filters.afterDate)) params.set('after_date', filters.afterDate)
    if (nonEmpty(filters.beforeDate)) params.set('before_date', filters.beforeDate)
    if (filters.domainType !== undefined) params.set('domain_type', filters.domainType)
    if (filters.pubYearMin !== undefined) params.set('pub_year_min', String(filters.pubYearMin))
    if (filters.pubYearMax !== undefined) params.set('pub_year_max', String(filters.pubYearMax))
    const response = await credentialedFetch({
      url: endpoint,
      owner: 'TinyFish search',
      headers: {
        'X-API-Key': apiKey,
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      timeoutMs: options.requestTimeoutMs,
      ...(signal !== undefined ? { signal } : {}),
    })
    if (!response.ok) throw await mapTinyFishApiError(response, 'TinyFish search', signal)
    let payload: TinyFishSearchResponse
    try {
      payload = await response.json() as TinyFishSearchResponse
    } catch (error: unknown) {
      throw bodyReadError('TinyFish search', options.requestTimeoutMs, signal, error)
    }
    return mapTinyFishSearchResponse(payload, request.maxResults)
  }
}
