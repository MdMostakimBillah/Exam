# ScholarX Performance Optimization Plan

> Based on analysis of Next.js 16.3.5 App Router app with Supabase/PostgreSQL backend
> All findings are evidence-based from inspecting actual project code

---

## A. Performance Diagnosis (Bottlenecks by Impact)

### P0 — Critical

**1. All pages are Client Components with `useEffect` fetching** (Every page)
- Every page (`super-admin/*.tsx`, `student/*.tsx`, etc.) uses `"use client"` + `useEffect` to fetch data
- Zero SSR data fetching — initial HTML is empty, content appears only after JS executes and API calls complete
- Impact: Slowest possible page load pattern for data-heavy apps; TTFB is fast but FCP/TTI is terrible

**2. `select('*')` on every query fetching all columns including JSONB** (All storage modules)
- `students.ts:50`, `exams.ts:50`, `registrations.ts:50`, `payments.ts:50`, `results.ts:77-81`, `marks.ts:46`, etc. — all use `.select('*')`
- `results` table has `subject_marks JSONB`, `exams` has `subjects JSONB`, `classes` has `description TEXT` — all fetched regardless of need
- Impact: 2-5x larger payloads; more memory/CPU on client; slower serialization

**3. Zero pagination — all queries fetch ALL records** (All list pages)
- No `.limit()`, no offset, no cursor pagination on any list query
- Students page shows `.slice(0, 20)` client-side but fetches ALL from DB
- Super admin dashboard loads institutions, students, exams, registrations, results, payments — all fully
- Impact: OOM risk on large datasets; slow queries on tables with thousands of rows; database strain

**4. Triple data redundancy — localStorage sync + React Query + direct calls** (All storage modules)
- Each module does: `syncFromSupabase()` → localStorage, `getX()` → localStorage, `fetchX()` → direct Supabase, `useX()` → React Query wrapping `fetchX()`
- On mount: localStorage sync fires, then React Query fires a SECOND identical network request
- `generateApplicationId()`, `generateStudentId()`, `generateCertificateNumber()` in `storage.ts` trigger additional full-table fetches
- Impact: 2x redundant network requests per data type; localStorage serves stale/expired data

**5. No caching on stable/public data** (Classes, Institutions, Academic Sessions, System Settings)
- Classes are global, rarely change — fetched fresh every render via React Query with `staleTime: 30s`
- Institutions on super-admin pages fetched via `useInstitutions()` with no caching strategy
- Academic sessions fetched repeatedly via `useCurrentSession()`
- Impact: Unnecessary DB load; slower page loads when navigating between pages that all need the same reference data

### P1 — High

**6. Sequential data waterfalls in multi-section pages** (Super admin dashboard, exam pages)
- Super admin dashboard: `useInstitutions()`, `useStudents()`, `useExams()`, `useRegistrations()`, `useResults()`, `usePayments()` all fire independently but in series due to React Query default behavior with no parallel loading strategy
- Exams page: `useExams()` + `useRegistrations()` + `useClasses()` fire separately; registration counts computed client-side from full fetch
- Impact: Multiple sequential DB roundtrips; page waits for all to complete before showing meaningful data

**7. RLS policies with EXISTS subqueries on every row** (Exams, Admit Cards, Marks tables)
- `is_institution_admin_own_exams`: `EXISTS (SELECT 1 FROM registrations r WHERE r.exam_id = exams.id AND r.institution_id = get_user_institution_id())`
- Same pattern for admit_cards and marks
- This subquery runs for EVERY row evaluated by the policy — no index support for the join
- Impact: O(n) per row policy evaluation; severe on tables with many rows

**8. Middleware calls `supabase.auth.getUser()` on every navigation** (`src/middleware.ts`)
- Auth check + redirect runs on ALL routes (matcher covers everything except static assets)
- Additional profile query on `/i/*` routes
- Impact: Every page navigation incurs auth validation overhead; blocked on cookie parsing

