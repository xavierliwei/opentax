# OpenTax Frontend MVP

Frontend MVP for OpenTax focused on transparent workflow and deterministic mock outputs.

## Scope implemented

- Intake uploads page with W-2 / 1099 / RSU placeholders
- Guided interview flow page
- Compute + explain summary page
- Review / print checklist page
- Canonical frontend model in state for:
  - taxpayer profile
  - income events
  - documents
  - adjustments
  - form mappings
  - computation nodes
- Deterministic **mock** computation pipeline (explicitly not real tax calc)
- Clean routing + lightweight UI

## Tech

- React + TypeScript + Vite
- React Router

## Run locally

```bash
cd /Users/weili/opentax
npm install
npm run dev
```

Then open the local Vite URL (usually http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Testing setup

Unit tests (Vitest):

```bash
npm test
```

E2E tests (Playwright):

```bash
# one-time browser install
npx playwright install

# run headless e2e
npm run test:e2e

# optional interactive runner
npm run test:e2e:ui
```

## Notes

- This MVP is for product flow and explainability demo only.
- It does **not** implement IRS-accurate tax computation.
