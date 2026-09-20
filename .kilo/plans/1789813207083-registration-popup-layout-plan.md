# Plan: Match Institution Registration Popup to Add Exam Modal

## Goal

Make the institution Registrations page **New Registration** popup visually and behaviorally match the super-admin Exams **Add Exam** popup:

- Centered in the viewport
- `w-[90dvw]` by `h-[90dvh]`
- Fixed header, scrollable form content, and pinned footer
- Responsive on desktop and mobile
- Existing light/dark theme styling preserved

## Confirmed decisions

- Reference popup: `src/app/super-admin/exams/page.tsx:402-671` (the Add Exam wizard), not `/super-admin`, which has no popup.
- Target scope: only the New Registration modal in `src/app/i/[institutionSlug]/registrations/page.tsx`.
- Use the shared `Modal` component; do not create a separate registration modal.
- Match the Add Exam layout and sizing, while retaining the registration form and its current styling.
- Existing modal consumers must retain their current sizing and behavior.
- This plan supersedes the prior 95dvh sizing plan for the New Registration modal.

## Current blockers

- `Modal` defaults to `max-w-lg`, so `width="w-[90dvw]"` is still capped at 32rem.
- The shared overlay has `p-4`; adding that padding to a 90dvw panel can overflow the viewport.
- `Modal` has `maxHeight` but no explicit fixed `height` prop, so it cannot match the Add Exam popup's `h-[90dvh]` panel.
- The New Registration modal currently requests `max-h-[95dvh]`, which does not match the confirmed 90dvh target.

## Implementation

### 1. Extend the shared Modal API

Update `src/components/ui/modal.tsx`:

- Add `height?: string`.
- Add `overlayPadding?: string`, defaulting to `p-4`.
- Keep `maxWidth?: string`, `maxHeight?: string`, and `width?: string` backward-compatible.
- Resolve sizing so:
  - `maxWidth` defaults to `max-w-lg` for existing callers.
  - When `width` is supplied without an explicit `maxWidth`, use `max-w-none` so the explicit width is not capped.
  - An explicit `maxWidth` remains honored.
  - `height` takes precedence over `maxHeight`; when no `height` is supplied, retain `max-h-[90vh]`.
- Apply `overlayPadding` to the centered overlay wrapper.
- Apply `height` (or the resolved max-height class) and `width` to the modal container.
- Add `overflow-hidden` to the fixed-height modal container while preserving its flex-column layout.
- Keep the existing body-scroll lock, overlay click handling, theme classes, and animation behavior.

Suggested sizing resolution:

```tsx
const resolvedMaxWidth = maxWidth ?? (width ? 'max-w-none' : 'max-w-lg');
const resolvedHeight = height ?? maxHeight ?? 'max-h-[90vh]';
```

### 2. Update the New Registration modal call

In `src/app/i/[institutionSlug]/registrations/page.tsx`, replace the current sizing props with:

```tsx
<Modal
  open={showModal}
  onClose={() => setShowModal(false)}
  title={isBn ? "নতুন নিবন্ধন" : "New Registration"}
  width="w-[90dvw]"
  height="h-[90dvh]"
  overlayPadding="p-0"
>
```

Remove the old `maxHeight="max-h-[95dvh]"` prop. Do not pass `maxWidth`; the shared Modal should allow the explicit width to override its default max-width.

### 3. Preserve the registration layout

- Keep the existing three-step form, step indicator, fields, photo upload, exam selection, and buttons unchanged.
- Keep the shared Modal header and `ModalFooter` styling; do not replicate the Add Exam popup's exact colors, borders, or spacing.
- Ensure the form content remains in the existing `overflow-y-auto flex-1 min-h-0` area and can scroll independently when content exceeds the panel.
- Verify the footer remains visible at the bottom while long content scrolls. Do not change the footer behavior for other Modal consumers.

## Files in scope

- `src/components/ui/modal.tsx`
- `src/app/i/[institutionSlug]/registrations/page.tsx`

Out of scope:

- Changes to the super-admin Add Exam popup.
- Changes to View Details, approval/rejection, or any other existing Modal consumers.
- Data, storage, form validation, or registration workflow changes.

## Validation

1. Run `npm run lint`; resolve any new errors. Existing warnings may remain.
2. Run `npm run build`; confirm the production build succeeds.
3. Open the institution Registrations page and click **New Registration**.
4. Verify at desktop and mobile viewport sizes that the panel is centered at 90dvw × 90dvh with no horizontal overflow.
5. Verify the header and footer remain fixed while long form content scrolls.
6. Exercise all three registration steps, Back/Next, Cancel, photo upload, and Register validation.
7. Check both light and dark themes.
8. Smoke-test at least one existing small Modal consumer to confirm its default `max-w-lg` / `max-h-[90vh]` behavior is unchanged.

## Risks and mitigations

- **Width cap:** The default `max-w-lg` would defeat `w-[90dvw]`; make explicit `width` suppress only the default max-width, not an explicitly supplied `maxWidth`.
- **Viewport overflow:** The shared overlay's default `p-4` would add 2rem around a 90dvw panel; use `overlayPadding="p-0"` only for this target modal.
- **Height conflict:** A default `max-h-[90vh]` class could constrain `h-[90dvh]`; make `height` replace the default max-height class.
- **Shared-component regression:** Keep all new props optional and default behavior unchanged for existing consumers.
