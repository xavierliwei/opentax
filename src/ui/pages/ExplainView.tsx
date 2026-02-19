import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'
import { buildTrace, explainLine, NODE_LABELS, type ComputeTrace } from '../../rules/engine.ts'
import { useTraceLayout } from '../explain/useTraceLayout.ts'
import { TraceNode } from '../explain/TraceNode.tsx'
import { TraceEdge } from '../explain/TraceEdge.tsx'

const PADDING = 24
const MIN_ZOOM = 0.1
const MAX_ZOOM = 3

/** Recursively remove child nodes whose output amount is 0. */
function pruneZeroInputs(trace: ComputeTrace): ComputeTrace {
  return {
    ...trace,
    inputs: trace.inputs
      .filter((child) => child.output.amount !== 0)
      .map(pruneZeroInputs),
  }
}

export function ExplainView() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const computeResult = useTaxStore((s) => s.computeResult)

  const effectiveNodeId = nodeId ?? ''
  const trace = useMemo(
    () => pruneZeroInputs(buildTrace(computeResult, effectiveNodeId)),
    [computeResult, effectiveNodeId],
  )
  const { nodes, edges, width, height, toggleCollapse } = useTraceLayout(trace)
  const textExplanation = useMemo(
    () => explainLine(computeResult, effectiveNodeId),
    [computeResult, effectiveNodeId],
  )

  const heading = NODE_LABELS[effectiveNodeId] ?? trace.label

  // ── View state ──────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: PADDING, y: PADDING })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Refs so imperative handlers (wheel, global mousemove) always see latest values
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  zoomRef.current = zoom
  panRef.current = pan

  // Drag anchor: initial mouse position + initial pan at drag start
  const dragAnchorRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })

  // ── Fit to view ─────────────────────────────────────────────────
  const fitToView = useCallback(() => {
    const el = containerRef.current
    if (!el || width === 0 || height === 0) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    const newZoom = Math.min((cw - PADDING * 2) / width, (ch - PADDING * 2) / height, 1)
    setZoom(newZoom)
    setPan({ x: (cw - width * newZoom) / 2, y: PADDING })
  }, [width, height])

  // Auto-fit once per trace (not on every collapse/expand)
  const needsFitRef = useRef(true)
  useEffect(() => { needsFitRef.current = true }, [effectiveNodeId])
  useEffect(() => {
    if (!needsFitRef.current || width === 0 || height === 0) return
    needsFitRef.current = false
    fitToView()
  }, [width, height, fitToView])

  // ── Wheel zoom (non-passive, centered on cursor) ─────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const oldZoom = zoomRef.current
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor))
      const r = newZoom / oldZoom
      const oldPan = panRef.current
      setZoom(newZoom)
      setPan({ x: cx - (cx - oldPan.x) * r, y: cy - (cy - oldPan.y) * r })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, []) // stable — reads latest values via refs

  // ── Mouse drag pan ──────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    dragAnchorRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y }
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return
    const { mouseX, mouseY, panX, panY } = dragAnchorRef.current
    const onMove = (e: MouseEvent) => {
      setPan({ x: panX + (e.clientX - mouseX), y: panY + (e.clientY - mouseY) })
    }
    const onUp = () => setIsDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  // ── Touch pan + pinch-to-zoom ─────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let lastTouchX = 0
    let lastTouchY = 0
    let lastPinchDist = 0

    function dist(a: Touch, b: Touch) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX
        lastTouchY = e.touches[0].clientY
      } else if (e.touches.length === 2) {
        lastPinchDist = dist(e.touches[0], e.touches[1])
        lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouchX
        const dy = e.touches[0].clientY - lastTouchY
        lastTouchX = e.touches[0].clientX
        lastTouchY = e.touches[0].clientY
        setPan(p => ({ x: p.x + dx, y: p.y + dy }))
      } else if (e.touches.length === 2) {
        const newDist = dist(e.touches[0], e.touches[1])
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        const cx = midX - rect.left
        const cy = midY - rect.top

        // Pan
        const dx = midX - lastTouchX
        const dy = midY - lastTouchY
        lastTouchX = midX
        lastTouchY = midY

        // Pinch zoom
        if (lastPinchDist > 0) {
          const factor = newDist / lastPinchDist
          const oldZoom = zoomRef.current
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor))
          const r = newZoom / oldZoom
          setZoom(newZoom)
          setPan(p => ({ x: cx - (cx - p.x - dx) * r, y: cy - (cy - p.y - dy) * r }))
        } else {
          setPan(p => ({ x: p.x + dx, y: p.y + dy }))
        }
        lastPinchDist = newDist
      }
    }

    const onTouchEnd = () => {
      lastPinchDist = 0
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // ── Keyboard ───────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent) {
    const PAN = 60
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault()
        setZoom(z => Math.min(MAX_ZOOM, z * 1.2))
        break
      case '-':
        e.preventDefault()
        setZoom(z => Math.max(MIN_ZOOM, z / 1.2))
        break
      case 'ArrowLeft':
        e.preventDefault()
        setPan(p => ({ ...p, x: p.x + PAN }))
        break
      case 'ArrowRight':
        e.preventDefault()
        setPan(p => ({ ...p, x: p.x - PAN }))
        break
      case 'ArrowUp':
        e.preventDefault()
        setPan(p => ({ ...p, y: p.y + PAN }))
        break
      case 'ArrowDown':
        e.preventDefault()
        setPan(p => ({ ...p, y: p.y - PAN }))
        break
      case '0':
        e.preventDefault()
        fitToView()
        break
    }
  }

  return (
    <div data-testid="page-explain">
      <Link to="/review" className="text-sm text-tax-blue hover:text-blue-700">
        &larr; Back to Review
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">{heading}</h1>
      <p className="mt-1 text-sm text-gray-600">
        Trace showing how this value was computed from source documents.
      </p>

      {/* Toolbar */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.2))}
          className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded-md hover:bg-gray-50 text-lg font-medium leading-none select-none"
          title="Zoom out (−)"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: PADDING, y: PADDING }) }}
          className="h-8 px-2 text-xs font-mono border border-gray-200 rounded-md hover:bg-gray-50 w-14 text-center tabular-nums"
          title="Reset to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))}
          className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded-md hover:bg-gray-50 text-lg font-medium leading-none select-none"
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={fitToView}
          className="h-8 px-3 text-xs font-medium border border-gray-200 rounded-md hover:bg-gray-50"
          title="Fit to view (0)"
        >
          Fit
        </button>
        <span className="text-xs text-gray-400 ml-1 hidden sm:inline">
          Scroll or +/− to zoom · Drag or arrow keys to pan · 0 to fit
        </span>
        <span className="text-xs text-gray-400 ml-1 sm:hidden">
          Drag to pan · Pinch to zoom
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`mt-2 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ height: 'clamp(280px, 55vh, 800px)' }}
        tabIndex={0}
        aria-label="Trace diagram. Drag to pan, scroll to zoom, arrow keys to navigate, 0 to fit."
        data-testid="trace-svg-container"
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      >
        <svg width="100%" height="100%" data-testid="trace-svg">
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
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
