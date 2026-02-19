# OpenTax

Open-source tax preparation with transparent computation and full explainability.

## Quick start

### Standalone (no OpenClaw needed)

```bash
npm install
npm run dev
```

This starts the Vite frontend (:5173) and backend API (:7891) together with hot reload on both. Open http://localhost:5173.

### Production

```bash
npm run build
npm start
```

Backend serves the built frontend at http://localhost:7891.

### As an OpenClaw plugin

The `openclaw-plugin/` directory works as a standalone OpenClaw extension. The plugin runs the backend on port 7890. See `openclaw-plugin/README.md` for details.

## Configuration

Environment variables for `npm start` / `npm run dev`:

| Variable | Default | Description |
|---|---|---|
| `OPENTAX_PORT` | `7891` | Backend API port |
| `OPENTAX_WORKSPACE` | `.` | Directory for SQLite database |
| `OPENTAX_STATIC_DIR` | `./dist` | Built frontend directory |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Frontend + backend with hot reload |
| `npm run dev:fe` | Frontend only (no backend) |
| `npm start` | Production backend (serves built frontend) |
| `npm run build` | TypeScript check + Vite build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright) |

## Testing

```bash
npm test                # unit tests
npm run test:e2e        # headless e2e (requires: npx playwright install)
npm run test:e2e:ui     # interactive e2e runner
```

## Architecture

- `src/` — React frontend (Vite + Tailwind + Zustand)
- `src/rules/engine.ts` — deterministic tax computation engine
- `openclaw-plugin/` — OpenClaw plugin (TaxService, HTTP API, tool definitions)
- `server/main.ts` — standalone entry point reusing the plugin's TaxService + HTTP layer

State is persisted to SQLite. The frontend auto-connects to the backend API and syncs via REST + SSE.
