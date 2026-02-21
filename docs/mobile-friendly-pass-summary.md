# Mobile-Friendliness Pass Summary

Focused mobile-friendliness audit and fix pass across the OpenTax UI.

## Changes by Category

### 1. Touch Target Sizing (44px minimum)

| File | Change | Before | After |
|------|--------|--------|-------|
| `src/ui/components/Button.tsx` | All size variants responsive | `sm: h-7`, `md: h-9`, `lg: h-10`, `icon: h-7 w-7` | `sm: h-9 sm:h-7`, `md: h-11 sm:h-9`, `lg: h-12 sm:h-10`, `icon: h-9 w-9 sm:h-7 sm:w-7` |
| `src/ui/components/AppShell.tsx` | Hamburger menu button enlarged | `p-1 -ml-1` (22px) | `h-11 w-11` (44px) with hover/active states |
| `src/ui/components/InfoTooltip.tsx` | Info button touch area enlarged on mobile | `p-1 -m-1` (22px) | `p-3 -m-3 sm:p-1 sm:-m-1` (38px mobile, 22px desktop) |
| `src/ui/components/Sidebar.tsx` | Nav links and dashboard link taller | `py-2` (32px) | `py-2.5` (36px) |
| `src/ui/components/LiveBalance.tsx` | "Why?" links enlarged on mobile | no padding (text-only) | `py-2 -my-2 px-1` on mobile |
| `src/ui/pages/ReviewPage.tsx` | "?" explain links enlarged on mobile | `w-6 h-6` (24px) | `w-10 h-10` (40px) on mobile |
| `src/ui/pages/ReviewPage.tsx` | "Edit" links enlarged on mobile | no padding (text-only) | `py-2 -my-2 px-2 -mx-1` on mobile |
| `src/ui/pages/InterviewNav.tsx` | Back/Continue buttons taller on mobile | `py-2.5` (40px) | `py-3 sm:py-2.5` (46px mobile) |
| `src/ui/pages/DownloadPage.tsx` | Download buttons taller on mobile | `py-3` / `py-2` | `py-3.5 sm:py-3` / `py-3 sm:py-2` |
| `src/ui/pages/DashboardLayout.tsx` | "Open Interview" link enlarged on mobile | no padding | `py-2 -my-2 px-2 -mx-2` on mobile |
| `src/ui/pages/WelcomePage.tsx` | CTA button full-width + taller on mobile | `px-6 py-3` | `w-full sm:w-auto py-3.5 sm:py-3` |
| `src/index.css` | Form inputs min-height on mobile | no minimum | `min-height: 44px` for inputs/selects below 640px |

### 2. Responsive Layout Fixes

| File | Change |
|------|--------|
| `src/ui/pages/DependentsPage.tsx` | 3 grids changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` |
| `src/ui/pages/DividendIncomePage.tsx` | Grid changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` |
| `src/ui/pages/SpouseInfoPage.tsx` | Grid changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` |
| `src/ui/pages/RetirementIncomePage.tsx` | 2 grids changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` |
| `src/ui/pages/RSUIncomePage.tsx` | 2 grids changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`, 1 from `grid-cols-3` to `grid-cols-1 sm:grid-cols-3` |
| `src/ui/pages/InterestIncomePage.tsx` | Grid changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` |
| `src/ui/pages/ISOExercisesPage.tsx` | 2 grids changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` |
| `src/ui/components/WashSaleReview.tsx` | Grid changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` |
| `src/ui/pages/ReviewPage.tsx` | State return cards: `flex` to `flex-col sm:flex-row` (stack on mobile) |
| `src/ui/pages/DownloadPage.tsx` | State download rows: `flex` to `flex-col sm:flex-row` |

### 3. Sticky Actions & Overflow Handling

| File | Change |
|------|--------|
| `src/ui/pages/InterviewNav.tsx` | Sticky bottom on mobile: `sticky bottom-0 z-10` with shadow, reverts to static on `sm:` |
| `src/ui/components/AppShell.tsx` | Added `pb-20 sm:pb-6` to main content for sticky nav clearance |

### 4. Typography & Spacing

