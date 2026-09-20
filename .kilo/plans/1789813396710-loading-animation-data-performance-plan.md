# Loading Animation + Data Query Performance Optimization Plan

## Overview

The ScholarX app (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase, TanStack React Query 5) needs two improvements:

1. **Modern loading animation on every page** — Currently, loading states are inconsistent: auth-gate layouts use inline CSS spinners, pages use `return null`, and data-fetching pages use ad-hoc skeleton components. There is no reusable loading component.

2. **Faster data queries** — The data layer has several performance anti-patterns that make every page feel slow.

## Context: Current State of Loading

| Layer | Current Pattern | Files |
|-------|----------------|-------|
| Auth-gate layout | Inline CSS spinner (`<div className="animate-spin">`) | `super-admin/layout.tsx`, `i/[slug]/layout.tsx` |
| Student layout | `return null` (no spinner) | `student/layout.tsx` |
| Pages (SSR guard) | `const [mounted, setMounted] = ...; if (!mounted) return <Skeleton>` or `return null` | 30+ pages |
| Public pages (login/register) | `if (!mounted) return null` | `login/page.tsx`, `register/page.tsx`, `student/login/page.tsx`, `student/dashboard/page.tsx`, `student/payments/page.tsx` |
| Data loading | `mounted` boolean, not React Query `isLoading` | All pages |
| Search pages | No loading state during fetch | `result/page.tsx`, `verify-certificate/page.tsx` |
| Route transitions | No loading indicator | All routes |

## Context: Root Causes of Slowness

### A. Import-time side effects (critical)
11 of 18 storage modules fire a Supabase query the instant the module is imported (before any component mounts):

```ts
// e.g., students.ts, results.ts, registrations.ts, payments.ts, marks.ts,
//       institutions.ts, exams.ts, exam-centers.ts, classes.ts,
//       admit-cards.ts, certificates.ts
if (typeof window !== 'undefined') {
  syncFromSupabase();  // ← fires untracked async query on import
}
```

`syncFromSupabase()` internally calls `fetchCurrentSession()` → `fetchSessions()` → `supabase.from('academic_sessions').select('*')`. This means importing ANY of these modules triggers at least 2 network requests at import time. When a page imports multiple storage hooks, this creates a cascade of concurrent requests that compete with the page's own queries.

### B. No database-side filtering (critical)
8 `fetchXByInstitution`/`fetchXByExam`/`fetchXByRegistration` functions fetch ALL rows for the session and filter in JavaScript:

| Function | What it should do | What it does |
|----------|------------------|-------------|
| `fetchStudentsByInstitution` | `.select('*').eq('institution_id', id).eq('session_id', sid)` | fetches all session students, `.filter()` |
| `fetchRegistrationsByInstitution` | `.eq('institution_id', id)` | fetches all session regs, `.filter()` |
| `fetchRegistrationsByExam` | `.eq('exam_id', id)` | fetches all session regs, `.filter()` |
| `fetchPaymentsByInstitution` | `.eq('institution_id', id)` | fetches all session payments, `.filter()` |
| `fetchCertificatesByInstitution` | `.eq('institution_id', id)` | fetches all session certs, `.filter()` |
| `fetchResultsByInstitution` | `.eq('institution_id', id)` | fetches all session results, `.filter()` |
| `fetchResultsByExam` | `.eq('exam_id', id)` | fetches all session results, `.filter()` |
| `fetchMarksByRegistration` | `.eq('registration_id', id)` | fetches all session marks, `.filter()` |

If there are 10 institutions with 10K total rows, each institution-scoped fetch downloads all 10K rows instead of 1K.

### C. Inefficient `fetchCurrentSession` (moderate)
Calls `fetchSessions()` (all sessions) then `.find(s => s.isCurrent)`. Should query `.eq('is_current', true).single()`.

### D. Query key inconsistency / stale cache bug (correctness)
6 hooks omit `sessionId` from their query keys even though their query functions depend on the session:

| Hook | Current key | Should be |
|------|------------|-----------|
| `useStudentsByInstitution` | `['students', 'institution', id]` | `['students', 'institution', id, sessionId]` |
| `useRegistrationsByInstitution` | `['registrations', 'institution', id]` | `['registrations', 'institution', id, sessionId]` |
| `useRegistrationsByExam` | `['registrations', 'exam', examId]` | `['registrations', 'exam', examId, sessionId]` |
| `useCertificatesByInstitution` | `['certificates', 'institution', id]` | `['certificates', 'institution', id, sessionId]` |
| `usePaymentsByInstitution` | `['payments', 'institution', id]` | `['payments', 'institution', id, sessionId]` |
| `useMarksByRegistration` | `['marks', 'registration', regId]` | `['marks', 'registration', regId, sessionId]` |

