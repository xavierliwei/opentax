/**
 * Vitest global setup — provides browser API stubs that pdfjs-dist and
 * UI code rely on at module-load time.  These stubs are intentionally
 * minimal: just enough to prevent ReferenceErrors in Node / jsdom
 * without affecting runtime behaviour in real browsers.
 */

// ── DOMMatrix (required by pdfjs-dist at import time) ────────────
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error — intentionally minimal stub
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      return new Proxy(this, {
        get: (_t, prop) => {
          if (typeof prop === 'string' && /^[a-f]$/.test(prop)) return 0
          if (prop === 'isIdentity') return true
          if (typeof prop === 'string' && prop.startsWith('multiply')) return () => new DOMMatrix()
          if (typeof prop === 'string' && prop.startsWith('translate')) return () => new DOMMatrix()
          if (typeof prop === 'string' && prop.startsWith('scale')) return () => new DOMMatrix()
          if (typeof prop === 'string' && prop.startsWith('rotate')) return () => new DOMMatrix()
          if (typeof prop === 'string' && prop.startsWith('inverse')) return () => new DOMMatrix()
          if (prop === 'transformPoint') return () => ({ x: 0, y: 0, z: 0, w: 1 })
          return undefined
        },
      })
    }
    static fromMatrix() { return new DOMMatrix() }
    static fromFloat64Array() { return new DOMMatrix() }
    static fromFloat32Array() { return new DOMMatrix() }
  }
}

// ── matchMedia (required by useTraceLayout.ts at module scope) ───
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
}
