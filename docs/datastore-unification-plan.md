# Datastore Unification Plan

## Current State

### Architecture Diagram

```
                       +-------------------------------+
                       |        TaxService             |
                       |  (openclaw-plugin/service/     |
                       |   TaxService.ts)              |
                       |                               |
                       |  constructor(workspace: str)  |
                       |  DB = workspace/opentax.db    |
                       +------+----------------+-------+
                              |                |
              +---------------+                +------------------+
              |                                                   |
  +-----------v-----------+                      +----------------v---------+
  |  (A) Local Dev Server |                      |  (B) OpenClaw Plugin     |
  |  server/main.ts       |                      |  openclaw-plugin/index.ts|
  |                       |                      |                          |
  |  workspace =          |                      |  workspace =             |
  |    OPENTAX_WORKSPACE  |                      |    pluginConfig.workspace|
  |    ?? '.'             |                      |    ?? api.resolvePath('.')|
  |                       |                      |                          |
  |  port = 7891          |                      |  port = 7890 (default)   |
  |  static = ./dist      |                      |  static = resolved       |
  +-----------+-----------+                      +----------------+---------+
              |                                                   |
              v                                                   v
  +-------------------+                            +-------------------+
  | ./opentax.db      |                            | <ocWorkspace>/    |
  | (project root)    |                            | opentax.db        |
  +-------------------+                            +-------------------+

  +--------------------------------------------------------------+
  |                     Frontend (Browser)                        |
  |                                                               |
  |  Zustand store + IndexedDB (opentax / state / taxReturn)     |
  |                                                               |
  |  syncAdapter.ts autoConnect():                                |
  |    tries VITE_DASHBOARD_API                                   |
  |    ?? window.location.origin (if port != 5173)                |
  |    ?? http://localhost:7891                                    |
  |                                                               |
  |  On connect: pushes local data OR pulls server data           |
  |  Ongoing: POST /api/sync + SSE /api/events                   |
  +--------------------------------------------------------------+
```

### Storage Layers (three total)

| Layer | Technology | Location | Runtime |
|-------|-----------|----------|---------|
| **Backend SQLite** (A) | better-sqlite3 v12 | `<project-root>/opentax.db` | Local dev (`npm run dev`) |
| **Backend SQLite** (B) | better-sqlite3 v11 | `<openclaw-workspace>/opentax.db` | OpenClaw plugin runtime |
| **Frontend IndexedDB** | idb v8 + Zustand persist | Browser IndexedDB `opentax` | Both (any browser tab) |

### Initialization Logic

#### Backend (both modes share `TaxService` constructor)

File: `openclaw-plugin/service/TaxService.ts:56-112`

1. Creates `workspace` directory if missing (line 62)
2. Opens `<workspace>/opentax.db` with WAL mode (lines 65-67)
3. Creates `tax_returns` table with schema: `id TEXT PK, data TEXT, version INT, updated_at TEXT` (lines 69-76)
4. Checks for legacy `opentax-state.json` migration (lines 84-99)
5. Loads existing row `WHERE id = 'current'` or creates `emptyTaxReturn(2025)` (lines 100-108)

#### Frontend

File: `src/store/taxStore.ts:124-160, 855-916`

1. Zustand store persists `taxReturn` to IndexedDB database `opentax`, object store `state`, key `taxReturn:opentax-store`
2. On rehydration: merges with `emptyTaxReturn()` defaults for forward-compatibility

File: `src/store/syncAdapter.ts:143-176`

3. `autoConnect()` called on mount from `AppShell.tsx:11` and `DashboardLayout.tsx:11`
4. Probes backend at detected URL with 2s timeout
5. If reachable: establishes bidirectional sync (initial merge + SSE + POST)

### Workspace Resolution

| Mode | Code Location | Default Workspace | Resulting DB Path |
|------|--------------|-------------------|-------------------|
| **Local dev** (`npm run dev`) | `server/main.ts:4` | `process.env.OPENTAX_WORKSPACE ?? '.'` | `./opentax.db` (project root) |
| **OpenClaw plugin** | `openclaw-plugin/index.ts:40` | `pluginConfig.workspace ?? api.resolvePath('.')` | `<openclaw-workspace>/opentax.db` |

---

## Root Cause of Divergence

**The data stores diverge because the two runtime modes resolve `workspace` to different directories by default.**

Specifically:

