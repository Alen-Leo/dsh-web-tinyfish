/**
 * Transport-policy tests: endpoint admission (loopback bases included),
 * redirect refusal with a real redirecting server, timeout, abort
 * classification, and body-read classification.
 * @module dsh-web-tinyfish/tests/endpoint
 */

import { createServer } from 'node:http'
import { rejects, strictEqual, throws } from 'node:assert'
import { describe, it } from 'node:test'
import { WebError } from '@deepseek-ai/dsh-web'
import {
  bodyReadError, credentialedFetch, formatTransportDetail, isEndpointRedirectRefusal, mapTinyFishApiError, parseEndpoint,
} from '../src/endpoint.ts'
import { closeServer, listen } from './helpers.ts'

describe('parseEndpoint', () => {
  it('admits the public Search API endpoint', () => {
    strictEqual(parseEndpoint('https://api.search.tinyfish.ai', 'TinyFish search').href, 'https://api.search.tinyfish.ai/')
  })
  // The endpoint is operator configuration: local mocks and LAN gateways are
  // legitimate targets, matching the first-party providers.
  for (const raw of ['https://localhost/', 'http://127.0.0.1:8080/', 'https://10.0.0.1/', 'https://[::1]/']) {
    it(`admits loopback/private endpoint ${raw}`, () => {
      strictEqual(parseEndpoint(raw, 'TinyFish search').href, new URL(raw).href)
    })
  }
  it('refuses a non-HTTP scheme', () => {
    throws(() => parseEndpoint('ftp://example.com', 'TinyFish fetch'), (error: unknown) =>
      error instanceof WebError && error.message.includes('http or https'))
  })
  it('refuses an unparseable endpoint', () => {
    throws(() => parseEndpoint('not a url', 'TinyFish fetch'), (error: unknown) =>
      error instanceof WebError && error.message.includes('not a valid URL'))
  })
})

describe('credentialedFetch', () => {
  // credentialedFetch is the transport half: endpoint admission (the parse
  // guard above) belongs to config-time parsing, so these transport tests may
  // drive it against loopback servers deliberately.
  it('refuses a redirect and never contacts the redirect target', async () => {
    let targetHits = 0
    const target = createServer((_req, res) => { targetHits += 1; res.end('unreachable') })
    const targetUrl = await listen(target)
    const redirector = createServer((_req, res) => { res.writeHead(302, { location: targetUrl }).end() })
    const redirectUrl = await listen(redirector)
    try {
      await rejects(
        credentialedFetch({
          url: redirectUrl, owner: 'TinyFish search', headers: { 'X-API-Key': 'secret' }, timeoutMs: 3000,
        }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_PROVIDER_ERROR' && error.message.includes('refused'),
      )
      strictEqual(targetHits, 0, 'the redirect target must not be contacted')
    } finally {
      await closeServer(redirector)
      await closeServer(target)
    }
  })

  it('classifies expiry as a provider timeout', async () => {
    const hanging = createServer(() => { /* never respond */ })
    const url = await listen(hanging)
    try {
      await rejects(
        credentialedFetch({ url, owner: 'TinyFish fetch', headers: {}, timeoutMs: 150 }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_PROVIDER_ERROR' && error.message.includes('timed out'),
      )
    } finally {
      await closeServer(hanging)
    }
  })

  it('classifies a pre-aborted caller signal as cancellation', async () => {
    const server = createServer((_req, res) => { res.end('ok') })
    const url = await listen(server)
    const controller = new AbortController()
    controller.abort(new Error('user cancelled'))
    try {
      await rejects(
        credentialedFetch({
          url, owner: 'TinyFish search', headers: {}, timeoutMs: 3000, signal: controller.signal,
        }),
        (error: unknown) => error instanceof WebError && error.code === 'WEB_ABORTED',
      )
    } finally {
      await closeServer(server)
    }
  })

  it('classifies an unreachable endpoint as a provider failure, not a redirect refusal', async () => {
    await rejects(
      credentialedFetch({
        url: 'https://no-such-host.invalid', owner: 'TinyFish search', headers: {}, timeoutMs: 3000,
      }),
      (error: unknown) =>
        error instanceof WebError
        && error.code === 'WEB_PROVIDER_ERROR'
        && error.message.includes('network/transport')
        && error.message.includes('fetch failed')
        && !error.message.includes('redirect'),
    )
  })
})

describe('transport error classification', () => {
  it('labels only real endpoint redirects as redirect refusals', () => {
    const redirect = new TypeError('fetch failed', { cause: new Error('unexpected redirect') })
    const network = new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo ENOTFOUND x'), { code: 'ENOTFOUND' }) })
    strictEqual(isEndpointRedirectRefusal(redirect), true)
    strictEqual(isEndpointRedirectRefusal(network), false)
    strictEqual(formatTransportDetail(network).includes('ENOTFOUND'), true)
  })

  it('does not mistake a DNS failure for a redirect refusal when the hostname embeds those words', () => {
    // Node embeds the hostname in getaddrinfo messages and parseEndpoint
    // admits LAN/mock hosts, so those words in a hostname must not flip
    // the classification.
    const dns = new TypeError('fetch failed', {
      cause: Object.assign(new Error('getaddrinfo ENOTFOUND redirect.error.lan'), { code: 'ENOTFOUND' }),
    })
    strictEqual(isEndpointRedirectRefusal(dns), false)
  })
})

describe('bodyReadError', () => {
  it('classifies a caller abort as cancellation', () => {
    const controller = new AbortController()
    controller.abort(new Error('user cancelled'))
    const error = bodyReadError('TinyFish search', 5000, controller.signal, new Error('read failed'))
    strictEqual(error instanceof WebError && error.code, 'WEB_ABORTED')
  })
  it('classifies timeout expiry as a provider timeout', () => {
    const error = bodyReadError('TinyFish fetch', 5000, undefined, new DOMException('expired', 'TimeoutError'))
    strictEqual(error instanceof WebError && error.code, 'WEB_PROVIDER_ERROR')
    strictEqual(error instanceof WebError && error.message.includes('timed out after 5000ms'), true)
  })
  it('wraps anything else as an unprocessable body', () => {
    const error = bodyReadError('TinyFish search', 5000, undefined, new Error('bad json'))
    strictEqual(error instanceof WebError && error.message.includes('unprocessable'), true)
  })
})

describe('mapTinyFishApiError', () => {
  it('surfaces a caller abort during the error-body read as cancellation', async () => {
    const controller = new AbortController()
    controller.abort(new Error('user cancelled'))
    const response = new Response(
      new ReadableStream({ start(controller) { controller.error(new DOMException('aborted', 'AbortError')) } }),
      { status: 500 },
    )
    await rejects(
      mapTinyFishApiError(response, 'TinyFish search', controller.signal),
      (error: unknown) => error instanceof WebError && error.code === 'WEB_ABORTED',
    )
  })
  it('falls back to the HTTP status when the error body is not JSON', async () => {
    const error = await mapTinyFishApiError(new Response('gateway html', { status: 502 }), 'TinyFish search')
    strictEqual(error instanceof WebError && error.code, 'WEB_PROVIDER_ERROR')
    strictEqual(error instanceof WebError && error.message.includes('HTTP_502'), true)
  })
})