### E. Redundant localStorage dual-cache (moderate)
Each storage module has two parallel caches: Supabase + localStorage. CRUD functions write to both. The localStorage sync (`getStore`/`setStore`) is a manual caching layer that adds code complexity and risk of inconsistency. React Query already caches data — the localStorage layer is unnecessary for the query path.

**Exception:** `exams/page.tsx` uses `getActiveClasses()` (sync localStorage) for class toggle buttons in a modal. This is a legitimate synchronous read need.

### F. Pages bypassing React Query (moderate)
- `result/page.tsx`: calls `fetchResults()` and `fetchStudents()` directly on every search — no caching, no deduplication, full table scan each time.
- `verify-certificate/page.tsx`: calls `fetchCertificateByNumber()` directly — no loading state shown during fetch.

### G. Low `staleTime` and no `placeholderData` (minor)
React Query config: `staleTime: 30s`. After 30s, switching tabs/pages triggers immediate refetch. `placeholderData` is not used on institution-scoped hooks that have cascade dependencies.

---

## Implementation Plan (Ordered Tasks)

### Part A: Shared Loading Components

#### Task A1: Add CSS spinner keyframes to `globals.css`
- Add `@keyframes spin-slow`, `@keyframes pulse-glow`, `@keyframes ripple` animations
- Add `.animate-spin-slow` and `.animate-pulse-glow` utility classes
- File: `src/app/globals.css`

#### Task A2: Create `LoadingSpinner` component
- File: `src/components/ui/loading-spinner.tsx`
- Props: `size?: 'sm' | 'md' | 'lg' | 'xl'`, `variant?: 'default' | 'brand'`, `className?`
- Modern design: concentric rotated rings with gradient, or a single ring with a gradient arc and glow pulse
- Respects dark/light theme via `useTheme()`
- Reusable for inline and button loading states

#### Task A3: Create `PageLoader` component
- File: `src/components/ui/page-loader.tsx`
- Full-screen overlay (fixed inset-0) with centered spinner + brand logo + loading text
- Props: `text?: string` (default: "Loading..."), `fullScreen?: boolean`
- Uses `<LoadingSpinner>` internally
- Animation: fade-in with stagger

#### Task A4: Create `LoadingBar` component (route transitions)
- File: `src/components/ui/loading-bar.tsx`
- Thin (h-0.5) progress bar fixed at top of screen
- Controlled via React context — starts on route change, completes on load
- Uses Supabase's `isFetching` global state OR manual `start()`/`complete()` API
- Create `LoadingBarProvider` context for managing state

#### Task A5: Wire `LoadingBar` into the app root
- File: `src/app/providers.tsx` — add `<LoadingBarProvider>` at the root
- OR: Add a `<LoadingBarConsumer />` component in `src/components/layout/app-shell.tsx` and the student/super-admin layouts
- OR: Create a top-level `RouteTransitionLoader` component that wraps `children` and uses `useEffect` + `useRouter` (App Router) to detect pending navigations

**Decision:** In Next.js App Router (client components), use a custom approach:
- Create a `QueryLoadingProvider` that wraps `QueryProvider` and subscribes to `queryClient.isFetching`
- Show `<LoadingBar>` when `isFetching > 0`
- This gives real-time feedback during all data fetches

### Part B: Apply Loading Animation to All Pages

Apply the `<PageLoader>` component to all loading states. The key change is replacing `if (!mounted) return null` and `if (!mounted) return <Skeleton>` with `<PageLoader>`.

#### Task B1: Replace layout-level loading states
- `src/app/super-admin/layout.tsx:26-30` — replace inline spinner with `<PageLoader>`
- `src/app/i/[institutionSlug]/layout.tsx:48-52` — replace `<div className="skeleton...">` with `<PageLoader>`
- `src/app/student/layout.tsx:41` — replace `return null` with `<PageLoader>`

