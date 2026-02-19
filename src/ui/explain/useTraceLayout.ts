import { useState, useMemo, useSyncExternalStore } from 'react'
import type { ComputeTrace } from '../../rules/engine.ts'

// ── Layout config ───────────────────────────────────────────────

export interface LayoutConfig {
  nodeWidth: number
  nodeHeight: number
  hGap: number
  vGap: number
}

const DESKTOP: LayoutConfig = { nodeWidth: 260, nodeHeight: 80, hGap: 40, vGap: 60 }
const MOBILE: LayoutConfig = { nodeWidth: 180, nodeHeight: 64, hGap: 24, vGap: 40 }

// Legacy exports for any external consumers
export const NODE_WIDTH = DESKTOP.nodeWidth
export const NODE_HEIGHT = DESKTOP.nodeHeight
export const HORIZONTAL_GAP = DESKTOP.hGap
export const VERTICAL_GAP = DESKTOP.vGap

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

function subtreeWidth(trace: ComputeTrace, collapsed: Set<string>, cfg: LayoutConfig): number {
  if (trace.inputs.length === 0 || collapsed.has(trace.nodeId)) {
    return cfg.nodeWidth
  }
  const childrenWidth = trace.inputs.reduce(
    (sum, child) => sum + subtreeWidth(child, collapsed, cfg),
    0,
  )
  return childrenWidth + (trace.inputs.length - 1) * cfg.hGap
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
  cfg: LayoutConfig,
): void {
  const sw = subtreeWidth(trace, collapsed, cfg)
  const hasChildren = trace.inputs.length > 0
  const isCollapsed = collapsed.has(trace.nodeId)
  const showChildren = hasChildren && !isCollapsed

  const x = x0 + sw / 2 - cfg.nodeWidth / 2
  const y = depth * (cfg.nodeHeight + cfg.vGap)

  nodes.push({
    id: trace.nodeId,
    x,
    y,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    trace,
    collapsed: isCollapsed,
    hasChildren,
  })

  if (showChildren) {
    let childX = x0
    for (const child of trace.inputs) {
      const csw = subtreeWidth(child, collapsed, cfg)
      layoutTree(child, collapsed, childX, depth + 1, nodes, edges, cfg)

      const childNodeX = childX + csw / 2 - cfg.nodeWidth / 2
      edges.push({
        from: trace.nodeId,
        to: child.nodeId,
        x1: x + cfg.nodeWidth / 2,
        y1: y + cfg.nodeHeight,
        x2: childNodeX + cfg.nodeWidth / 2,
        y2: (depth + 1) * (cfg.nodeHeight + cfg.vGap),
      })

      childX += csw + cfg.hGap
    }
  }
}

/** Pure layout computation — exported for testing. */
export function computeLayout(trace: ComputeTrace, collapsed: Set<string>, cfg: LayoutConfig = DESKTOP) {
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []
  const width = subtreeWidth(trace, collapsed, cfg)
  const md = maxDepth(trace, collapsed)
  const height = (md + 1) * cfg.nodeHeight + md * cfg.vGap

  layoutTree(trace, collapsed, 0, 0, nodes, edges, cfg)

  return { nodes, edges, width, height }
}

// ── Media query hook ────────────────────────────────────────────

const mql = typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)') : null

function subscribeMedia(cb: () => void) {
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}
function getIsDesktop() {
  return mql?.matches ?? true
}

// ── Hook ────────────────────────────────────────────────────────

export function useTraceLayout(trace: ComputeTrace) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const isDesktop = useSyncExternalStore(subscribeMedia, getIsDesktop, () => true)
  const cfg = isDesktop ? DESKTOP : MOBILE

  const { nodes, edges, width, height } = useMemo(
    () => computeLayout(trace, collapsed, cfg),
    [trace, collapsed, cfg],
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