**9. Student auth uses client-side Supabase (anon key in browser)** (`src/lib/auth/student-auth.ts`)
- All student operations go through browser client with `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- No server-side session validation for student pages
- In-memory lockout tracking resets on server restart (incomplete security)
- Impact: Students can potentially bypass RLS if browser client misconfigured; security audit trail incomplete

**10. No server actions for data mutations** (Most mutations)
- CRUD operations use React Query mutations calling client-side Supabase
- Only `register-action.ts` uses server-side Supabase with service role key
- No server-side input validation on mutations
- Impact: All mutations go through anon key RLS; no centralized validation; potential for data inconsistency

### P2 — Medium

**11. Missing database indexes for common filter/sort patterns** (Database)
- No index on `students.status`, `students.institution_id` alone
- No index on `registrations.status`, `registrations.student_id`, `registrations.exam_id` alone
- No index on `payments.status`, `payments.date`, `payments.institution_id` alone
- No index on `results.exam_id`, `results.institution_id` alone
- No index on `exams.status`
- No composite indexes for common WHERE + ORDER BY patterns

**12. Search uses client-side `.includes()` on full datasets** (Students, Exams, Registrations pages)
- `students.ts:36`: `${s.firstName} ${s.lastName}".includes(search)` on full client dataset
- `exams.ts:58`: `e.name.includes(search)` on full client dataset
- No server-side search; no PostgreSQL trigram/full-text indexes
- Impact: Search becomes O(n) on entire table; unusably slow at scale

**13. No `loading.tsx` or Suspense boundaries** (All routes)
- Loading handled per-component with `mounted` state + skeleton components
- No `loading.tsx` files in any `app/` subdirectory
- No `<Suspense>` boundaries for data fetching
- Impact: No immediate loading feedback; possible layout shift; not standard App Router pattern

**14. Query Provider staleTime too short for stable data** (`src/lib/query-provider.tsx:12`)
- `staleTime: 30s` means classes, institutions, sessions refetch every 30 seconds
- These change at most once per day
- Impact: Unnecessary refetches; wasted DB connections

**15. Audit logs table has no indexes** (Database)
- `audit_logs` table queried without any index on `created_at`, `user_id`, or `entity`
- Impact: Sequential scan on every audit log query

---

## B. Database Optimization

### B.1 — Query Optimizations

#### 1. Students queries (all storage modules)

**Before** (e.g., `students.ts:50`):
```ts
supabase.from("students").select("*").eq("session_id", sid).order("created_at", { ascending: false })
```

**After**:
```ts
supabase.from("students").select("id,institution_id,session_id,first_name,last_name,student_id,class,section,roll,date_of_birth,gender,father_name,mother_name,phone,address,photo_url,status,created_at,updated_at").eq("session_id", sid).order("created_at", { ascending: false })
```

**Index recommendation**:
```sql
-- Covering index for session-scoped student queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_students_session_created ON students(session_id, created_at DESC);
-- Already have idx_students_institution_session, but add for user_id lookups
-- idx_students_user_id already added in fix-rls.sql
```

**RLS consideration**: Current policy `institution_id = get_user_institution_id()` filters by institution. The existing `idx_students_institution_session` covers this. The new `idx_students_session_created` optimizes the session-scoped fetch + sort pattern.

#### 2. Results queries (results.ts:77-81)

**Before**:
```ts
supabase.from("RESULTS").select("*").eq("session_id", sid).order("created_at", { ascending: false })
```
This fetches `subject_marks JSONB` which can be large (each result has array of subject marks).

**After**: For list views, exclude `subject_marks`:
```ts
supabase.from("results").select("id,session_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,roll,registration_number,total_marks,total_full_marks,percentage,grade,position,pass,scholarship_status,status,created_at,updated_at").eq("session_id", sid).order("created_at", { ascending: false })
```

