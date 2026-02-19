import type { LayoutNode } from './useTraceLayout.ts'
import { NODE_WIDTH, NODE_HEIGHT } from './useTraceLayout.ts'

interface TraceNodeProps {
  node: LayoutNode
  onToggle: () => void
}

function formatDollars(amountInCents: number): string {
  const d = amountInCents / 100
  const abs = Math.abs(d)
  const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return d < 0 ? `-$${formatted}` : `$${formatted}`
}

function sourceColor(kind: string): { bg: string; border: string } {
  switch (kind) {
    case 'computed':
      return { bg: '#eff6ff', border: '#3b82f6' }
    case 'document':
      return { bg: '#f0fdf4', border: '#22c55e' }
    default:
      return { bg: '#f9fafb', border: '#9ca3af' }
  }
}

export function TraceNode({ node, onToggle }: TraceNodeProps) {
  const { bg, border } = sourceColor(node.trace.output.source.kind)

  return (
    <foreignObject x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT}>
      <div
        style={{
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          backgroundColor: bg,
          border: `2px solid ${border}`,
          borderRadius: 8,
          padding: '8px 12px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'center',
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
        }}
        data-testid={`trace-node-${node.id}`}
      >
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.trace.label}
          {node.hasChildren && (
            <button
              onClick={onToggle}
              style={{ marginLeft: 6, cursor: 'pointer', fontSize: 11, color: '#6b7280', background: 'none', border: 'none' }}
              data-testid={`toggle-${node.id}`}
            >
              {node.collapsed ? '\u25B6' : '\u25BC'}
            </button>
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          {formatDollars(node.trace.output.amount)}
        </div>
        {node.trace.irsCitation && (
          <div style={{ fontSize: 11, color: '#6b7280' }}>{node.trace.irsCitation}</div>
        )}
      </div>
    </foreignObject>
  )
}
