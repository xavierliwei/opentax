/**
 * Thin API client for PUT /api/v1/deductions.
 *
 * Fire-and-forget — same pattern as the POST /api/v1/sync calls in syncAdapter.
 * `onVersionUpdate` keeps syncAdapter's localVersion in sync so SSE events
 * for the same version are correctly ignored.
 */

let serverUrl: string | null = null
let onVersionUpdate: ((v: number) => void) | null = null

export function configureDeductionsApi(url: string, cb: (v: number) => void) {
  serverUrl = url
  onVersionUpdate = cb
}

export function clearDeductionsApi() {
  serverUrl = null
  onVersionUpdate = null
}

export function putDeductions(payload: {
  method?: 'standard' | 'itemized'
  itemized?: Record<string, unknown>
}): void {
  if (!serverUrl) return // standalone mode — no-op
  fetch(`${serverUrl}/api/v1/deductions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.stateVersion != null) onVersionUpdate?.(data.stateVersion)
    })
    .catch((err) => console.warn('[deductionsApi] PUT failed:', err))
}
