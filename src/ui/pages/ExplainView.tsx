import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'
import { buildTrace, explainLine, NODE_LABELS } from '../../rules/engine.ts'
import { useTraceLayout } from '../explain/useTraceLayout.ts'
import { TraceNode } from '../explain/TraceNode.tsx'
import { TraceEdge } from '../explain/TraceEdge.tsx'

const PADDING = 20

export function ExplainView() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const computeResult = useTaxStore((s) => s.computeResult)

  const effectiveNodeId = nodeId ?? ''
  const trace = useMemo(
    () => buildTrace(computeResult, effectiveNodeId),
    [computeResult, effectiveNodeId],
  )
  const { nodes, edges, width, height, toggleCollapse } = useTraceLayout(trace)
  const textExplanation = useMemo(
    () => explainLine(computeResult, effectiveNodeId),
    [computeResult, effectiveNodeId],
  )

  const heading = NODE_LABELS[effectiveNodeId] ?? trace.label

  return (
    <div data-testid="page-explain">
      <Link to="/review" className="text-sm text-tax-blue hover:text-blue-700">
        &larr; Back to Review
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">{heading}</h1>
      <p className="mt-1 text-sm text-gray-600">
        Trace showing how this value was computed from source documents.
      </p>

      <div
        className="mt-4 overflow-auto border border-gray-200 rounded-lg bg-gray-50 p-4"
        data-testid="trace-svg-container"
      >
        <svg
          width={width + PADDING * 2}
          height={height + PADDING * 2}
          data-testid="trace-svg"
        >
          <g transform={`translate(${PADDING}, ${PADDING})`}>
            {edges.map((edge) => (
              <TraceEdge key={`${edge.from}-${edge.to}`} edge={edge} />
            ))}
            {nodes.map((node) => (
              <TraceNode
                key={node.id}
                node={node}
                onToggle={() => toggleCollapse(node.id)}
              />
            ))}
          </g>
        </svg>
      </div>

      <details className="mt-4" data-testid="trace-text-fallback">
        <summary className="text-sm text-gray-600 cursor-pointer">Text breakdown</summary>
        <pre className="mt-2 text-xs text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded border">
          {textExplanation}
        </pre>
      </details>
    </div>
  )
}