#### Task B2: Replace public page loading states
- `src/app/login/page.tsx:88` — replace `return null` with `<PageLoader>`
- `src/app/register/page.tsx` — no early return on `!mounted`, just conditional rendering — fine as is
- `src/app/student/login/page.tsx:80` — replace `return null` with `<PageLoader>`
- `src/app/student/dashboard/page.tsx:74` — replace `return null` with `<PageLoader>`; also replace the `mounted` + skeleton pattern with `<PageLoader>` shown while React Query data is loading
- `src/app/student/payments/page.tsx:74` — replace `return null` with `<PageLoader>`
- `src/app/student/payments/[registrationId]/submit/page.tsx:203` — replace `return null` with `<PageLoader>`

#### Task B3: Replace super-admin page loading states (15 pages)
Replace `if (!mounted) return <XxxSkeleton isDark={isDark} />` with a pattern that:
- Shows `<PageLoader>` on first mount (`!mounted`)
- Shows `<PageLoader>` when React Query `isLoading` is true (actual data loading)
- Shows existing skeleton only for progressive content within the page (optional, can simplify to just `<PageLoader>`)

Pages:
1. `src/app/super-admin/page.tsx` — line 46
2. `src/app/super-admin/users/page.tsx` — line 106
3. `src/app/super-admin/institutions/page.tsx` — line 73
4. `src/app/super-admin/institutions/[id]/page.tsx` — line 35
5. `src/app/super-admin/students/page.tsx` — line 66
6. `src/app/super-admin/registrations/page.tsx` — line 65
7. `src/app/super-admin/exams/page.tsx` — line 106
8. `src/app/super-admin/exam-centers/page.tsx` — line 57
9. `src/app/super-admin/admit-cards/page.tsx` — line 48
10. `src/app/super-admin/marks/page.tsx` — line 72
11. `src/app/super-admin/results/page.tsx` — line 61
12. `src/app/super-admin/certificates/page.tsx` — line 61
13. `src/app/super-admin/payments/page.tsx` — line 147
14. `src/app/super-admin/settings/page.tsx` — line 201
15. `src/app/super-admin/notifications/page.tsx` — line 84
16. `src/app/super-admin/reports/page.tsx` — line 43

#### Task B4: Replace institution page loading states (10 pages)
Same pattern as B3. Pages starting with `if (!mounted) return <XxxSkeleton>`:

1. `src/app/i/[institutionSlug]/dashboard/page.tsx` — line 58
2. `src/app/i/[institutionSlug]/students/page.tsx` — line 102
3. `src/app/i/[institutionSlug]/registrations/page.tsx` — line 141
4. `src/app/i/[institutionSlug]/exams/page.tsx` — line 68
5. `src/app/i/[institutionSlug]/results/page.tsx` — line 103
6. `src/app/i/[institutionSlug]/certificates/page.tsx` — line 102
7. `src/app/i/[institutionSlug]/payments/page.tsx` — line 96
8. `src/app/i/[institutionSlug]/reports/page.tsx` — line 33
9. `src/app/i/[institutionSlug]/settings/page.tsx` — line 145

**Implementation detail for B3/B4:** The current pattern is:
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
// ... hooks
if (!mounted) return <XxxSkeleton isDark={isDark} />;
if (!inst) return null;
```

Replace with:
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
const { data, isLoading } = useXxx(...);
if (!mounted || isLoading) return <PageLoader />;
```

This shows the `<PageLoader>` during both the hydration check AND actual data loading.

#### Task B5: Add loading state to search-driven pages
- `src/app/result/page.tsx` — add `loading` state, show `<LoadingSpinner>` on the search button, disable button during fetch
- `src/app/verify-certificate/page.tsx` — same pattern

### Part C: Create a Reusable `LoadingBoundary` Helper (Optional Simplification)

#### Task C1: Create `DataLoader` wrapper component
- File: `src/components/ui/data-loader.tsx`
- A small wrapper that takes `isLoading`, `children`, and optional `skeleton` props
- Encapsulates the `mounted` + `isLoading` pattern so pages don't repeat it
- Usage: `<DataLoader isLoading={!mounted || query.isLoading} skeleton={<PageLoader />}>{children}</DataLoader>`

---

### Part D: Data Query Performance Optimization

#### Task D1: Remove import-time `syncFromSupabase()` calls

Remove the `if (typeof window !== 'undefined') { syncFromSupabase(); }` block from all 11 modules:
- `certificates.ts`, `students.ts`, `results.ts`, `registrations.ts`, `payments.ts`, `marks.ts`, `institutions.ts`, `exams.ts`, `exam-centers.ts`, `classes.ts`, `admit-cards.ts`

Keep the `syncFromSupabase` function definition (it's called by nothing else — it's private), but remove the invocation. Or remove the function entirely if no other code references it.

