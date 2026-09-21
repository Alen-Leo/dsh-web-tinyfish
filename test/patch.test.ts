/**
 * Bundle-patch semantics: `cordis.patch.yml` inserts exactly the plugin row
 * and restates the `web` row with both provider keys, touching nothing else.
 * @module dsh-web-tinyfish/tests/patch
 */

import { readFileSync } from 'node:fs'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import yaml from 'js-yaml'

const patch = yaml.load(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')) as unknown[]
const text = JSON.stringify(patch)

describe('cordis.patch.yml', () => {
  it('carries exactly one insert row and one web override', () => {
    strictEqual(patch.length, 2)
    strictEqual(Object.keys(patch[0] as object).length, 1)
    strictEqual(Object.keys(patch[1] as object).length, 2)
  })

  it('inserts only this plugin under its package name', () => {
    const insert = (patch[0] as { insert: unknown[] }).insert
    strictEqual(insert.length, 1)
    const row = insert[0] as Record<string, unknown>
    strictEqual(row.id, 'web-tinyfish')
    strictEqual(row.name, 'dsh-web-tinyfish')
    // The scaffolded config carries commented-out examples only: YAML drops
    // them entirely, so no config key ships.
    strictEqual(row.config, null)
  })

  it('restates the web row with exactly both provider keys', () => {
    deepStrictEqual(patch[1], {
      id: 'web',
      config: { searchProvider: 'tinyfish', fetchProvider: 'http' },
    })
  })

  it('never widens tool availability or touches unrelated rows', () => {
    ok(!text.includes('tool-web'), 'the patch must not enable the model-facing web tools')
    ok(!text.includes('llm'), 'the patch must not touch LLM rows')
    ok(!text.includes('disabled'), 'the patch must not flip any row off or on')
  })
})
