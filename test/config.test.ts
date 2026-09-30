/**
 * Config-schema contract: the harness projects only `volatile()` fields into a
 * live settings form. A field added without it drops out of that form
 * silently, so this guard walks the schema and fails on any ordinary leaf.
 * @module dsh-web-tinyfish/tests/config
 */

import { deepStrictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { Config } from '../src/config.ts'

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
