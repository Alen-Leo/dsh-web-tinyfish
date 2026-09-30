/**
 * Fetch-target policy tests: the private-network classifier and the URL
 * preflight that consumes it. The URL-level cases matter most — `URL.hostname`
 * normalizes `127.1`, `2130706433`, and IPv4-mapped IPv6 spellings before the
 * classifier sees them, so a test that feeds it hand-written hostnames can pass
 * while the real preflight admits the same destination.
 * @module dsh-web-tinyfish/tests/target-url
 */

import { strictEqual, throws } from 'node:assert'
import { describe, it } from 'node:test'
import { WebError } from '@deepseek-ai/dsh-web'
import { isPrivateNetworkHost, validateTargetUrl } from '../src/target-url.ts'

describe('isPrivateNetworkHost', () => {
  const refused = [
    'localhost', 'foo.localhost', 'LOCALHOST',
    '127.0.0.1', '0.0.0.0', '10.1.2.3',
    '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '100.64.0.1',
    '224.0.0.1', '255.255.255.255', '999.1.1.1',
    '::1', '::', '::ffff:10.0.0.1', '[::ffff:127.0.0.1]', '[::1]',
    'fe80::1', 'fd12:3456::1', '[fe80::1%25eth0]',
    'localhost.', 'myapp.localhost.',
  ]
  for (const host of refused) {
    it(`refuses ${host}`, () => { strictEqual(isPrivateNetworkHost(host), true) })
  }
  const allowed = ['api.search.tinyfish.ai', 'example.com', 'example.com.', '172.32.0.1', '172.15.0.1', '8.8.8.8', '::ffff:8.8.8.8']
  for (const host of allowed) {
    it(`allows ${host}`, () => { strictEqual(isPrivateNetworkHost(host), false) })
  }
})

describe('validateTargetUrl', () => {
  it('refuses a private destination reachable through every address spelling', () => {
    for (const raw of [
      'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/',
      'http://10.0.0.1/', 'http://192.168.0.1/', 'http://169.254.169.254/',
      'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/',
      'http://[::ffff:10.0.0.1]/', 'http://[::ffff:a00:1]/', 'http://[::ffff:a9fe:a9fe]/',
      'http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/',
      'http://localhost./', 'http://myapp.localhost./',
    ]) {
      throws(() => validateTargetUrl(raw), (error: unknown) =>
        error instanceof WebError && error.code === 'WEB_BLOCKED_URL', raw)
    }
  })

  it('admits public destinations, including public IPv4-mapped IPv6', () => {
    for (const raw of ['https://example.com/page?a=1', 'https://example.com./', 'https://8.8.8.8/', 'https://[2606:4700:4700::1111]/', 'https://[::ffff:8.8.8.8]/']) {
      strictEqual(validateTargetUrl(raw) instanceof URL, true, raw)
    }
  })

  it('refuses an unsupported scheme and embedded credentials', () => {
    throws(() => validateTargetUrl('ftp://example.com/'), (error: unknown) =>
      error instanceof WebError && error.code === 'WEB_INVALID_URL')
    throws(() => validateTargetUrl('https://user:pass@example.com/'), (error: unknown) =>
      error instanceof WebError && error.code === 'WEB_BLOCKED_URL')
  })

  it('refuses an unparseable and an over-long URL', () => {
    throws(() => validateTargetUrl('not a url'), (error: unknown) =>
      error instanceof WebError && error.code === 'WEB_INVALID_URL')
    throws(() => validateTargetUrl(`https://example.com/${'a'.repeat(2100)}`), (error: unknown) =>
      error instanceof WebError && error.code === 'WEB_INVALID_URL')
  })
})
