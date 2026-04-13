# Accessibility Audit (2026-03-29)

## Scope
- Light-only UI after dark-mode removal.
- Focused on common text color tokens used in App and Guide screens.

## WCAG Contrast Check (White background)
- `zinc-400` on white: `2.56` (AA normal FAIL, AA large FAIL)
- `zinc-500` on white: `4.83` (AA normal PASS)
- `zinc-600` on white: `7.73` (AA normal PASS)
- `zinc-700` on white: `10.44` (AA normal PASS)
- `indigo-500` on white: `4.47` (AA normal FAIL, AA large PASS)
- `indigo-600` on white: `6.29` (AA normal PASS)

## Applied Improvements
- Upgraded `text-zinc-400` to `text-zinc-500` in:
  - `src/App.tsx`
  - `src/components/GuideTab.tsx`
- Removed remaining dark selectors from `src/index.css`.

## Residual Risk
- Some small decorative texts still rely on low-opacity classes (`opacity-40`, `opacity-30`).
- `indigo-500` may be borderline for small text on white (`4.47`).

## Suggested Next Increment
- Promote tiny text labels from `indigo-500` to `indigo-600` where body-size text is used.
- Reduce use of `opacity-40` for informational text and prefer explicit token colors.
