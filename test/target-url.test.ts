/**
 * Fetch-target hostname policy tests: the private-network classifier behind
 * the target preflight (loopback, private, shared, link-local, unique-local,
 * and reserved refusals for IPv4 and IPv6).
 * @module dsh-web-tinyfish/tests/target-url
 */

import { strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { isPrivateNetworkHost } from '../src/target-url.ts'

describe('isPrivateNetworkHost', () => {
  const refused = [
    'localhost', 'foo.localhost', 'LOCALHOST',
    '127.0.0.1', '0.0.0.0', '10.1.2.3',
    '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '100.64.0.1',
    '224.0.0.1', '255.255.255.255', '999.1.1.1',
    '::1', '::', '::ffff:10.0.0.1', '[::ffff:127.0.0.1]', '[::1]',
    'fe80::1', 'fd12:3456::1',
  ]
  for (const host of refused) {
    it(`refuses ${host}`, () => { strictEqual(isPrivateNetworkHost(host), true) })
  }
  const allowed = ['api.search.tinyfish.ai', 'example.com', '172.32.0.1', '172.15.0.1', '8.8.8.8']
  for (const host of allowed) {
    it(`allows ${host}`, () => { strictEqual(isPrivateNetworkHost(host), false) })
  }
})
