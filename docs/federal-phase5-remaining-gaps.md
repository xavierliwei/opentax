# Federal Phase 5 — Remaining Gaps (Post Phase 4)

Date: 2026-02-23
Status: Planned

## Highest Priority (production completeness)

1. **PDF/Form packet completeness for computed federal flows**
   - Schedule C filler + inclusion in export packet
   - Schedule SE filler + inclusion in export packet
   - Form 8995 / 8995-A filler + inclusion in export packet
   - Form 1116 filler + inclusion in export packet

2. **K-1 advanced tax treatment**
   - Partnership K-1 Box 14 SE tax handling
   - Guaranteed payments (Box 4)
   - Passive activity loss limitations for K-1 rental losses

3. **QBI complex edge cases**
   - Expand 8995-A/SSTB boundary handling and tests

4. **FTC advanced scenarios**
   - General category income
   - Carryback/carryforward
   - Treaty/re-sourcing edge cases

## Medium Priority

5. **Schedule F (farm income)**
6. **Home office (Form 8829) computation**
7. **1099-NEC first-class path (separate from misc heuristics)**

## Notes
- Current rule engine has broad federal coverage after phases 1–4.
- Main remaining launch blocker for “fully complete packet export” is missing PDF fillers/templates for forms already computed in logic.