| File | Change |
|------|--------|
| `src/ui/pages/WelcomePage.tsx` | Heading: `text-2xl sm:text-3xl`; body: `text-base sm:text-lg`; padding: `py-8 sm:py-12 px-4 sm:px-0` |
| `src/ui/pages/InterviewNav.tsx` | `active:` states added to Back and Continue for mobile tap feedback |
| `src/ui/pages/DownloadPage.tsx` | `active:` states added to download buttons |
| `src/ui/components/AppShell.tsx` | Hamburger button: `active:bg-gray-200` for tap feedback |

## Build & Test Results

- **Build:** `npm run build` passes cleanly (tsc + vite)
- **UI tests:** 129/129 passing (14 test files) including 10 new mobile-responsive tests
- **Unit tests:** Pre-existing failures unrelated to this change (better-sqlite3 module version)

## Test Coverage Added

New file: `tests/ui/mobile-responsive.test.tsx` (10 tests)
- Button size variants verify responsive classes (sm, md, icon)
- InfoTooltip verifies mobile-enlarged touch padding
- DependentsPage grids verify responsive `grid-cols-1 sm:grid-cols-2`
- InterviewNav verifies sticky positioning + mobile padding
- WelcomePage verifies full-width CTA + responsive heading
- ReviewPage verifies enlarged "?" explain link touch targets

## Design Decisions

1. **Mobile-first sizing via Tailwind breakpoints:** Used `h-11 sm:h-9` pattern rather than CSS `@media (pointer: coarse)` to keep logic in component classes, consistent with the existing Tailwind-only approach.
2. **CSS min-height for inputs:** Added a single `@media (max-width: 639px)` rule in `index.css` for form inputs rather than modifying every input component individually.
3. **Sticky nav approach:** InterviewNav uses `sticky bottom-0` with negative margins to extend edge-to-edge on mobile, with `sm:static` to revert on desktop. A subtle upward shadow provides visual separation.
4. **Touch padding technique:** For small links/icons, used the `p-N -m-N` padding+negative-margin pattern to enlarge tap area without affecting visual layout.
5. **Grid stacking:** All form input grids now stack to single-column on mobile (`grid-cols-1 sm:grid-cols-2`). Kept `grid-cols-2` for the DeductionsPage Standard/Itemized comparison cards (simple content, better as side-by-side).

## Remaining Mobile TODOs

- **Checkbox/radio native inputs:** Still use browser defaults (~16px). Labels are tappable but native controls themselves are small. Could add custom styled checkboxes in a future pass.
- **Tooltip positioning on mobile:** Currently anchored `bottom-full left-0`. On very long labels near screen edges, tooltips might clip. A position-aware tooltip (flip logic) could improve this.
- **Landscape orientation:** Not explicitly tested. The single-column mobile layouts should work but multi-column grids on landscape phones might be underutilized.
- **iOS Safari viewport quirks:** The `sticky` bottom nav may interact with Safari's dynamic toolbar. Could add `env(safe-area-inset-bottom)` padding for notched devices.
- **Keyboard avoidance:** When a mobile keyboard opens, the sticky InterviewNav may overlap the focused input. Could detect keyboard visibility and hide/offset the sticky nav.

## Files Changed

### Components
- `src/index.css`
- `src/ui/components/AppShell.tsx`
- `src/ui/components/Button.tsx`
- `src/ui/components/InfoTooltip.tsx`
- `src/ui/components/LiveBalance.tsx`
- `src/ui/components/Sidebar.tsx`
- `src/ui/components/WashSaleReview.tsx`
- `src/ui/components/RepeatableSection.tsx` (via Button.tsx icon size change)

### Pages
- `src/ui/pages/DashboardLayout.tsx`
- `src/ui/pages/DependentsPage.tsx`
- `src/ui/pages/DividendIncomePage.tsx`
- `src/ui/pages/DownloadPage.tsx`
- `src/ui/pages/ISOExercisesPage.tsx`
- `src/ui/pages/InterestIncomePage.tsx`
- `src/ui/pages/InterviewNav.tsx`
- `src/ui/pages/RSUIncomePage.tsx`
- `src/ui/pages/RetirementIncomePage.tsx`
- `src/ui/pages/ReviewPage.tsx`
- `src/ui/pages/SpouseInfoPage.tsx`
- `src/ui/pages/WelcomePage.tsx`

### Tests
- `tests/ui/mobile-responsive.test.tsx` (new)

### Docs
- `docs/mobile-friendly-pass-summary.md` (this file)
