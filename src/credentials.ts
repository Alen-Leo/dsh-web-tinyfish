/**
 * The API-key source both providers share: a literal config key wins, then
 * the harness credentials service, then the launch environment (which itself
 * folds in the inherited process environment and `.env` layers). No network.
 * @module dsh-web-tinyfish/credentials
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { DEFAULT_API_KEY_ENV, nonEmpty } from './config.ts'
import type { ApiKeySource } from './types.ts'

/**
 * Build the shared key source from the current configuration section.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the section carrying `apiKey` and `apiKeyEnv`.
 * @returns the key source both providers resolve through.
 */
export function apiKeySource(ctx: Context, config: { apiKey?: string, apiKeyEnv?: string }): ApiKeySource {
  const ref = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
  const literal = nonEmpty(config.apiKey) ? config.apiKey : undefined
  return {
    refName: String(ref),
    resolve: async () => {
      if (literal !== undefined) return literal
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) {
        const stored = await credentials.resolve(ref)
        if (stored !== undefined && stored.value.length > 0) return stored.value
      }
      const ambient = launchEnvironmentOf(ctx).get(ref)
      if (ambient !== undefined && ambient.value.length > 0) return ambient.value
      return undefined
    },
    hasSyncSource: () =>
      literal !== undefined
      || nonEmpty(launchEnvironmentOf(ctx).get(ref)?.value)
      || ctx.get('credentials') !== undefined,
  }
}

/**
 * Resolve the key for one request or fail with the seam's credential-missing
 * code, naming the reference (never a key value) and every fix.
 * @param key - the shared key source.
 * @param owner - diagnostic prefix naming the provider.
 * @returns the API key for the request header.
 */
export async function requireApiKey(key: ApiKeySource, owner: string): Promise<string> {
  // Trim every layer's value: keys never legitimately carry end-whitespace,
  // and copy-paste padding would otherwise surface as a confusing 401.
  const value = (await key.resolve())?.trim()
  if (value !== undefined && value.length > 0) return value
  throw new WebError(
    `${owner} has no API key for "${key.refName}"; set that environment variable, `
    + 'store it through the harness credentials service, or set apiKey in the web-tinyfish config',
    'WEB_PROVIDER_CREDENTIAL_MISSING',
  )
}
