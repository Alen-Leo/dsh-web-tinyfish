/**
 * Network-independent preflight for one fetch target, mirroring the local
 * HTTP fetch provider's URL policy: bounded length, HTTP(S) only, no embedded
 * credentials, no private-network destination. Unlike the API endpoint
 * (operator configuration), the target URL comes from the model, so the
 * private-network refusal stays — the tool must not become an intranet probe.
 *
 * The check is offline and synchronous, so it classifies address literals
 * exactly (including IPv4-mapped, 6to4, Teredo and NAT64 spellings) and judges
 * names such as `localhost` textually; a name that resolves to a private
 * address cannot be detected here. TinyFish applies its own private-IP and
 * metadata-endpoint refusal server-side for that residue.
 * @module dsh-web-tinyfish/target-url
 */

import ipaddr from 'ipaddr.js'
import { WebError } from '@deepseek-ai/dsh-web'
import { MAX_TARGET_URL_LENGTH } from './config.ts'

/**
 * Normalize `URL.hostname` for classification: drop the brackets kept around
 * an IPv6 literal and the single trailing dot that spells the DNS root —
 * `localhost.` and `a.localhost.` name the same host as their dotless forms,
 * so the root dot must not slip a refused name past the textual checks.
 */
function bareHostname(rawHostname: string): string {
  const host = rawHostname.trim().toLowerCase()
  const unbracketed = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  return unbracketed.length > 1 && unbracketed.endsWith('.') ? unbracketed.slice(0, -1) : unbracketed
}

/** True for a four-label numeric host: a dotted quad spelling that did not parse. */
function isMalformedDottedQuad(host: string): boolean {
  const labels = host.split('.')
  return labels.length === 4 && labels.every(label => /^\d{1,3}$/.test(label))
}

/**
 * True when the host names a loopback, private, shared, link-local,
 * unique-local, or otherwise non-public destination — never a valid fetch
 * target. Address literals are classified by `ipaddr.js`, which understands
 * the transition and translation spellings (`::ffff:10.0.0.1`, `2002:…`,
 * `64:ff9b::…`) that a naive prefix test misses; IPv4-mapped IPv6 is judged by
 * the IPv4 address it embeds.
 * @param rawHostname - the host exactly as `URL.hostname` reports it.
 */
export function isPrivateNetworkHost(rawHostname: string): boolean {
  const host = bareHostname(rawHostname)
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  let parsed: ipaddr.IPv4 | ipaddr.IPv6
  try {
    parsed = ipaddr.parse(host)
  } catch {
    // Not an address literal. A colon means an IPv6 spelling `ipaddr.js`
    // refused (a zone-qualified literal, say) and a four-label numeric host is
    // a malformed dotted quad: neither is a public destination, so both are
    // refused rather than handed on unclassified.
    return host.includes(':') || isMalformedDottedQuad(host)
  }
  if (parsed instanceof ipaddr.IPv4) return parsed.range() !== 'unicast'
  if (parsed.isIPv4MappedAddress()) return parsed.toIPv4Address().range() !== 'unicast'
  return parsed.range() !== 'unicast'
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
