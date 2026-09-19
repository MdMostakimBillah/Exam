# Plan: Institution Student Registration Modal Size Update

## Goal
Update the "New Registration" modal (multi-step student registration) to use:
- **Width**: 90dvw (90% of dynamic viewport width)
- **Height**: 95dvh (95% of dynamic viewport height)
- **Position**: Centered on display

## Current Implementation

### Modal Component (`src/components/ui/modal.tsx`)
- Uses `max-h-[90vh]` for max height
- Uses `maxWidth` prop (default `max-w-lg`) for width
- Centers via `fixed inset-0 z-50 flex items-center justify-center p-4`

### Registrations Page (`src/app/i/[institutionSlug]/registrations/page.tsx`)
- Line 408: `<Modal open={showModal} ... maxWidth="max-w-xl" title={...}>`
- This is the "New Registration" modal with 3-step form

## Changes Required

### 1. Update Modal Component (`src/components/ui/modal.tsx`)
- Add optional `maxHeight` prop (default: `max-h-[90vh]`)
- Add optional `width` prop for custom width classes (e.g., `w-[90dvw]`)
- Pass these to the modal container div

### 2. Update Registrations Page (`src/app/i/[institutionSlug]/registrations/page.tsx`)
- Line 408: Change `maxWidth="max-w-xl"` to use new props:
  - `width="w-[90dvw]"` (or similar)
  - `maxHeight="max-h-[95dvh]"`

## Implementation Details

### Modal Component Props Interface
```typescript
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;      // existing
  maxHeight?: string;     // new - default 'max-h-[90vh]'
  width?: string;         // new - optional custom width
}
```

### Modal Container Classes
```tsx
<div className={cn(
  'relative z-50 w-full rounded-md p-6 shadow-2xl animate-scaleIn backdrop-blur-xl flex flex-col',
  isDark ? 'border border-white/[0.06] bg-[#0D0D0D] shadow-black/50' : 'border border-zinc-200 bg-white shadow-zinc-200/50',
  maxWidth,
  maxHeight,      // new
  width           // new
)}>
```

### Registrations Page Usage
```tsx
<Modal
  open={showModal}
  onClose={() => setShowModal(false)}
  title={isBn ? "নতুন নিবন্ধন" : "New Registration"}
  width="w-[90dvw]"
  maxHeight="max-h-[95dvh]"
>
```

## Validation
- Test modal opens centered on various screen sizes
- Verify 90dvw width and 95dvh height constraints work
- Ensure form content scrolls properly within modal
- Test on mobile and desktop viewports
- Verify dark/light theme still works

## Risks
- Dynamic viewport units (dvw/dvh) may have limited browser support in older browsers
- Content may need scrolling if form exceeds 95dvh
- Ensure modal doesn't overflow on very small screens