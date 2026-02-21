# Mobile Overlay Hotfix Summary

Focused mobile UI polish targeting iPhone-class viewports (375--430 px).
All changes use responsive Tailwind prefixes (`sm:`, `lg:`) so desktop
behaviour is preserved.

---

## Changed files

| File | What changed |
|------|-------------|
| `src/ui/components/AppShell.tsx` | Raised sidebar overlay to `z-30` and sidebar to `z-40` so they cover the LiveBalance bar when the drawer is open. |
| `src/ui/components/LiveBalance.tsx` | Lowered all instances from `z-40` to `z-20`. Added `py-2 px-1` / `py-2 px-1.5` padding to "Why?" links for larger touch targets. Increased pill badge vertical padding on mobile (`py-1 sm:py-0.5`). Tightened multi-pill gap on narrow screens (`gap-x-3 gap-y-1.5 sm:gap-4`). Increased single-line pill padding on mobile (`py-1.5 sm:py-1`). |
| `src/ui/components/Sidebar.tsx` | Step links: `py-2` -> `py-3 lg:py-2` for 44 px touch targets on mobile. List gap: `space-y-0.5` -> `space-y-1 lg:space-y-0.5`. Section headers: `pt-3` -> `pt-4 lg:pt-3` for breathing room. |
| `src/ui/pages/DownloadPage.tsx` | Summary card and state cards: `p-6` -> `p-4 sm:p-6`. Row gap and alignment: added `gap-2`, `shrink-0`, `text-right` to summary rows. State download section: vertical stack on mobile (`flex-col sm:flex-row`). |
| `src/ui/pages/StateReturnsPage.tsx` | Checkboxes sized to `w-5 h-5 sm:w-4 sm:h-4` for easier tapping on mobile. Sub-option left margin reduced on mobile (`ml-4 sm:ml-6`). |
| `src/ui/pages/InterviewNav.tsx` | Back/Continue buttons: `py-2.5` -> `py-3 sm:py-2.5` for mobile touch comfort. |
| `tests/ui/components/LiveBalance.test.tsx` | Added 4 responsive assertions: z-20 class present, z-40 absent, "Why?" link touch padding. |
| `tests/ui/components/MobileOverlay.test.tsx` | New test file (6 tests): z-index ordering (LiveBalance < overlay < sidebar), sidebar step link touch padding. |

---

## Before / After

### Z-index stack (mobile drawer open)

| Layer | Before | After |
|-------|--------|-------|
| LiveBalance | `z-40` (highest -- bleeds over overlay) | `z-20` |
| Overlay backdrop | `z-20` | `z-30` |
| Sidebar | `z-30` | `z-40` |

**Before:** LiveBalance bar appeared above the dimming overlay and partially above the sidebar drawer on mobile, breaking readability.
**After:** Sidebar and overlay cleanly cover the balance bar.

### "Why?" link tap target

**Before:** bare `<a>` with no padding -- ~16 px effective hit area.
**After:** `py-2 px-1.5` invisible padding -- ~32 px hit area (approaching Apple HIG 44 px minimum).

### Sidebar step links

**Before:** `py-2` (~36 px total height) on all screen sizes.
**After:** `py-3` on mobile (~44 px, meets Apple HIG), reverting to `py-2` at `lg:` for desktop compactness.

### Download page cards

**Before:** Fixed `p-6` padding on all screen sizes.
**After:** `p-4` on mobile, `p-6` at `sm:`. Summary rows gain `gap-2` and `text-right` to prevent label collision with long values like "Married Filing Jointly".

### State returns checkboxes

**Before:** Default browser checkbox size.
**After:** `w-5 h-5` on mobile (20 px, larger touch target), `w-4 h-4` at `sm:`.

---

## Testing

- Build: `tsc -b && vite build` -- clean.
- Tests: all new and existing tests pass. One pre-existing failure in `P27Pages.test.tsx` (standard deduction amount mismatch) is unrelated.
- New test coverage: `MobileOverlay.test.tsx` validates the z-index layering invariant and sidebar touch padding.