**Check:** `syncFromSupabase` is a private (non-exported) function in each module — it's only called by the module-level invocation. Safe to remove both the function and the invocation.

But wait — the CRUD `create`/`update`/`delete` functions in each module call `getStore`/`setStore` to update localStorage. If we remove `syncFromSupabase`, the localStorage will only be populated by CRUD operations (create/update/delete), not by the initial sync. This means `getStudents()` etc. will return empty on fresh load. Check if any code relies on these sync getters after removing the sync:

- `exams/page.tsx` uses `getActiveClasses()` — but `classes.ts` has the same import-time sync issue. After removing sync, `getActiveClasses()` will return stale/empty data until a CRUD operation happens. The `useActiveClasses()` hook already fetches fresh data. **Fix:** `exams/page.tsx` should use `useActiveClasses()` data instead of `getActiveClasses()`.

- `storage.ts` functions `generateApplicationId`, `generateStudentId`, `generateCertificateNumber` call `fetchXByInstitution` (async) — not affected by localStorage sync removal.

**After removing syncFromSupabase:** Remove the `getStore`/`setStore` calls from CRUD functions to fully eliminate the dual-cache. This simplifies the code and ensures React Query is the single source of truth. Update CRUD functions to not touch localStorage at all.

**After removing localStorage from CRUD:** Remove the `getStore`/`setStore` imports and the sync getter functions (`getStudents`, `getInstitutions`, etc.) that were only backed by localStorage. Keep only the async `fetch*` functions and React Query hooks.

**Check for `exams/page.tsx` `getActiveClasses` usage:** Update it to use `useActiveClasses()` hook data instead.

#### Task D2: Optimize `fetchCurrentSession` in `sessions.ts`
Change from:
```ts
export async function fetchCurrentSession(): Promise<AcademicSession | undefined> {
  const sessions = await fetchSessions();
  return sessions.find(s => s.isCurrent);
}
```
To:
```ts
export async function fetchCurrentSession(): Promise<AcademicSession | undefined> {
  const { data, error } = await supabase
    .from('academic_sessions')
    .select('*')
    .eq('is_current', true)
    .single();
  if (error || !data) return undefined;
  return mapSession(data);
}
```
This avoids fetching all sessions.

#### Task D3: Add database-side filtering to `fetchXByInstitution`/`fetchXByExam`/`fetchXByRegistration`

For each affected module, change the "fetch-all-then-filter" functions to query with the additional filter at the database level:

**`students.ts`:**
```ts
export async function fetchStudentsByInstitution(institutionId: string, sessionId?: string): Promise<Student[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid || !institutionId) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .eq('institution_id', institutionId)
    .eq('session_id', sid)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapStudent);
}
```

Apply the same pattern to:
- `registrations.ts`: `fetchRegistrationsByInstitution`, `fetchRegistrationsByExam`
- `results.ts`: `fetchResultsByInstitution`, `fetchResultsByExam`
- `payments.ts`: `fetchPaymentsByInstitution`
- `certificates.ts`: `fetchCertificatesByInstitution`
- `marks.ts`: `fetchMarksByRegistration`

#### Task D4: Fix query keys to include `sessionId`

Update the 6 hooks identified in Context D to include `sessionId` in the query key. Also fix the base `useX()` hooks that are called without `sessionId` — these resolve the session internally, so the query key should include the resolved session.

**Approach:** For institution-scoped hooks, resolve the session first and include it in the key:
```ts
export function useStudentsByInstitution(institutionId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['students', 'institution', institutionId, sessionId],
    queryFn: () => fetchStudentsByInstitution(institutionId, sessionId),
    enabled: !!institutionId,
  });
}
```

This is sufficient — the `sessionId` will be `undefined` until resolved, and React Query will re-fetch when the resolved session ID changes the key.

#### Task D5: Tune React Query defaults
File: `src/lib/query-provider.tsx`

- Increase `staleTime` from `30 * 1000` (30s) to `5 * 60 * 1000` (5 min) — most of this data changes infrequently
- Add `placeholderData: (previousData) => previousData` to institution-scoped hooks so switching between tabs/sections within the same page doesn't show a loading state
- Keep `refetchOnWindowFocus: false`, `retry: 1`

#### Task D6: Fix `result/page.tsx` — use React Query + add loading state
- Replace direct `fetchResults()` / `fetchStudents()` calls with `useResults()` and `useStudents()` hooks
- Add a `searching` state for the button loading animation
- Cache results so navigating back doesn't re-fetch

