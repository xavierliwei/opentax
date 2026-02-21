# UI Quick Wins Implementation Summary

Implementation of the top 3 quick-win improvements from `docs/ui-improvement-ideas-after-phase3.md`.

---

## Q1: LiveBalance state explain-link fix

**Problem:** `LiveBalance` hardcoded `form540.overpaid`/`form540.amountOwed` for all state pill "Why?" links. This breaks for non-CA states.

**Solution:** Added `getStateExplainNode()` helper that looks up the correct explain node ID from each state module's `reviewResultLines` config. The CA module continues to resolve to `form540.overpaid`/`form540.amountOwed`; future state modules will resolve to their own node IDs automatically.

**Changed files:**
- `src/ui/components/LiveBalance.tsx` — Import `getStateModule` and `SupportedStateCode`; add `getStateExplainNode()` helper; replace hardcoded `form540.*` with module-driven lookup.

**Screenshot notes:**
- CA pill "Why?" link → `/explain/form540.overpaid` (refund) or `/explain/form540.amountOwed` (owed) — same as before for CA.
- Future states will automatically pick up their own explain nodes from their module config.

---

## Q2: Federal Review cards include per-state amount/status

**Problem:** State cards on the Review page showed only a generic "computed" message and a link, without the refund/owed amount users care about.

**Solution:** Each state card now displays:
- **Status label**: "Refund", "Amount Owed", or "Balanced"
- **Formatted amount** (when nonzero)
- **Color coding**: green border/text for refund, red for owed, amber for balanced
- Retained "View {STATE} Return" link

**Changed files:**
- `src/ui/pages/ReviewPage.tsx` — State card rendering now computes `isRefund`/`isOwed`/status and applies conditional border/background colors. Added `data-testid` attributes for testing.

**Screenshot notes:**
- Refund card: green border, "Refund: $X,XXX.XX" in green text.
- Owed card: red border, "Amount Owed: $X,XXX.XX" in red text.
- Balanced card: amber border, "Balanced" in gray text.

---

## Q3: Download page pre-visible separate state actions

**Problem:** Separate state download buttons were hidden until after the first "Download All" generation, making them undiscoverable.

**Solution:** State download rows are now always visible when `stateResults.length > 0`:
- **Before generation**: Buttons are disabled with "Generate package first" helper text.
- **After generation**: Buttons become enabled and download the individual state PDF.
- Removed the old toggle-based "Download separately" UI (`showSeparate` state variable removed).

**Changed files:**
- `src/ui/pages/DownloadPage.tsx` — Replaced `statePackages.length > 0` gate with `stateResults.length > 0`; render disabled buttons with helper text pre-generation; enable when matching `statePackage` exists. Removed `showSeparate` state. Added `data-testid` attributes.

**Screenshot notes:**
- Before generation: "CA Form 540 PDF" button (grayed out) + "Generate package first" text.
- After generation: "CA Form 540 PDF" button (active, clickable).

---

## Tests

**New tests added:**

| Test file | Tests | Status |
|-----------|-------|--------|
| `tests/ui/components/LiveBalance.test.tsx` | `CA state pill links to form540 explain nodes (not hardcoded)` | Pass |
| `tests/ui/components/LiveBalance.test.tsx` | `CA owed state pill links to form540.amountOwed` | Pass |
| `tests/ui/pages/P27Pages.test.tsx` | `shows state card with refund status when CA has overpaid` | Pass |
| `tests/ui/pages/P27Pages.test.tsx` | `shows state card with amount owed when CA has underpaid` | Pass |
| `tests/ui/pages/P27Pages.test.tsx` | `shows View CA Return link in state card` | Pass |
| `tests/ui/pages/P27Pages.test.tsx` | `shows disabled state download button before generation when state return exists` | Pass |
| `tests/ui/pages/P27Pages.test.tsx` | `does not show state download section when no state returns` | Pass |
| `tests/ui/pages/P27Pages.test.tsx` | `shows Download All button label when state return exists` | Pass |

**Test environment fix:** Added `pdfjs-dist` mock to `P27Pages.test.tsx` to resolve pre-existing `DOMMatrix is not defined` error in the test runner.

## Build/Test Results

- `npm run build`: Clean (tsc + vite build)
- LiveBalance tests: **8/8 pass**
- P27Pages tests: **26/29 pass** (3 pre-existing failures in RSUIncomePage/DeductionsPage unrelated to these changes)

---

## Remaining TODOs

- When new state modules (NY, NJ, etc.) are added, their `reviewResultLines` will automatically be picked up by `getStateExplainNode()` — no further LiveBalance changes needed.
- The 3 pre-existing test failures in `P27Pages.test.tsx` (RSUIncomePage add/remove, DeductionsPage itemized switch) should be fixed separately.
- Consider adding visual regression tests (screenshot-based) for the new state card colors on ReviewPage.
