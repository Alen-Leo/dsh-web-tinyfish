/**
 * The TinyFish-backed `WebFetchProvider`: retrieves one URL through the Fetch
 * API's browser rendering and returns the extracted content. TinyFish reports
 * per-URL failures inside an HTTP 200 envelope; those map to `WebError`. The
 * origin page's own HTTP status is not passed through, so a successful result
 * always carries `statusCode: 200`.
 * @module dsh-web-tinyfish/fetch
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type { WebFetchBody, WebFetchProvider, WebFetchRequest, WebFetchResult } from '@deepseek-ai/dsh-web'
import { TINYFISH_PROVIDER_ID, USER_AGENT, nonEmpty } from './config.ts'
import { requireApiKey } from './credentials.ts'
import { bodyReadError, credentialedFetch, mapTinyFishApiError, parseEndpoint } from './endpoint.ts'
import { validateTargetUrl } from './target-url.ts'
import type { ResolvedFetchOptions, TinyFishFetchResponse } from './types.ts'

/**
 * Cut `text` to at most `maxBytes` of UTF-8 without splitting a character.
 * @param text - the full extracted text.
 * @param maxBytes - the byte budget.
 * @returns the kept text and whether any byte was dropped.
 */
export function capTextBytes(text: string, maxBytes: number): { content: string, truncated: boolean } {
  const bytes = new TextEncoder().encode(text)
  if (bytes.byteLength <= maxBytes) return { content: text, truncated: false }
  let cut = maxBytes
  while (cut > 0 && (bytes[cut]! & 0xc0) === 0x80) cut -= 1
  return { content: new TextDecoder().decode(bytes.subarray(0, cut)), truncated: true }
}

/** The Fetch API request body this provider serializes. */
interface FetchRequestBody {
  readonly urls: [string]
  readonly format: 'markdown' | 'html'
  readonly ttl?: number
  readonly per_url_timeout_ms?: number
  readonly include_selectors?: string[]
  readonly exclude_selectors?: string[]
}

/**
 * Normalize one Fetch API envelope for a single requested URL: a matching
 * `errors[]` entry throws, a matching `results[]` entry resolves with the
 * final URL and a body kind derived from the configured format.
 * @param payload - the decoded Fetch API response.
 * @param requestedUrl - the validated target URL string.
 * @param format - the configured extraction format.
 * @param maxTextBytes - the local byte cap on extracted text.
 * @returns the normalized fetch result.
 */
export function mapTinyFishFetchResponse(
  payload: TinyFishFetchResponse,
  requestedUrl: string,
  format: 'markdown' | 'html',
  maxTextBytes: number,
): WebFetchResult {
  // One URL goes in, so at most one entry per array comes back; matching by
  // echoed URL would be speculative precision.
  const item = (Array.isArray(payload.results) ? payload.results : [])[0]
  const failure = (Array.isArray(payload.errors) ? payload.errors : [])[0]
  if (failure !== undefined) {
    const code = nonEmpty(failure.error) ? failure.error : 'fetch_failed'
    const extra: string[] = []
    if (failure.unmatched_selectors !== undefined && failure.unmatched_selectors.length > 0) {
      extra.push(`unmatched selectors: ${failure.unmatched_selectors.join(', ')}`)
    }
    if (failure.candidate_selectors !== undefined && failure.candidate_selectors.length > 0) {
      extra.push(`candidate selectors: ${failure.candidate_selectors.join(', ')}`)
    }
    const detail = extra.length > 0 ? ` (${extra.join('; ')})` : ''
    throw new WebError(`TinyFish fetch failed for ${failure.url ?? requestedUrl}: ${code}${detail}`, 'WEB_PROVIDER_ERROR')
  }
  if (item === undefined || typeof item.text !== 'string') {
    throw new WebError(`TinyFish fetch returned no content for ${requestedUrl}`, 'WEB_PROVIDER_ERROR')
  }
  const { content, truncated } = capTextBytes(item.text, maxTextBytes)
  const body: WebFetchBody = format === 'html'
    ? { kind: 'html', content }
    : { kind: 'text', content }
  return {
    url: nonEmpty(item.final_url) ? item.final_url : requestedUrl,
    statusCode: 200,
    body,
    truncated,
  }
}

/** The TinyFish fetch provider registered as `tinyfish`. */
export class TinyFishFetchProvider implements WebFetchProvider {
  readonly id = TINYFISH_PROVIDER_ID
  private readonly resolveOptions: () => ResolvedFetchOptions

  /**
   * @param resolveOptions - reads the current section per request, so a
   *   committed settings change applies without re-registration.
   */
  constructor(resolveOptions: () => ResolvedFetchOptions) {
    this.resolveOptions = resolveOptions
  }

  available(): boolean {
    try {
      const options = this.resolveOptions()
      if (!options.key.hasSyncSource()) return false
      parseEndpoint(options.baseURL, 'TinyFish fetch')
      return true
    } catch {
      return false
    }
  }

  async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    const target = validateTargetUrl(request.url)
    const options = this.resolveOptions()
    const endpoint = parseEndpoint(options.baseURL, 'TinyFish fetch')
    const apiKey = await requireApiKey(options.key, 'TinyFish fetch')
    const body: FetchRequestBody = {
      urls: [target.toString()],
      format: options.format,
      ...(options.ttlSeconds !== undefined ? { ttl: options.ttlSeconds } : {}),
      ...(options.perUrlTimeoutMs !== undefined ? { per_url_timeout_ms: options.perUrlTimeoutMs } : {}),
      ...(options.includeSelectors !== undefined && options.includeSelectors.length > 0
        ? { include_selectors: [...options.includeSelectors] }
        : {}),
      ...(options.excludeSelectors !== undefined && options.excludeSelectors.length > 0
        ? { exclude_selectors: [...options.excludeSelectors] }
        : {}),
    }
    const response = await credentialedFetch({
      url: endpoint,
      owner: 'TinyFish fetch',
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      body: JSON.stringify(body),
      timeoutMs: options.requestTimeoutMs,
      ...(signal !== undefined ? { signal } : {}),
    })
    if (!response.ok) throw await mapTinyFishApiError(response, 'TinyFish fetch', signal)
    let payload: TinyFishFetchResponse
    try {
      payload = await response.json() as TinyFishFetchResponse
    } catch (error: unknown) {
      throw bodyReadError('TinyFish fetch', options.requestTimeoutMs, signal, error)
    }
    return mapTinyFishFetchResponse(payload, target.toString(), options.format, options.maxTextBytes)
  }
}
