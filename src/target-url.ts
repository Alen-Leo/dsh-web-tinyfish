/**
 * Network-independent preflight for one fetch target, mirroring the local
 * HTTP fetch provider's policy: bounded length, HTTP(S) only, no embedded
 * credentials, no private-network destinations. Unlike the API endpoint
 * (operator configuration), the target URL comes from the model, so the
 * private-network refusal stays — the tool must not become an intranet
 * probe, and intranet URLs never reach the third party.
 * @module dsh-web-tinyfish/target-url
 */

import { WebError } from '@deepseek-ai/dsh-web'
import { MAX_TARGET_URL_LENGTH } from './config.ts'

/**
 * True when the hostname names a loopback, private, shared, link-local,
 * unique-local, or reserved address — never a valid fetch target.
 * IPv4-mapped IPv6 addresses recurse into their IPv4 form.
 * @param rawHostname - the host exactly as `URL.hostname` reports it.
 */
export function isPrivateNetworkHost(rawHostname: string): boolean {
  let host = rawHostname.trim().toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  const labels = host.split('.')
  if (labels.length === 4 && labels.every(label => /^\d{1,3}$/.test(label))) {
    const octets = labels.map(Number)
    if (octets.some(octet => octet > 255)) return true
    const [a, b] = octets
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a >= 224) return true
    return false
  }
  if (host.includes(':')) {
    if (host === '::1' || host === '::') return true
    if (host.startsWith('::ffff:')) return isPrivateNetworkHost(host.slice('::ffff:'.length))
    if (/^fe[89ab]/.test(host)) return true
    if (/^f[cd]/.test(host)) return true
  }
  return false
}

/**
 * Validate one URL the model asked to fetch before it reaches TinyFish.
 * @param input - the raw URL string from the fetch request.
 * @returns the parsed target `URL`.
 */
export function validateTargetUrl(input: string): URL {
  if (input.length > MAX_TARGET_URL_LENGTH) {
    throw new WebError(`URL exceeds the maximum length of ${MAX_TARGET_URL_LENGTH}`, 'WEB_INVALID_URL')
  }
  let url: URL
  try {
    url = new URL(input)
  } catch (error: unknown) {
    throw new WebError(`invalid URL: ${input}`, 'WEB_INVALID_URL', { cause: error })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebError(`unsupported URL scheme "${url.protocol}" (only http and https are allowed)`, 'WEB_INVALID_URL')
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new WebError('credentials in URLs are not allowed', 'WEB_BLOCKED_URL')
  }
  if (isPrivateNetworkHost(url.hostname)) {
    throw new WebError(`target "${url.hostname}" is forbidden (private, loopback, or reserved network)`, 'WEB_BLOCKED_URL')
  }
  return url
}