1. **Local dev server** (`server/main.ts:4`): `workspace` defaults to `'.'` which is the project root (`/Users/.../opentax/`). The database lives at `/Users/.../opentax/opentax.db`.

2. **OpenClaw plugin** (`openclaw-plugin/index.ts:40`): `workspace` defaults to `api.resolvePath('.')` which resolves to OpenClaw's per-workspace directory (typically something like `~/.openclaw/workspaces/<id>/` or wherever OpenClaw stores plugin state). The database lives at `<openclaw-workspace>/opentax.db`.

3. **Frontend IndexedDB**: Always uses the browser's origin-scoped IndexedDB. When the frontend is served by dev Vite (port 5173), it syncs to `localhost:7891`. When served by the plugin's HTTP service, it syncs to that plugin's port. These are separate browser origins with separate IndexedDB instances.

The result: **three independent copies of tax return data can exist simultaneously**, and data entered in one mode is invisible to the others unless explicit sync occurs.

### Why the sync adapter doesn't fully bridge the gap

The `syncAdapter.ts` auto-connect logic (lines 151-155) tries to detect the right backend:
```typescript
const url = serverUrl
  ?? import.meta.env.VITE_DASHBOARD_API
  ?? (window.location.port !== '5173' ? window.location.origin : 'http://localhost:7891')
```

This means:
- Vite dev server (port 5173) syncs to `localhost:7891` (local dev backend)
- Plugin-served frontend syncs to the plugin's origin (plugin backend)
- The two backends never sync to each other

---

## Phased Fix Plan

### Phase 0 (Immediate / No-risk) - Documentation & Observability

**Goal**: Make the divergence visible so users don't silently lose data.

1. **Log the resolved DB path on startup** in `TaxService` constructor:
   ```typescript
   console.log(`[TaxService] Using database: ${dbPath}`)
   ```
   This is a one-line instrumentation patch (low risk). Already partially exists at line 96 for migration logging.

2. **Add a `/api/debug/info` endpoint** returning `{ workspace, dbPath, stateVersion }` for diagnostics.

### Phase 1 (Short-term) - Unify Default Workspace

**Goal**: Both modes use the same database file by default when running on the same machine.

**Option A (Recommended)**: Use a well-known fixed path for the database.

- Define `OPENTAX_DB_DIR` as `~/.opentax/` (XDG-style user data directory)
- Both `server/main.ts` and `openclaw-plugin/index.ts` default to this path
- Environment variable `OPENTAX_WORKSPACE` still overrides for dev/test

Changes required:
| File | Change |
|------|--------|
| `server/main.ts:4` | `const workspace = process.env.OPENTAX_WORKSPACE ?? join(homedir(), '.opentax')` |
| `openclaw-plugin/index.ts:40` | `const workspace = (cfg.workspace as string) ?? process.env.OPENTAX_WORKSPACE ?? join(homedir(), '.opentax')` |

**Option B** (Alternative): Plugin sets `workspace` to project root via config.

- Requires users to configure `openclaw.json` with `"workspace": "/path/to/opentax"`
- Fragile and not portable

**Recommendation**: Option A. It decouples the DB from the source tree (good practice) and makes both modes converge automatically.

### Phase 2 (Medium-term) - Frontend Origin Unification

**Goal**: Browser IndexedDB data is consistent regardless of which port serves the frontend.

- The frontend already syncs bidirectionally with whatever backend it connects to
- If Phase 1 unifies the backend DB, the frontend will always sync against the same data regardless of which server process serves it
- No frontend code changes needed for this phase

### Phase 3 (Long-term) - Single Source of Truth

**Goal**: Eliminate the potential for stale IndexedDB data diverging from the backend.

Options:
1. **Backend-authoritative**: Frontend always fetches from backend on load; IndexedDB becomes a read cache only. Simplifies conflict resolution.
2. **Keep current bidirectional sync**: Acceptable if Phase 1 eliminates backend divergence. The sync adapter's merge logic (push-if-local-has-data, pull-if-server-has-data) is already reasonable.

**Recommendation**: Keep current bidirectional sync (option 2). It enables offline-first usage and the sync adapter already handles the common cases. Phase 1 is the critical fix.

---

## Compatibility & Migration Steps

### Migrating existing data after Phase 1

When the default workspace changes from `'.'` to `~/.opentax/`:

