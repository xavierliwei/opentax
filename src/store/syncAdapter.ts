/**
 * Sync adapter — connects the P2 Zustand store to the plugin HTTP API.
 *
 * Subscribes to Zustand state changes → POST /api/sync
 * Listens to SSE stateChanged events → imports into Zustand store
 * Loop guard prevents SSE-triggered mutations from POST-ing back.
 */

import { useTaxStore } from './taxStore.ts'
import type { TaxReturn } from '../model/types.ts'

export interface SyncConfig {
  serverUrl: string
}

export function connectToServer(config: SyncConfig): () => void {
  const { serverUrl } = config
  let isRemoteUpdate = false
  let localVersion = 0
  let lastTaxReturnRef = useTaxStore.getState().taxReturn

  function importRemote(taxReturn: TaxReturn, stateVersion: number) {
    isRemoteUpdate = true
    localVersion = stateVersion
    useTaxStore.getState().importReturn(taxReturn)
    lastTaxReturnRef = useTaxStore.getState().taxReturn
    isRemoteUpdate = false
  }

  // ── Initial sync: merge intelligently ─────────────────────────
  fetch(`${serverUrl}/api/status`)
    .then((res) => res.json())
    .then((data: { taxReturn: TaxReturn; stateVersion: number }) => {
      const localState = useTaxStore.getState()
      const localHasData = localState.taxReturn.w2s.length > 0 ||
        localState.taxReturn.form1099INTs.length > 0 ||
        localState.taxReturn.form1099DIVs.length > 0 ||
        localState.taxReturn.capitalTransactions.length > 0 ||
        localState.taxReturn.taxpayer.firstName !== ''

      const serverHasData = data.stateVersion > 0

      if (serverHasData) {
        importRemote(data.taxReturn, data.stateVersion)
        console.info('[syncAdapter] Synced from server (v%d)', data.stateVersion)
      } else if (localHasData) {
        localVersion = data.stateVersion
        fetch(`${serverUrl}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxReturn: localState.taxReturn,
            stateVersion: localVersion,
          }),
        })
          .then((res) => res.json())
          .then((resp: { ok?: boolean; stateVersion?: number }) => {
            if (resp.stateVersion != null) localVersion = resp.stateVersion
            console.info('[syncAdapter] Pushed local data to server (v%d)', localVersion)
          })
          .catch((err) => console.warn('[syncAdapter] Initial push failed:', err))
      } else {
        localVersion = data.stateVersion
        console.info('[syncAdapter] Connected (both empty)')
      }
    })
    .catch((err) => {
      console.warn('[syncAdapter] Initial fetch failed:', err)
    })

  // ── Subscribe to local Zustand changes → POST to server ───────
  const unsubStore = useTaxStore.subscribe((state) => {
    // Always track the latest ref so remote imports don't leave it stale
    if (state.taxReturn === lastTaxReturnRef) return
    lastTaxReturnRef = state.taxReturn
    if (isRemoteUpdate) return

    fetch(`${serverUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taxReturn: state.taxReturn,
        stateVersion: localVersion,
      }),
    })
      .then((res) => res.json())
      .then((data: { ok?: boolean; stateVersion?: number }) => {
        if (data.stateVersion != null) {
          localVersion = data.stateVersion
        }
      })
      .catch((err) => {
        console.warn('[syncAdapter] POST failed:', err)
      })
  })

  // ── Listen to SSE for remote changes ──────────────────────────
  const eventSource = new EventSource(`${serverUrl}/api/events`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'stateChanged' && data.stateVersion > localVersion) {
        fetch(`${serverUrl}/api/status`)
          .then((res) => res.json())
          .then((status: { taxReturn: TaxReturn; stateVersion: number }) => {
            importRemote(status.taxReturn, status.stateVersion)
          })
          .catch((err) => {
            console.warn('[syncAdapter] SSE fetch failed:', err)
          })
      }
    } catch {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    console.warn('[syncAdapter] SSE connection error — will auto-reconnect')
  }

  // ── Cleanup function ──────────────────────────────────────────
  return () => {
    unsubStore()
    eventSource.close()
  }
}

/**
 * Auto-connect to the backend if it's reachable.
 * Probes the server with a lightweight fetch — if it responds, starts sync.
 * Safe to call on app startup; silently no-ops if backend is down.
 * Returns a cleanup function to disconnect (important for React strict mode).
 * Singleton — only one connection at a time.
 */
let activeDisconnect: (() => void) | null = null

export function autoConnect(serverUrl?: string): () => void {
  // Tear down any existing connection first (React strict mode double-mount)
  if (activeDisconnect) {
    activeDisconnect()
    activeDisconnect = null
  }

  const url = serverUrl ?? (import.meta.env.VITE_DASHBOARD_API as string | undefined) ?? 'http://localhost:7891'
  let aborted = false

  fetch(`${url}/api/gap-analysis`, { signal: AbortSignal.timeout(2000) })
    .then((res) => {
      if (res.ok && !aborted) {
        activeDisconnect = connectToServer({ serverUrl: url })
        console.info('[syncAdapter] Auto-connected to %s', url)
      }
    })
    .catch(() => {
      // Backend not running — that's fine, P2 works standalone
    })

  return () => {
    aborted = true
    if (activeDisconnect) {
      activeDisconnect()
      activeDisconnect = null
    }
  }
}
