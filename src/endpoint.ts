/**
 * Transport policy shared by both TinyFish providers: endpoint admission, a
 * credential-bearing fetch that refuses redirects, response-body-read
 * classification, and TinyFish error-envelope mapping.
 * @module dsh-web-tinyfish/endpoint
 */

import { WebError } from '@deepseek-ai/dsh-web'
import { nonEmpty } from './config.ts'
import type { TinyFishApiError } from './types.ts'

/**
 * Parse and admit one API endpoint: a valid `http(s)` URL. The endpoint is
 * operator configuration — local mocks and LAN gateways are legitimate
 * targets, matching the first-party providers — so admission checks shape
 * only, never network locality.
 * @param raw - the configured endpoint base.
 * @param owner - diagnostic prefix naming the rejecting provider.
 * @returns the parsed endpoint `URL`.
 */
export function parseEndpoint(raw: string, owner: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch (error: unknown) {
    throw new WebError(`${owner} endpoint "${raw}" is not a valid URL`, 'WEB_PROVIDER_ERROR', { cause: error })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebError(`${owner} endpoint must use http or https, got "${url.protocol}"`, 'WEB_PROVIDER_ERROR')
  }
  return url
}

/** One credential-bearing HTTP request description. */
export interface CredentialedRequest {
  readonly url: URL | string
  /** Diagnostic prefix naming the provider in errors. */
  readonly owner: string
  readonly headers: Record<string, string>
  readonly method?: 'GET' | 'POST'
  readonly body?: string
  readonly timeoutMs: number
  readonly signal?: AbortSignal
}

/**
 * Fetch carrying an API key with redirects refused: a 30x from the endpoint
 * fails instead of forwarding the credential to another origin.
 * @param request - the request description.
 * @returns the provider response.
 */
export async function credentialedFetch(request: CredentialedRequest): Promise<Response> {
  const timeout = AbortSignal.timeout(request.timeoutMs)
  const signal = request.signal === undefined ? timeout : AbortSignal.any([request.signal, timeout])
  try {
    return await fetch(request.url, {
      method: request.method ?? 'GET',
      headers: request.headers,
      ...(request.body !== undefined ? { body: request.body } : {}),
      redirect: 'error',
      signal,
    })
  } catch (error: unknown) {
    throw transportError(request, error)
  }
}

/** Flatten one error (and a short cause chain) into a diagnostic string. */
export function formatTransportDetail(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; depth < 4; depth += 1) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code
      parts.push(typeof code === 'string' && code.length > 0
        ? `${current.name}: ${current.message} (${code})`
        : `${current.name}: ${current.message}`)
      const next = (current as { cause?: unknown }).cause
      if (next === undefined || next === null) break
      current = next
      continue
    }
    parts.push(String(current))
    break
  }
  return parts.length === 0 ? String(error) : parts.join('; ')
}

/**
 * True only when undici failed because the endpoint answered with a 30x
 * under `redirect: 'error'`: undici rejects with `TypeError: fetch failed`
 * whose cause reads `unexpected redirect`. Network/DNS/TLS failures surface
 * as the same `TypeError: fetch failed` but never carry that cause, so the
 * marker alone separates the two. (The depth cap guards against cyclic
 * cause chains.)
 */
export function isEndpointRedirectRefusal(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4; depth += 1) {
    if (!(current instanceof Error)) break
    if (current.message.toLowerCase().includes('unexpected redirect')) return true
    const next = (current as { cause?: unknown }).cause
    if (next === undefined || next === null) break
    current = next
  }
  return false
}

/** Classify one transport failure onto the seam error taxonomy. */
function transportError(request: CredentialedRequest, error: unknown): WebError {
  if (request.signal?.aborted === true) {
    return new WebError(`${request.owner} request aborted`, 'WEB_ABORTED', { cause: request.signal.reason })
  }
  if (error instanceof DOMException) {
    if (error.name === 'AbortError') {
      return new WebError(`${request.owner} request aborted`, 'WEB_ABORTED', { cause: error })
    }
    if (error.name === 'TimeoutError') {
      return new WebError(`${request.owner} request timed out after ${request.timeoutMs}ms`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
  const detail = formatTransportDetail(error)
  if (isEndpointRedirectRefusal(error)) {
    return new WebError(
      `${request.owner} request failed (endpoint redirect refused; API key is not forwarded): ${detail}`,
      'WEB_PROVIDER_ERROR',
      { cause: error },
    )
  }
  return new WebError(`${request.owner} request failed (network/transport): ${detail}`, 'WEB_PROVIDER_ERROR', { cause: error })
}

/**
 * Classify one response-body read failure: a caller abort is cancellation,
 * timeout expiry is a provider timeout, and anything else is an unprocessable
 * body. Shared by both providers' success paths.
 * @param owner - diagnostic prefix naming the provider.
 * @param timeoutMs - the request's whole-request timeout budget.
 * @param signal - the caller's cancellation signal, when one was passed.
 * @param error - the body-read failure to classify.
 * @returns the seam error for the failure.
 */
export function bodyReadError(
  owner: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  error: unknown,
): WebError {
  if (signal?.aborted === true) {
    return new WebError(`${owner} aborted`, 'WEB_ABORTED', { cause: signal.reason })
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new WebError(`${owner} request timed out after ${timeoutMs}ms`, 'WEB_PROVIDER_ERROR', { cause: error })
  }
  return new WebError(`${owner} returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
}

/**
 * Map one non-2xx TinyFish response onto the seam taxonomy: authentication
 * failures are credential problems, everything else is a provider failure
 * carrying TinyFish's own error code for consumers to route on.
 * @param response - the non-2xx response whose body may hold an error envelope.
 * @param owner - diagnostic prefix naming the provider.
 * @param signal - the caller's cancellation signal, when one was passed.
 */
export async function mapTinyFishApiError(response: Response, owner: string, signal?: AbortSignal): Promise<WebError> {
  let code: string | undefined
  let message: string | undefined
  try {
    const payload = await response.json() as TinyFishApiError
    if (typeof payload.error === 'string') {
      code = payload.error
      message = payload.message
    } else if (payload.error !== undefined) {
      code = payload.error.code
      message = payload.error.message
    } else {
      message = payload.message
    }
  } catch (error: unknown) {
    // Cancellation during the error-body read is cancellation, not a provider
    // failure — the seam's cancellation contract (mirrors the first-party
    // providers).
    if (signal?.aborted === true) {
      throw new WebError(`${owner} aborted`, 'WEB_ABORTED', { cause: signal.reason })
    }
    // Otherwise: a non-JSON error body leaves the HTTP status as the only detail.
  }
  const tfCode = nonEmpty(code) ? code : `HTTP_${response.status}`
  const detail = nonEmpty(message) ? message : `HTTP ${response.status}`
  if (response.status === 401) {
    return new WebError(`${owner}: authentication failed (${tfCode}): ${detail}`, 'WEB_PROVIDER_CREDENTIAL_MISSING')
  }
  if (response.status === 429) {
    return new WebError(`${owner}: rate limited (${tfCode}): ${detail}`, 'WEB_PROVIDER_ERROR')
  }
  return new WebError(`${owner} request failed (${tfCode}): ${detail}`, 'WEB_PROVIDER_ERROR')
}
