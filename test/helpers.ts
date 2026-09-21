/**
 * Shared test doubles: a recording `fetch` stub and local HTTP servers for
 * transport-policy tests.
 * @module dsh-web-tinyfish/tests/helpers
 */

import { createServer, type Server } from 'node:http'

/** One captured fetch call: the URL, the init as passed, and flat headers. */
export interface RecordedFetch {
  readonly url: string
  readonly init: RequestInit
  readonly headers: Record<string, string>
}

/**
 * Replace `globalThis.fetch` with a recorder. The responder returns the
 * (possibly lazy) Response for each call.
 * @param respond - produces the response for one recorded call.
 * @returns the call log and the restore function.
 */
export function stubFetch(
  respond: (call: RecordedFetch) => Response | Promise<Response>,
): { calls: RecordedFetch[], restore: () => void } {
  const original = globalThis.fetch
  const calls: RecordedFetch[] = []
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = input instanceof URL
      ? input.toString()
      : typeof input === 'string' ? input : input.url
    const headers = init?.headers === undefined
      ? {}
      : Object.fromEntries(new Headers(init.headers))
    const call = { url, init: init ?? {}, headers }
    calls.push(call)
    return Promise.resolve(respond(call))
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

/**
 * Build a JSON `Response`.
 * @param body - the value serialized into the body.
 * @param status - the HTTP status; defaults to 200.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Start listening on an ephemeral loopback port.
 * @param server - the server to listen.
 * @returns the base URL, e.g. `http://127.0.0.1:41234`.
 */
export function listen(server: Server): Promise<string> {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('no listen address')
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

/**
 * Stop a server and wait for its close to settle.
 * @param server - the server to close.
 */
export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => error === undefined ? resolve() : reject(error))
  })
}