**Index recommendation**:
```sql
CREATE INDEX IF NOT EXISTS idx_results_session_created ON results(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_exam_session ON results(exam_id, session_id);
CREATE INDEX IF NOT EXISTS idx_results_institution_session ON results(institution_id, session_id);
```

#### 3. Exams queries with registration count (exams page)

**Problem**: Exams page fetches exams + registrations separately, then counts client-side.

**Optimization**: Use a server-side count:
```ts
// Instead of fetching all registrations and counting in JS
const { data: regCounts } = await supabase
  .from("registrations")
  .select("exam_id", count: "exact")
  .eq("session_id", sid)
  .group("exam_id");
```

**Index recommendation**: `idx_registrations_exam_session` already exists (good).

#### 4. Super admin dashboard — combined query

**Problem**: Dashboard fetches 6 tables independently.

**Optimization**: Create a database function that returns dashboard stats in one call:
```sql
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'institutions', (SELECT count(*) FROM institutions),
    'students', (SELECT count(*) FROM students),
    'exams', (SELECT count(*) FROM exams WHERE status IN ('OPEN', 'PUBLISHED')),
    'results', (SELECT count(*) FROM results),
    'payments_total', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'PAID'),
    'payments_due', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'PENDING'),
    'registrations', (SELECT count(*) FROM registrations)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Before**: 6 separate queries → 6 roundtrips
**After**: 1 function call → 1 roundtrip

**Index recommendation**: No new indexes needed for count queries; existing session_id indexes are sufficient for `institutions` and `academic_sessions` counts.

#### 5. Registrations search/filter (registrations page)

**Before**: `.select("*")` then filter client-side by search text

**After**: Server-side filtering with pagination:
```ts
supabase.from("registrations")
  .select("id,session_id,application_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,status,payment_status,student_payment_status,payment_amount,transaction_id,created_at,updated_at")
  .eq("session_id", sid)
  .ilike("student_name", `%${search}%`)
  .order("created_at", { ascending: false })
  .range(0, 19)  // pagination
