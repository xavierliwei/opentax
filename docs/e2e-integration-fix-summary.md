# E2E Smoke Test Fix Summary

## Root Cause

The Playwright smoke test in `tests/e2e/smoke.spec.ts` was written against an
earlier MVP UI that no longer exists. Specifically:

| What the test expected | What the app actually has |
|------------------------|--------------------------|
| Route `/intake` | Route `/` (WelcomePage) |
| Heading "OpenTax MVP" | Heading "Welcome to OpenTax" |
| Heading "Intake Uploads" | No such heading — welcome page has a subtitle and a "Let's Start" button |
| Link "Guided Interview" | Button "Let's Start" navigates to `/interview/filing-status` |
| Link "Compute + Explain" | Sidebar link "Federal Review" navigates to `/review` |
| Link "Review / Print" | Sidebar link "Download" navigates to `/download` |

The app's navigation flow was refactored from a flat intake/interview/compute/review
layout into a guided interview with a sidebar stepper. The e2e test was never updated
to match.

**No genuine app navigation regressions were found.** All routes, sidebar links, and
page headings render correctly.

## Exact Changes

### `tests/e2e/smoke.spec.ts`

Rewrote the single smoke test to exercise the current workflow:

1. **Welcome page** — navigate to `/`, assert `data-testid="page-welcome"` and
   heading matching `/welcome.*opentax/i`.
2. **Start interview** — click the "Let's Start" `<button>` (was incorrectly a
   `<link>` selector in the first fix attempt), assert "Filing Status" heading.
3. **Federal Review** — click sidebar link matching `/federal review/i`, assert
   `data-testid="page-review"` and heading `/review your return/i`.
4. **Download** — click sidebar link matching `/download/i`, assert
   `data-testid="page-download"` and heading `/download your return/i`.

Resilience improvements:
- All heading assertions use case-insensitive regex (e.g., `/filing status/i`)
  instead of exact string matches, so minor copy tweaks won't break tests.
- `data-testid` attributes are used alongside headings for structural assertions.
- `.first()` is used on the Download link selector to disambiguate from the
  "Download" section header text in the sidebar.

## Verification

```
$ npx playwright test
Running 1 test using 1 worker
  1 passed (5.6s)

$ npx tsc -b && npx vite build
✓ 2043 modules transformed.
✓ built in 1.59s
```

Both `test:e2e` and `build` pass cleanly.