1. **TaxService already handles migration from JSON** (lines 84-99). Extend this pattern:
   - On first startup with `~/.opentax/`, check if `./opentax.db` exists in the CWD
   - If so, copy it to `~/.opentax/opentax.db` (only if destination is empty)
   - Log: `[TaxService] Migrated database from ./opentax.db to ~/.opentax/opentax.db`

2. **OpenClaw plugin migration**:
   - Check if `<openclaw-workspace>/opentax.db` exists
   - If so, merge: load both DBs, compare `version` field, keep the one with higher version
   - Or: prompt user to choose via agent tool

3. **Frontend IndexedDB**:
   - No migration needed. On next connect, the sync adapter will pull from the unified backend.
   - If both IndexedDB and the new unified DB have data, the existing merge logic applies: local-has-data wins (pushes to server).

### Backward compatibility

- `OPENTAX_WORKSPACE` env var continues to work as an override
- `pluginConfig.workspace` in OpenClaw config continues to work
- Old `./opentax.db` files are not deleted (user can manually remove)
- Legacy `opentax-state.json` migration is unaffected

### Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss during migration | Low | High | Copy-not-move; version comparison; backup prompt |
| SQLite version mismatch (v11 vs v12) | Low | Medium | Both use compatible schema; WAL mode works across versions |
| Two processes writing same DB | Medium | High | SQLite WAL handles concurrent readers; only one writer should be active. Document: don't run both modes simultaneously against same DB. |
| IndexedDB stale after workspace change | Low | Low | Sync adapter overwrites on connect |

---

## Tests & Verification Strategy

### Unit tests

1. **TaxService workspace resolution test**: Instantiate `TaxService` with explicit workspace path, verify `opentax.db` created in correct location.
2. **Migration test**: Place a `./opentax.db` in a temp dir, instantiate `TaxService` with `~/.opentax/`, verify data migrated.
3. **Version conflict test**: Create two DBs with different versions, verify higher version wins during merge.

### Integration tests

4. **Dev server smoke test**:
   ```bash
   OPENTAX_WORKSPACE=/tmp/test-opentax npm run dev
   # Verify: ls /tmp/test-opentax/opentax.db exists
   # Verify: curl localhost:7891/api/status returns valid JSON
   ```

5. **Cross-mode consistency test**:
   ```bash
   # Start dev server with unified workspace
   OPENTAX_WORKSPACE=~/.opentax npm start &
   # Add data via API
   curl -X POST localhost:7891/api/sync -d '{"taxReturn":{...},"stateVersion":0}'
   # Stop server, start plugin mode with same workspace
   # Verify: plugin reads the same data
   ```

6. **Concurrent access test**:
   - Start two TaxService instances against same DB
   - Verify SQLite WAL allows concurrent reads
   - Verify only one writer succeeds (or both succeed with WAL)

### Manual verification checklist

- [ ] `npm run dev` creates DB at new default location
- [ ] OpenClaw plugin creates/reads DB at same location
- [ ] Data entered in dev mode visible in plugin mode (and vice versa)
- [ ] Frontend sync works correctly after workspace change
- [ ] Old `./opentax.db` data migrated on first run
- [ ] `OPENTAX_WORKSPACE` override still works
- [ ] `pluginConfig.workspace` override still works

---

## Summary of Findings

| Question | Answer |
|----------|--------|
| Are backends shared? | **No.** By default, local dev uses `./opentax.db` (project root) and OpenClaw plugin uses `<openclaw-workspace>/opentax.db` (a different directory). |
| Are frontends shared? | **No.** Different ports = different browser origins = separate IndexedDB instances. |
| Can they sync? | **Partially.** The frontend sync adapter bridges frontend-to-backend, but the two backends are independent. |
| Root cause | Default `workspace` resolution differs: `'.'` vs `api.resolvePath('.')` |
| Fix complexity | **Low.** Converge both defaults to `~/.opentax/`. ~5 lines of code change + migration logic. |

### Key source files

| File | Lines | Role |
|------|-------|------|
| `server/main.ts` | 4 | Dev mode workspace default (`'.'`) |
| `openclaw-plugin/index.ts` | 40 | Plugin mode workspace default (`api.resolvePath('.')`) |
| `openclaw-plugin/service/TaxService.ts` | 56-112 | DB init, schema, migration |
| `openclaw-plugin/http/httpService.ts` | 39-226 | HTTP API serving both modes |
| `src/store/syncAdapter.ts` | 143-155 | Frontend auto-connect URL detection |
| `src/store/taxStore.ts` | 124-160 | Frontend IndexedDB persistence |