#### Task D7: Fix `verify-certificate/page.tsx` — add React Query + loading state
- Replace direct `fetchCertificateByNumber()` with `useCertificateByNumber` hook (already exists!)
- Add loading state on the search button

#### Task D8: Add Supabase column selection to reduce payload
For the `fetchXByInstitution` functions in Task D3, use `select()` with specific columns instead of `select('*')`. Identify which columns each page actually uses and select only those.

This can be done as part of D3 or as a follow-up. For the initial implementation, D3 (database-side filtering) provides the biggest win. Column selection is a refinement.

---

### Part E: Pages That Skip localStorage Cleanup

The following pages currently use sync getters (`getStudents`, `getActiveClasses`, etc.) from localStorage. After Task D1, these will return stale or empty data:

- `src/app/super-admin/exams/page.tsx` — uses `getActiveClasses()` for class toggles in modal. **Fix:** use `useActiveClasses()` hook data passed to the modal, or fetch within the modal.
- Check `result/page.tsx` — uses `fetchStudents()` (async, not sync getter) — safe.
- Check `verify-certificate/page.tsx` — uses `fetchCertificateByNumber()` (async) — safe.

---

### Part F: Testing / Validation

1. Run `npm run lint` — ensure no lint errors
2. Run `npm run build` — ensure production build compiles
3. Manual testing:
   - Navigate between super-admin pages — verify `<PageLoader>` appears during initial data load
   - Navigate between institution pages — same
   - Verify student dashboard shows loader
   - Verify search on `/result` and `/verify-certificate` shows spinner during fetch
   - Verify route transition `<LoadingBar>` appears during navigation
   - Verify data still displays correctly after loading
   - Verify mutations (create/update/delete) still work and cache updates correctly

---

## File Summary (All Files Touched)

**New files:**
- `src/components/ui/loading-spinner.tsx`
- `src/components/ui/page-loader.tsx`
- `src/components/ui/loading-bar.tsx`

**Modified files:**
- `src/app/globals.css`
- `src/lib/query-provider.tsx`
- `src/app/providers.tsx`
- `src/lib/storage/sessions.ts`
- `src/lib/storage/students.ts`
- `src/lib/storage/registrations.ts`
- `src/lib/storage/results.ts`
- `src/lib/storage/payments.ts`
- `src/lib/storage/marks.ts`
- `src/lib/storage/institutions.ts`
- `src/lib/storage/exams.ts`
- `src/lib/storage/exam-centers.ts`
- `src/lib/storage/classes.ts`
- `src/lib/storage/certificates.ts`
- `src/lib/storage/admit-cards.ts`
- `src/app/super-admin/layout.tsx`
- `src/app/i/[institutionSlug]/layout.tsx`
- `src/app/student/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/student/login/page.tsx`
- `src/app/student/dashboard/page.tsx`
- `src/app/student/payments/page.tsx`
- `src/app/student/payments/[registrationId]/submit/page.tsx`
- `src/app/result/page.tsx`
- `src/app/verify-certificate/page.tsx`
- `src/app/super-admin/page.tsx` + 14 super-admin sub-pages
- `src/app/i/[institutionSlug]/dashboard/page.tsx` + 8 institution sub-pages
- `src/app/super-admin/exams/page.tsx` (getActiveClasses fix)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Removing localStorage sync breaks pages that read sync getters | Audit all usages of `getStore`/`getXxx` sync getters before removal. Only `exams/page.tsx` uses one (`getActiveClasses`) — fix that specific usage. |
| Removing `syncFromSupabase` means data isn't pre-loaded before React Query requests | React Query will fetch on-demand when hooks are called. The `<PageLoader>` shows during this fetch. This is the correct pattern — don't prefetch everything. |
| Institution-scoped hooks with `enabled: !!inst?.id` cause cascade (inst loads → then 5+ queries fire) | Accept this cascade — it's correct behavior. The `<PageLoader>` covers it. Optionally use `placeholderData` to prevent re-showing the loader when switching between tabs within the same institution. |
| Public pages (`result`, `verify-certificate`) currently bypass React Query — refactoring adds complexity | Add React Query hooks and loading spinners. Keep it simple — the search is user-initiated, so just show a spinner on the button during fetch. |
| `mounted` boolean pattern exists to prevent SSR hydration mismatches | Keep the `mounted` pattern but use it alongside `isLoading`. Show `<PageLoader>` when `!mounted || isLoading`. |
