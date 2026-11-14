/**
 * Config-schema contract: the harness projects only `volatile()` fields into a
 * live settings form. A field added without it drops out of that form
 * silently, so this guard walks the schema and fails on any ordinary leaf.
 * @module dsh-web-tinyfish/tests/config
 */

import { deepStrictEqual, throws } from 'node:assert'
import { describe, it } from 'node:test'
import { Config, validateConfig } from '../src/config.ts'

/** The slice of a schemastery node this walk needs. */
interface SchemaNode {
  readonly meta?: { readonly volatile?: boolean }
  readonly dict?: Record<string, SchemaNode>
}

/** Paths of every leaf that no volatile ancestor makes editable. */
function ordinaryLeaves(node: SchemaNode, path: string[] = [], live = false): string[] {
  const projected = live || node.meta?.volatile === true
  const children = Object.entries(node.dict ?? {})
  if (children.length === 0) return projected ? [] : [path.join('.')]
  return children.flatMap(([key, child]) => ordinaryLeaves(child, [...path, key], projected))
}

describe('Config schema', () => {
  it('marks every field volatile so the harness can project a live form', () => {
    deepStrictEqual(ordinaryLeaves(Config as unknown as SchemaNode), [])
  })
})

describe('validateConfig', () => {
  it('rejects the date and freshness filters on the research-paper corpus', () => {
    throws(() => validateConfig({ domainType: 'research_paper', afterDate: '2026-01-01' }), /research_paper/)
    throws(() => validateConfig({ domainType: 'research_paper', beforeDate: '2026-01-01' }), /research_paper/)
    throws(() => validateConfig({ domainType: 'research_paper', recencyMinutes: 60 }), /research_paper/)
  })

  it('accepts publication-year bounds on the research-paper corpus', () => {
    validateConfig({ domainType: 'research_paper', pubYearMin: 2020, pubYearMax: 2026 })
  })

  it('rejects a per-URL budget the whole-request timeout expires first', () => {
    throws(() => validateConfig(undefined, { perUrlTimeoutMs: 5000 }, 5000), /can never take effect/)
    throws(() => validateConfig(undefined, { perUrlTimeoutMs: 6000 }, 5000), /can never take effect/)
    validateConfig(undefined, { perUrlTimeoutMs: 4999 }, 5000)
    // Without the whole-request budget the per-URL budget is not judgeable.
    validateConfig(undefined, { perUrlTimeoutMs: 5000 })
  })
})
