import type { LayoutEdge } from './useTraceLayout.ts'

interface TraceEdgeProps {
  edge: LayoutEdge
}

export function TraceEdge({ edge }: TraceEdgeProps) {
  const midY = (edge.y1 + edge.y2) / 2
  const d = `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY} ${edge.x2} ${midY} ${edge.x2} ${edge.y2}`

  return (
    <path
      d={d}
      fill="none"
      stroke="#d1d5db"
      strokeWidth={2}
      data-testid={`trace-edge-${edge.from}-${edge.to}`}
    />
  )
}