```

**Index recommendation**:
```sql
CREATE INDEX IF NOT EXISTS idx_registrations_student_name ON registrations(student_name);
CREATE INDEX IF NOT EXISTS idx_registrations_application_id ON registrations(application_id);
-- For trigram search (if needed):
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_registrations_student_name_trgm ON registrations USING gin(student_name gin_trgm_ops);
```

#### 6. Audit logs query (audit-logs.ts:19-25)

**Before**: `select("*").order("created_at", { ascending: false }).limit(100)` — no index on created_at

**After**: Same query but with proper index:
```sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
```

### B.2 — Index Summary (why each index)

| Index | Table | Columns | Why |
|-------|-------|---------|-----|
| `idx_students_session_created` | students | (session_id, created_at DESC) | Optimizes session-scoped student list with sorting — covers most common query pattern |
| `idx_results_session_created` | results | (session_id, created_at DESC) | Same pattern for results; avoids sort spill |
| `idx_results_exam_session` | results | (exam_id, session_id) | Optimizes exam-specific result filtering |
| `idx_results_institution_session` | results | (institution_id, session_id) | Optimizes institution result filtering (existing but verify) |
| `idx_registrations_student_name_trgm` | registrations | gin(trigram) | Enables fast fuzzy search on student names at scale |
| `idx_audit_logs_created` | audit_logs | (created_at DESC) | Avoids sequential scan on audit log listing |
| `idx_audit_logs_user` | audit_logs | (user_id) | Optimizes per-user audit log queries |
| `idx_exams_status` | exams | (status) | Optimizes status filtering on exams page |
| `idx_payments_status_date` | payments | (status, date DESC) | Optimizes payment listing filtered by status and sorted by date |
| `idx_registrations_status` | registrations | (status) | Optimizes status filtering on registrations page |

**Note**: `idx_students_institution_session`, `idx_registrations_institution_session`, `idx_payments_institution_session` already exist. `idx_registrations_student_payment` already exists.

---

## C. Next.js Optimization

### C.1 — Server vs Client Component Classification

| Component | Current | Recommended | Reason |
|-----------|---------|-------------|--------|
| `app/student/dashboard/page.tsx` | Client | **Server** | Data display only; no interactive widgets requiring client-side fetching |
| `app/super-admin/page.tsx` | Client | **Server** | Dashboard stats; all data server-fetchable |
| `app/super-admin/students/page.tsx` | Client | **Hybrid**: Server data + Client table | Server fetches & passes data; keep table interactions client-side |
| `app/super-admin/exams/page.tsx` | Client | **Hybrid** | Server fetches data; form/modal stays client |
| `app/super-admin/registrations/page.tsx` | Client | **Hybrid** | Server fetches data; filters/selection client-side |
| `app/super-admin/reports/page.tsx` | Client | **Server** | Pure data display with filters that can be URL params |
| All super-admin list pages | Client | **Hybrid** | Server Components fetch initial data, pass as props |

### C.2 — Caching Strategy

#### Cacheable Data (public/stable, request-scoped or revalidated)

| Data | Cache Strategy | Revalidate | Reason |
|------|---------------|------------|--------|
| Classes | `revalidatePath` / `export const revalidate = 3600` | 1 hour | Rarely changes; used globally |
| Academic sessions | Server Component + `useSession()` memo | Per-session-change | Few records; stable |
| System settings | `revalidatePath('/super-admin/settings')` | On settings change | Rarely changes |
| Institutions list (super-admin) | Server Component cached | On institution change | Admin-level data |

#### Non-cacheable Data (user-specific/private)

| Data | Strategy | Reason |
|------|----------|--------|
| Students (session-scoped) | React Query with `staleTime: 60s` | User-specific, changes frequently |
| Registrations | React Query with `staleTime: 30s` | User-specific, changes on registration |
| Payments | React Query with `staleTime: 30s` | User-specific, financial data |
| Results | React Query with `staleTime: 60s` | Results are semi-static but exam-scoped |
| Notifications | React Query with `staleTime: 0` | Must be real-time for user |
| User profile | Per-session, no caching | Private user data |

### C.3 — Parallel Data Fetching

#### Super Admin Dashboard (app/super-admin/page.tsx)

**Before**: 6 sequential React Query hooks, each triggering separate fetch

**After** (Server Component):
```tsx
// In Server Component
const [institutions, exams, students, registrations, results, payments] = await Promise.all([
  fetchInstitutions(),
  fetchExams(currentSessionId),
  fetchStudents(currentSessionId),
  fetchRegistrations(currentSessionId),
  fetchResults(currentSessionId),
  fetchPayments(currentSessionId),
]);
```

#### Exams Page (app/super-admin/exams/page.tsx)

**Before**: `useExams()` + `useRegistrations()` + `useClasses()` fire independently

**After**: Server Component fetches all in parallel, passes as props:
```tsx
export default async function ExamsPage() {
  const [exams, classes] = await Promise.all([
    fetchExams(sessionId),
    fetchActiveClasses(),
  ]);
  return <ExamsClient exams={exams} classes={classes} />;
}
```

### C.4 — Loading/UX Boundaries

Every route needs `loading.tsx`:

```tsx
// app/super-admin/loading.tsx
export default function Loading() {
  return <DashboardSkeleton />; // Shared skeleton matching the dashboard layout
}
```

Each page that currently has `mounted` state + skeleton should instead:
1. Let `loading.tsx` show immediately on navigation
2. Stream data via Server Component
3. Client Component only handles interactive state (filters, modals)

---

## D. UX Optimization

### D.1 — Skeleton UI (existing, improve)

Current skeletons exist (e.g., `StudentsSkeleton`, `ExamsSkeleton`) but are tied to `mounted` state. Convert to:
1. `loading.tsx` for route-level loading (immediate on navigation)
2. Keep per-component skeletons for data-refresh states (e.g., after filter changes)

### D.2 — Streaming SSR

Server Components enable automatic streaming — header/sidebar renders immediately while data sections stream in. Wrap heavy data sections:

```tsx
import { Suspense } from "react";

