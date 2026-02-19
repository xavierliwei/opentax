import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ComputeTrace } from '../../../src/rules/engine.ts'
import {
  computeLayout,
  useTraceLayout,
  NODE_WIDTH,
  NODE_HEIGHT,
  HORIZONTAL_GAP,
  VERTICAL_GAP,
} from '../../../src/ui/explain/useTraceLayout.ts'

// ── Fixtures ────────────────────────────────────────────────────

function leaf(id: string, amount = 100_00): ComputeTrace {
  return {
    nodeId: id,
    label: `Leaf ${id}`,
    output: {
      amount,
      source: { kind: 'document', documentType: 'W-2', documentId: '1', field: 'Box 1' },
      confidence: 1.0,
    },
    inputs: [],
  }
}

function parent(id: string, children: ComputeTrace[], amount = 200_00): ComputeTrace {
  return {
    nodeId: id,
    label: `Node ${id}`,
    output: {
      amount,
      source: { kind: 'computed', nodeId: id, inputs: children.map(c => c.nodeId) },
      confidence: 1.0,
    },
    inputs: children,
  }
}

// ── Tests ───────────────────────────────────────────────────────

describe('computeLayout', () => {
  it('single leaf → 1 node, 0 edges, correct dimensions', () => {
    const trace = leaf('a')
    const { nodes, edges, width, height } = computeLayout(trace, new Set())

    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
    expect(width).toBe(NODE_WIDTH)
    expect(height).toBe(NODE_HEIGHT)
    expect(nodes[0].x).toBe(0)
    expect(nodes[0].y).toBe(0)
  })

  it('two-level tree → parent + children positioned correctly', () => {
    const a = leaf('a')
    const b = leaf('b')
    const root = parent('root', [a, b])

    const { nodes, edges, width, height } = computeLayout(root, new Set())

    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)

    // Width = 2 * NODE_WIDTH + HORIZONTAL_GAP
    expect(width).toBe(NODE_WIDTH * 2 + HORIZONTAL_GAP)

    // Height = 2 rows
    expect(height).toBe(NODE_HEIGHT * 2 + VERTICAL_GAP)

    // Root centered above children
    const rootNode = nodes.find(n => n.id === 'root')!
    const childA = nodes.find(n => n.id === 'a')!
    const childB = nodes.find(n => n.id === 'b')!

    expect(rootNode.y).toBe(0)
    expect(childA.y).toBe(NODE_HEIGHT + VERTICAL_GAP)
    expect(childB.y).toBe(NODE_HEIGHT + VERTICAL_GAP)

    // Children side by side
    expect(childA.x).toBe(0)
    expect(childB.x).toBe(NODE_WIDTH + HORIZONTAL_GAP)

    // Root centered: midpoint of subtree
    const expectedRootX = (width - NODE_WIDTH) / 2
    expect(rootNode.x).toBe(expectedRootX)
  })

  it('three-level tree → correct depth-based y positions', () => {
    const c1 = leaf('c1')
    const c2 = leaf('c2')
    const mid = parent('mid', [c1, c2])
    const root = parent('root', [mid])

    const { nodes, height } = computeLayout(root, new Set())

    expect(nodes).toHaveLength(4)
    expect(height).toBe(NODE_HEIGHT * 3 + VERTICAL_GAP * 2)

    const rootNode = nodes.find(n => n.id === 'root')!
    const midNode = nodes.find(n => n.id === 'mid')!
    const c1Node = nodes.find(n => n.id === 'c1')!

    expect(rootNode.y).toBe(0)
    expect(midNode.y).toBe(NODE_HEIGHT + VERTICAL_GAP)
    expect(c1Node.y).toBe((NODE_HEIGHT + VERTICAL_GAP) * 2)
  })

  it('collapse toggle → children hidden, dimensions shrink', () => {
    const a = leaf('a')
    const b = leaf('b')
    const root = parent('root', [a, b])

    // Expanded
    const expanded = computeLayout(root, new Set())
    expect(expanded.nodes).toHaveLength(3)
    expect(expanded.edges).toHaveLength(2)
    expect(expanded.width).toBe(NODE_WIDTH * 2 + HORIZONTAL_GAP)

    // Collapsed
    const collapsed = computeLayout(root, new Set(['root']))
    expect(collapsed.nodes).toHaveLength(1)
    expect(collapsed.edges).toHaveLength(0)
    expect(collapsed.width).toBe(NODE_WIDTH)
    expect(collapsed.height).toBe(NODE_HEIGHT)

    // Root node is flagged as collapsed
    expect(collapsed.nodes[0].collapsed).toBe(true)
    expect(collapsed.nodes[0].hasChildren).toBe(true)
  })

  it('edge points: parent bottom-center → child top-center', () => {
    const a = leaf('a')
    const root = parent('root', [a])

    const { edges, nodes } = computeLayout(root, new Set())
    const edge = edges[0]
    const rootNode = nodes.find(n => n.id === 'root')!
    const childNode = nodes.find(n => n.id === 'a')!

    // From parent bottom-center
    expect(edge.x1).toBe(rootNode.x + NODE_WIDTH / 2)
    expect(edge.y1).toBe(rootNode.y + NODE_HEIGHT)

    // To child top-center
    expect(edge.x2).toBe(childNode.x + NODE_WIDTH / 2)
    expect(edge.y2).toBe(childNode.y)
  })
})

describe('useTraceLayout hook', () => {
  it('toggleCollapse toggles nodes in and out of collapsed set', () => {
    const a = leaf('a')
    const b = leaf('b')
    const root = parent('root', [a, b])

    const { result } = renderHook(() => useTraceLayout(root))

    // Initially expanded: 3 nodes
    expect(result.current.nodes).toHaveLength(3)

    // Collapse root
    act(() => result.current.toggleCollapse('root'))
    expect(result.current.nodes).toHaveLength(1)
    expect(result.current.width).toBe(NODE_WIDTH)

    // Expand again
    act(() => result.current.toggleCollapse('root'))
    expect(result.current.nodes).toHaveLength(3)
  })
})
