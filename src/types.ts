/**
 * Type vocabulary for `dsh-web-tinyfish`: plugin configuration, resolved
 * per-request options, and the TinyFish wire envelopes both providers map.
 * This module contains types only — no runtime code.
 * @module dsh-web-tinyfish/types
 */

/** Plugin configuration validated by the cordis `Config` schema. */
export interface Config {
  /** Literal TinyFish API key. Prefer `apiKeyEnv` so no secret enters config files. */
  readonly apiKey?: string
  /** Credential reference resolved per request; defaults to `TINYFISH_API_KEY`. */
  readonly apiKeyEnv?: string
  /** Whole-request timeout for both TinyFish APIs, in milliseconds. */
  readonly requestTimeoutMs?: number
  /** Search-provider settings; every field is optional. */
  readonly search?: SearchConfig
  /** Fetch-provider settings; every field is optional. */
  readonly fetch?: FetchConfig
}

/** TinyFish Search API tuning forwarded with every query. */
export interface SearchConfig {
  /** Endpoint base; defaults to the public Search API. */
  readonly baseURL?: string
  /** Country code for geo targeting (`US`, `GB`, ...); forwarded as `location`. */
  readonly location?: string
  /** Language code (`en`, `zh`, ...); forwarded as `language`. */
  readonly language?: string
  /** Restrict results to these bare domains; forwarded as `include_domains`. */
  readonly includeDomains?: string[]
  /** Drop results from these bare domains; forwarded as `exclude_domains`. */
  readonly excludeDomains?: string[]
  /** Freshness window in minutes; cannot combine with the date bounds. */
  readonly recencyMinutes?: number
  /** Lower date bound `YYYY-MM-DD`; forwarded as `after_date`. */
  readonly afterDate?: string
  /** Upper date bound `YYYY-MM-DD`; forwarded as `before_date`. */
  readonly beforeDate?: string
  /** Result corpus; `research_paper` enables the publication-year bounds. */
  readonly domainType?: 'web' | 'news' | 'research_paper'
  /** Inclusive lower publication year; valid only with `domainType: 'research_paper'`. */
  readonly pubYearMin?: number
  /** Inclusive upper publication year; valid only with `domainType: 'research_paper'`. */
  readonly pubYearMax?: number
}

/** TinyFish Fetch API tuning applied to every retrieved URL. */
export interface FetchConfig {
  /** Endpoint base; defaults to the public Fetch API. */
  readonly baseURL?: string
  /** Extraction format; `markdown` maps to a text body, `html` to an HTML body. */
  readonly format?: 'markdown' | 'html'
  /** Cache freshness tolerance in seconds; 0 forces a live fetch. */
  readonly ttlSeconds?: number
  /** Per-URL wall-clock budget in milliseconds TinyFish enforces server-side. */
  readonly perUrlTimeoutMs?: number
  /** Local byte cap on the extracted text; the result flags `truncated` when cut. */
  readonly maxTextBytes?: number
  /** CSS selectors scoping extraction; forwarded as `include_selectors`. */
  readonly includeSelectors?: string[]
  /** CSS selectors removed before extraction; forwarded as `exclude_selectors`. */
  readonly excludeSelectors?: string[]
}

/**
 * How a provider obtains its API key. Built by `apiKeySource()`; the literal
 * config key wins, then the harness credentials service, then the launch
 * environment. `resolve()` performs no network I/O.
 */
export interface ApiKeySource {
  /** The credential/env reference name quoted in diagnostics. */
  readonly refName: string
  /** Resolve the key; `undefined` when no layer holds one. */
  resolve(): Promise<string | undefined>
  /**
   * Cheap synchronous probe for `available()`: whether a layer plausibly
   * holds a key. The credentials service counts as a source because its
   * store is async; a missing key then fails the request loudly instead.
   */
  hasSyncSource(): boolean
}

/** Non-empty search filters; absent fields are not sent. */
export interface SearchFilters {
  readonly location?: string
  readonly language?: string
  readonly includeDomains?: string[]
  readonly excludeDomains?: string[]
  readonly recencyMinutes?: number
  readonly afterDate?: string
  readonly beforeDate?: string
  readonly domainType?: 'web' | 'news' | 'research_paper'
  readonly pubYearMin?: number
  readonly pubYearMax?: number
}

/** Fully-defaulted inputs one search request resolves with. */
export interface ResolvedSearchOptions {
  readonly baseURL: string
  readonly requestTimeoutMs: number
  readonly key: ApiKeySource
  readonly filters: SearchFilters
}

/** Fully-defaulted inputs one fetch request resolves with. */
export interface ResolvedFetchOptions {
  readonly baseURL: string
  readonly requestTimeoutMs: number
  readonly format: 'markdown' | 'html'
  readonly maxTextBytes: number
  readonly key: ApiKeySource
  readonly ttlSeconds?: number
  readonly perUrlTimeoutMs?: number
  readonly includeSelectors?: string[]
  readonly excludeSelectors?: string[]
}

/** One TinyFish Search API result item (wire shape). */
export interface TinyFishSearchItem {
  readonly position?: number
  readonly site_name?: string
  readonly title?: string | null
  readonly snippet?: string | null
  readonly url?: string | null
  readonly date?: string | null
  readonly publisher?: string | null
  readonly authors?: string[] | null
  readonly venue?: string | null
  readonly pub_year?: number | null
  readonly citation_count?: number | null
  readonly pdf_url?: string | null
}

/** TinyFish Search API response envelope. */
export interface TinyFishSearchResponse {
  readonly query?: string
  readonly results?: readonly TinyFishSearchItem[]
  readonly total_results?: number
  readonly page?: number
}

/** TinyFish API-level error envelope carried by non-2xx responses. */
export interface TinyFishApiError {
  readonly error?: { readonly code?: string; readonly message?: string } | string
  readonly message?: string
}

/** One successful per-URL fetch result (wire shape). */
export interface TinyFishFetchResultItem {
  readonly url?: string
  readonly final_url?: string | null
  readonly title?: string | null
  readonly description?: string | null
  readonly language?: string | null
  readonly format?: string | null
  readonly text?: string | null
  readonly unmatched_selectors?: string[] | null
}

/** One per-URL failure carried inside an HTTP 200 response. */
export interface TinyFishFetchErrorItem {
  readonly url?: string
  readonly error?: string | null
  readonly status?: number | null
  readonly unmatched_selectors?: string[] | null
  readonly candidate_selectors?: string[] | null
}

/** TinyFish Fetch API response envelope. */
export interface TinyFishFetchResponse {
  readonly results?: readonly TinyFishFetchResultItem[]
  readonly errors?: readonly TinyFishFetchErrorItem[]
}
