import { useState, useMemo } from 'react'
import type { ComputeTrace } from '../../rules/engine.ts'

// ── Constants ───────────────────────────────────────────────────

export const NODE_WIDTH = 260
export const NODE_HEIGHT = 80
export const HORIZONTAL_GAP = 40
export const VERTICAL_GAP = 60

// ── Types ───────────────────────────────────────────────────────

export interface LayoutNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  trace: ComputeTrace
  collapsed: boolean
  hasChildren: boolean
}

export interface LayoutEdge {
  from: string
  to: string
  x1: number
  y1: number
  x2: number
  y2: number
}

// ── Pure layout functions ───────────────────────────────────────

function subtreeWidth(trace: ComputeTrace, collapsed: Set<string>): number {
  if (trace.inputs.length === 0 || collapsed.has(trace.nodeId)) {
    return NODE_WIDTH
  }
  const childrenWidth = trace.inputs.reduce(
    (sum, child) => sum + subtreeWidth(child, collapsed),
    0,
  )
  return childrenWidth + (trace.inputs.length - 1) * HORIZONTAL_GAP
}

function maxDepth(trace: ComputeTrace, collapsed: Set<string>): number {
  if (trace.inputs.length === 0 || collapsed.has(trace.nodeId)) {
    return 0
  }
  return 1 + Math.max(...trace.inputs.map(child => maxDepth(child, collapsed)))
}

function layoutTree(
  trace: ComputeTrace,
  collapsed: Set<string>,
  x0: number,
  depth: number,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): void {
  const sw = subtreeWidth(trace, collapsed)
  const hasChildren = trace.inputs.length > 0
  const isCollapsed = collapsed.has(trace.nodeId)
  const showChildren = hasChildren && !isCollapsed

  const x = x0 + sw / 2 - NODE_WIDTH / 2
  const y = depth * (NODE_HEIGHT + VERTICAL_GAP)

  nodes.push({
    id: trace.nodeId,
    x,
    y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    trace,
    collapsed: isCollapsed,
    hasChildren,
  })

  if (showChildren) {
    let childX = x0
    for (const child of trace.inputs) {
      const csw = subtreeWidth(child, collapsed)
      layoutTree(child, collapsed, childX, depth + 1, nodes, edges)

      const childNodeX = childX + csw / 2 - NODE_WIDTH / 2
      edges.push({
        from: trace.nodeId,
        to: child.nodeId,
        x1: x + NODE_WIDTH / 2,
        y1: y + NODE_HEIGHT,
        x2: childNodeX + NODE_WIDTH / 2,
        y2: (depth + 1) * (NODE_HEIGHT + VERTICAL_GAP),
      })

      childX += csw + HORIZONTAL_GAP
    }
  }
}

/** Pure layout computation — exported for testing. */
export function computeLayout(trace: ComputeTrace, collapsed: Set<string>) {
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []
  const width = subtreeWidth(trace, collapsed)
  const md = maxDepth(trace, collapsed)
  const height = (md + 1) * NODE_HEIGHT + md * VERTICAL_GAP

  layoutTree(trace, collapsed, 0, 0, nodes, edges)

  return { nodes, edges, width, height }
}

// ── Hook ────────────────────────────────────────────────────────

export function useTraceLayout(trace: ComputeTrace) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const { nodes, edges, width, height } = useMemo(
    () => computeLayout(trace, collapsed),
    [trace, collapsed],
  )

  function toggleCollapse(nodeId: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  return { nodes, edges, width, height, toggleCollapse }
}