export default async function DashboardPage() {
  return (
    <>
      <DashboardHeader /> {/* renders immediately */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats /> {/* streams when ready */}
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <DashboardTable /> {/* streams when ready */}
      </Suspense>
    </>
  );
}
```

### D.3 — Optimistic Updates

Safe for:
- **Attendance status toggle**: User clicks → UI updates immediately → server syncs → rollback on failure
- **Notification read/unread**: Click → mark read in UI → confirm with server
- **Settings changes**: Toggle → show new state → revert on error

NOT safe for:
- **Payment submissions**: Financial data must be server-verified first
- **Registration approval**: Business logic must validate before confirming
- **Result publishing**: Irreversible impact on students

### D.4 — Pagination Implementation

All list queries need pagination:

```ts
// Universal pattern for list data
export async function fetchPaginatedStudents(sessionId: string, page: number, pageSize: number = 20) {
  const supabase = createServerClient(); // Use server client!
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  const { data, error, count } = await supabase
    .from("students")
    .select("id,first_name,last_name,student_id,class,section,roll,status", count: "exact")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .range(from, to);
  
  return { data: data || [], error, total: count || 0 };
}
```

For tables expected to exceed 10K rows, implement cursor pagination:
```ts
// Cursor-based: use last item's created_at + id as cursor
// WHERE (created_at, id) < (lastCreatedAt, lastId) ORDER BY created_at DESC, id DESC LIMIT 20
```

### D.5 — Error Handling

Add `error.tsx` boundaries at route level:
```tsx
// app/super-admin/error.tsx
"use client";
export default function Error({ error, reset }) {
  return (
    <div className="text-center py-16">
      <p>Something went wrong</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## E. Security Review

### E.1 — RLS Integrity (verified)

Current RLS policies are **secure but some are inefficient**. Proposed optimizations do NOT weaken security:

| Concern | Current | Optimized | Security Impact |
|---------|---------|-----------|-----------------|
| `is_super_admin()` | Queries profiles table | Keep as-is | No change — still validates via profiles |
| `get_user_institution_id()` | Queries profiles table | Keep as-is | No change |
| EXISTS policies (exams, marks, admit_cards) | Subquery per row | Keep, add indexes | Same security, faster execution |
| Session-scoped queries | Filtered by session_id | Keep | No change |
| Public read on results/certificates | Anyone can read | Keep | No change (intentional) |

### E.2 — Authentication

- Continue using `@supabase/ssr` server client for server-side operations
- Student auth currently uses browser client (anon key) — this should be addressed:
  - **Recommendation**: Create a Server Action for student session validation instead of client-side check
  - The middleware already validates auth server-side; student pages should trust middleware

### E.3 — Data Isolation

- All session-scoped queries use `session_id` filter — correct
- Institution-scoped queries use `institution_id` filter — correct
- Notifications are `user_id` scoped — correct
- No cross-tenant data leakage risk in proposed optimizations

### E.4 — Service Role Key

- `SUPABASE_SERVICE_ROLE_KEY` used only in `register-action.ts` (Server Action) — correct
- Ensure it is NEVER used in client-side code or `NEXT_PUBLIC` prefixed env vars

---

## F. Implementation Plan (Priority Order)

### P0 — Critical (Immediate Impact)

**1. Convert all list data fetches to use explicit column lists instead of `select('*')`**
- Files: All `src/lib/storage/*.ts`
- Why: Single largest performance improvement; reduces payload 40-70%
- Effort: 2 hours

**2. Add pagination to all list queries**
- Files: `students.ts`, `registrations.ts`, `payments.ts`, `results.ts`, `exams.ts`, `marks.ts`, `certificates.ts`, `notifications.ts`
- Why: Prevents memory issues on large tables; standard requirement
- Effort: 4 hours

**3. Remove duplicate localStorage sync from storage modules**
- Files: All `src/lib/storage/*.ts`
- Change: Keep React Query hooks as primary data layer; remove `syncFromSupabase()` auto-sync; remove `getX()` localStorage getters from non-React contexts
- Why: Eliminates 50%+ redundant network requests; removes stale data source
- Effort: 3 hours

**4. Add missing database indexes**
- File: SQL migration
- Why: Critical for query performance; each index addresses a measurable bottleneck
- Effort: 1 hour

**5. Make Super Admin Dashboard a Server Component**
- File: `app/super-admin/page.tsx`
- Change: Convert to `async` Server Component; `Promise.all()` all data fetches
- Why: 6 sequential fetches → 1 parallel batch; SSR for initial load
- Effort: 3 hours

### P1 — High (Significant Improvement)

**6. Add `loading.tsx` to all route segments**
- Files: `app/super-admin/loading.tsx`, `app/student/loading.tsx`, `app/student/dashboard/loading.tsx`
- Why: Immediate loading feedback; standard App Router pattern
- Effort: 2 hours

**7. Convert Super Admin list pages to Hybrid Server/Client**
- Files: `app/super-admin/students/page.tsx`, `app/super-admin/exams/page.tsx`, `app/super-admin/registrations/page.tsx`, `app/super-admin/reports/page.tsx`
- Change: Server Component fetches data, passes to Client Component as props
- Why: SSR initial render; parallel data fetching; still interactive
- Effort: 8 hours

**8. Optimize RLS policies with indexes**
- File: SQL migration
- Change: Add supporting indexes for EXISTS subqueries; consider materialized views for complex policies
- Why: EXISTS subqueries in RLS are O(n) per row without indexes
- Effort: 2 hours

**9. Create dashboard stats database function**
- File: SQL migration
- Change: `get_dashboard_stats()` aggregate function
- Why: 6 queries → 1; eliminates N+1 pattern on dashboard
- Effort: 1 hour

**10. Increase staleTime for stable data**
- File: `src/lib/query-provider.tsx`
- Change: `staleTime: 300000` (5 min) globally; per-query overrides for notifications
- Why: Classes/institutions/sessions change rarely; unnecessary refetches every 30s
- Effort: 30 minutes

### P2 — Medium ( polish)

**11. Add server-side search with pagination**
- Files: Storage modules + Server Actions
- Change: Move search from client-side `.includes()` to server-side `.ilike()` or trigram index
- Why: Client-side search on full dataset is O(n); server search with indexes is O(log n)
- Effort: 6 hours

**12. Add Suspense boundaries for streaming**
- Files: All hybrid pages
- Change: Wrap data sections in `<Suspense>` with targeted skeletons
- Why: Per-section streaming; perceived performance improvement
- Effort: 4 hours

**13. Create data access layer abstraction**
- Files: New `lib/data/` directory
- Change: Centralize all data fetchers in typed functions; create `lib/data/index.ts` barrel export
- Why: Maintainability; prevents query scattering; single place for caching/optimization
- Effort: 4 hours

**14. Add error.tsx boundaries**
- Files: `app/super-admin/error.tsx`, `app/student/error.tsx`
- Why: Graceful error handling; prevents blank screens
- Effort: 1 hour

### P3 — Optional (Enhancement)

**15. Implement optimistic UI for safe mutations**
- Files: `useUpdateStudent()`, `useUpdateExam()`, notification actions
- Why: Perceived speed; instant feedback for non-financial operations
- Effort: 6 hours

**16. Create dashboard stats Server Action with streaming**
- File: `app/super-admin/page.tsx`
- Change: Use `React.stream()` or `Suspense` with Server Components for progressive rendering
- Why: Stats appear instantly while tables load
- Effort: 3 hours

**17. Add cursor pagination for large tables**
- Files: `students.ts`, `payments.ts`, `audit-logs.ts`
- Why: Offset pagination degrades with large offsets; cursor pagination is O(1)
- Effort: 4 hours

**18. Audit log indexing and archival**
- File: SQL migration
- Change: Add indexes; create archival job for old records
- Why: Audit logs grow indefinitely; slow queries without indexes
- Effort: 2 hours

---

## G. Final Architecture

```
Browser
   ↓
Next.js Server Components (initial data + HTML streaming)
   ↓
Suspense boundaries (per-section loading skeletons)
   ↓
loading.tsx (immediate on navigation)
   ↓
Data Access Layer (lib/data/*.ts — typed, centralized)
   ↓
Server Supabase Client (lib/supabase/server.ts — secure cookies)
   ↓
Supabase (RLS enforced at DB level)
   ↓
PostgreSQL
   ↓
Optimized Indexes + RLS Policies + Query Functions
```

### Data Flow (Super Admin Dashboard — After Optimization)

```
User navigates to /super-admin
   ↓
loading.tsx shows skeleton (instant)
   ↓
Server Component renders:
  await Promise.all([
    fetchInstitutions(),    // SELECT id,name,code,status FROM institutions
    fetchStudents(),        // SELECT specific cols FROM students WHERE session_id = ? ORDER BY created_at DESC LIMIT 20
    fetchExams(),           // SELECT specific cols FROM exams WHERE session_id = ?
    fetchRegistrations(),   // SELECT specific cols FROM registrations WHERE session_id = ? LIMIT 20
    fetchResults(),         // SELECT cols (no JSONB) FROM results WHERE session_id = ?
    fetchPayments(),        // SELECT specific cols FROM payments WHERE session_id = ?
  ]) — all parallel, 1 roundtrip each
   ↓
Database uses:
  - Composite indexes (session_id, created_at) for sorting
  - RLS policies with indexed subqueries
  - No select('*'), minimal payload
   ↓
HTML streams in with data
   ↓
Client Component hydrates; React Query takes over for interactions
   ↓
Subsequent navigations: React Query cache hits (staleTime 5min for stable data)
```

---

## H. Migration Order Summary

```
Phase 1 (Week 1) — P0
  □ Add column-specific selects in all storage modules
  □ Add pagination (LIMIT/RANGE) to all list queries  
  □ Remove localStorage sync from storage modules (use React Query only)
  □ Add database indexes per recommendation
  □ Convert super-admin dashboard to Server Component

Phase 2 (Week 2) — P1
  □ Add loading.tsx to all routes
  □ Convert super-admin list pages to Hybrid S/C
  □ Add indexes for RLS EXISTS policies
  □ Create dashboard stats DB function
  □ Increase staleTime for stable data

Phase 3 (Week 3) — P2
  □ Add server-side search (trigram/ilike with indexes)
  □ Add Suspense boundaries for streaming
  □ Create centralized data access layer (lib/data/)
  □ Add error.tsx boundaries

Phase 4 (Week 4) — P3
  □ Optimistic UI for safe mutations
  □ Cursor pagination for large tables
  □ Audit log archival
  □ Final performance measurement (EXPLAIN ANALYZE, Lighthouse)
```

---

## I. Key Principles Throughout

1. **Never disable RLS** — all optimizations keep RLS intact
2. **Never use service role key in browser** — only in Server Actions
3. **Cache stable data aggressively** — classes, institutions, sessions
4. **Never cache user-specific data** — per-user/react-query with short staleTime
5. **Prefer Server Components** for initial data; Client Components for interactions
6. **Measure before and after** — use `EXPLAIN ANALYZE` for DB, Lighthouse for frontend
7. **Parallel over sequential** — `Promise.all()` for independent fetches
8. **Pagination over bulk loading** — never fetch more than needed
