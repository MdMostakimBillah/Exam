# Marks Management Redesign Plan

## Goal

Redesign `/super-admin/marks` into a theme-aware page with exactly two tabs:

1. **Grade Scale** — configure the exam’s editable percentage-to-grade scale and grade points, the pass percentage, and configurable scholarship percentage ranges.
2. **Mark Entry** — filter approved candidates by exam and class, optionally narrow by institution, search and paginate the students, and autosave valid mark changes with clear cell-level status.

Result processing remains a separate workflow on `/super-admin/results`; it is not a third Marks tab and is never triggered by a mark keystroke.

## Confirmed product decisions

- Grade bands are shared by all subjects within an exam, not configured separately per subject.
- Grade and scholarship configuration is per exam.
- The Exams page owns subject configuration; Grade Scale owns only grading, grade points, pass percentage, and scholarships.
- Scholarship categories are user-defined named ranges. Students outside all configured ranges are `NOT_ELIGIBLE`.
- Grade scale rows use editable minimum and maximum percentages plus grade points, with validation for bounds, ordering, overlap, and complete 0–100 coverage. Default points are A+ 5.0, A 4.0, A- 3.5, B 3.0, C 2.0, D 1.0, and F 0.0.
- Mark Entry requires exam and class, makes institution optional, and defaults to all institutions. Selecting one institution narrows the same class view.
- Mark Entry is subject-first: one selected subject and a student table, not an all-subject matrix.
- Only `APPROVED` registrations are eligible.
- Changes save automatically after a short debounce and immediately on blur.
- A blank new mark is not written. Clearing an existing mark requires an explicit confirmed clear action.
- Marks allow decimals, normalized to two decimal places, and must be within `0..fullMarks`.
- Mark Entry shows live subject percentage and grade; final total grade and scholarship are calculated during result processing.
- Use the existing light/dark application theme and brand accent, with semantic colors for grades, save states, validation, and scholarship categories.
- Use server-side pagination and search for large class-wide tables.
- Add keyboard navigation and a copy-to-selected helper.
- Grade Scale saves grading, grade points, pass percentage, and scholarship categories through one atomic action; it does not modify exam subjects.
- Existing processed or published results do not change when setup is saved; new rules apply on the next explicit result-processing action.
- Mark-entry writes and setup remain super-admin-only; the existing student-own-mark read policy is not part of this UI.

## Current implementation problems to address

- `MarksMatrix` and `MarksProcessPanel` are currently orphaned; the latter will be moved to the Results page.
- `MarksSetupPanel` edits raw JSON and can replace the exam’s entire subject array.
- `MarksEntryPanel` loads an uncapped sheet, performs a state update from `useMemo`, converts blank values to zero, and does not support institution filtering, pagination, search, or autosave state.
- `save_exam_marks` receives camelCase JSON from TypeScript but the SQL RPC reads snake_case keys, so current saves can be rejected as missing fields.
- The marks RPCs compare the database role to uppercase `SUPER_ADMIN` even though profile roles are stored lowercase; new RPCs must use `public.is_super_admin()` or a case-insensitive check.
- The current grading helper is global, while the new requirement is per-exam configuration.
- The current result processor inserts `NULL` institution fields even though the checked-in results schema declares those fields `NOT NULL`, and it assumes the grading setting is an array even though the app stores an object.
- Result scholarship storage is restricted to the current fixed category names, which conflicts with configurable category names.
- Mark query invalidation uses `['marks']`, which does not match the current `['marks-sheet', ...]` key.

## Ordered implementation plan

### 1. Add the per-exam mark configuration data model

Create `supabase/migrations/0025_marks_management_redesign.sql` and update the baseline `supabase/schema.sql`. If `0025` was already applied before grade points were added, apply the follow-up `supabase/migrations/0026_grade_scale_points.sql`; when subjects are owned by Exams, apply `supabase/migrations/0027_grade_scale_only_setup.sql`.

Add `public.exam_mark_configs` with one row per exam:

- `exam_id` primary key and foreign key to `exams` with cascade delete.
- `grade_bands` JSONB containing `{ id, grade, points, minPercent, maxPercent }` rows.
- `scholarship_categories` JSONB containing `{ id, name, minPercent, maxPercent }` rows.
- `pass_percent` numeric.
- `version` integer incremented on each successful setup save.
- `updated_by`, `created_at`, and `updated_at` audit fields.

Backfill one configuration row for every existing exam. Preserve valid values from the current global grading setting where possible; otherwise seed the default scale and default scholarship ranges. Do not alter existing result rows during backfill.

Add supporting indexes for marks-sheet reads, including registration/exam/subject lookup and session/exam/class/institution filtering.

Add TypeScript types for the setup, grade bands, scholarship categories, setup version, and mark-sheet page rows.

### 2. Replace the RPC contract and harden server-side validation

Replace the existing `save_exam_marks` definition while keeping its RPC name. Standardize the JSON contract to snake_case keys: `registration_id`, `subject_id`, and `marks`. Update the client wrapper to map its camelCase domain type to that contract.

The replacement RPC must:

- Authorize with `public.is_super_admin()`.
- Verify the exam exists.
- Verify each registration belongs to the supplied exam and approved status.
- Verify the subject belongs to the selected class/exam configuration.
- Validate finite numeric marks within `0..fullMarks` and the configured decimal precision.
- Upsert one mark per registration/subject.
- Return structured `saved`, `updated`, and `rejected` rows with human-readable reasons.

Add `clear_exam_mark(p_exam_id, p_registration_id, p_subject_id)`. It must authorize the caller, verify the registration/exam relationship, delete only the selected mark, and return a clear result for the explicit clear action.

Add `save_exam_mark_setup(p_exam_id, p_subjects, p_grade_bands, p_scholarship_categories, p_pass_percent)`. It must:

- Authorize the super admin.
- Validate that all class IDs belong to the exam.
- Validate subject IDs, names, full marks, pass marks, durations, and negative marks.
- Validate grade ranges cover 0–100 without overlap, grade points are between 0 and 5, and scholarship ranges do not overlap.
- Reject reserved or duplicate scholarship names.
- Update `exams.subjects` and upsert `exam_mark_configs` in one transaction.
- Increment and return the setup version.

Add `get_marks_sheet_page(p_exam_id, p_class_id, p_institution_id, p_subject_id, p_search, p_page, p_page_size)`. It must return JSON containing the visible rows, total matching count, page metadata, and summary counts. The query must:

- Restrict to the current exam/session and `APPROVED` registrations.
- Resolve the selected class ID to the class name currently stored on registrations.
- Apply the optional institution filter.
- Search safely across student name, registration number, institution name, and exam roll.
- Return only the selected subject’s mark and its full-mark value.
- Return an exact count for pagination.
- Authorize the caller before returning cross-institution data.

Use one consistent database role check for all SECURITY DEFINER functions and grant execution only to the intended authenticated role.

### 3. Add per-exam setup storage and shared calculation helpers

Create `src/lib/storage/mark-setup.ts` with:

- `fetchExamMarkSetup(examId)`.
- `useExamMarkSetup(examId)`.
- `saveExamMarkSetup`.
- `useSaveExamMarkSetup`.
- Client-side validation and normalization for grade/category/subject data.
- Default grade bands, default scholarship categories, and default pass percentage.

Refactor `src/lib/storage/grading.ts` or add equivalent shared pure helpers so percentage-to-grade and percentage-to-scholarship calculations accept the selected exam configuration. Keep the old global scale only as a migration/fallback path; new Marks and Results code must use the per-exam configuration.

Update status helpers and badges so custom scholarship names display correctly while `NOT_ELIGIBLE` and `PENDING` retain reserved meanings.

### 4. Rebuild Grade Scale

Rewrite `src/components/marks/MarksSetupPanel.tsx` without raw JSON textareas.

Layout and behavior:

- Select one exam first.
- Show all classes belonging to that exam as responsive sections or class tabs.
- For each class, show editable subject rows with name, full marks, pass marks, duration, and negative marks.
- Provide add/remove subject controls and stable subject IDs.
- Show the exam-wide Grade Scale editor with grade, grade points, minimum percentage, and maximum percentage. Subjects and class marks are edited on the Exams page.
- Show the pass-percentage field.
- Show an editable scholarship-category table with name, minimum percentage, and maximum percentage.
- Reserve `NOT_ELIGIBLE` as the automatic outside-all-ranges result.
- Include a rule-preview control that accepts a sample percentage and shows the resulting grade and scholarship category.
- Use one primary `Save Setup` action.
- Disable saving until the form is valid and show an unsaved-changes indicator.
- Warn before changing exams with unsaved edits.
- Show a success toast and last-saved/version state after a successful atomic save.
- Use the existing light/dark theme, brand accent, bilingual labels, responsive spacing, and semantic validation states.

Update `src/app/super-admin/marks/page.tsx` to retain exactly the two required tabs, remove unused imports, and use a consistent themed page shell. Do not mount the matrix or processing panels here.

Update the Exams page so subject and mark configuration remains the source of truth. Preserve exam/classes creation and restore the subject-and-mark editor; Grade Scale handles grading and scholarship rules only.

### 5. Rebuild Mark Entry as a paginated autosaving table

Rewrite `src/components/marks/MarksEntryPanel.tsx` and extend `src/lib/storage/marks.ts`.

Filter state:

- Exam, required.
- Class, required and limited to classes configured for the selected exam.
- Institution, optional; default to `All institutions`.
- Subject, required and limited to subjects configured for the selected class.
- Search, debounced and applied server-side.
- Page and page size, with a default page size of 50.

Use `useExamMarkSetup` for the selected subject’s full marks and grade bands. Show a context summary with selected exam/class/institution, total approved candidates, institutions represented, entered count, and missing count.

Table columns:

- Exam roll.
- Student name.
- Institution.
- Registration number.
- Mark input.
- Subject percentage.
- Subject grade.
- Save status.

For each cell, maintain a local revision and one of these states: `idle`, `dirty`, `saving`, `saved`, or `error`.

Autosave behavior:

- Keep a text/number value while editing so decimals and partial input are not lost.
- Validate on change and on blur; do not call the database for blank new values or invalid values.
- Debounce valid changes by approximately 600 ms.
- Flush a valid pending change immediately on blur.
- Save one cell through the corrected RPC rather than submitting the whole table.
- Mark a cell saved only if the response corresponds to the latest local revision.
- Keep the value dirty and expose a retry action on failure.
- Cancel timers when filters, subject, exam, or page change; flush or warn before navigating away so a pending valid edit is not silently lost.
- Implement explicit confirmed clearing for an already saved mark.

Entry UX:

- Enter and arrow keys move between mark inputs while preserving the current row order.
- Add row selection and a copy-to-selected helper that applies one valid value to selected rows and reports failures.
- Use `inputMode="decimal"`, `step="0.01"`, min/max validation, inline error text, and a neutral `Not entered` state.
- Provide loading, empty, no-search-results, and no-approved-registration states.
- Keep the table responsive; use a compact mobile layout or horizontal scroll without forcing a wide matrix.

Update query keys so mark saves invalidate the exact marks-sheet-page prefix and related exam setup caches, not only the generic `['marks']` key.

### 6. Add the separate result-processing workflow to Results

Update `src/components/marks/MarksProcessPanel.tsx` to be the processing card mounted on `src/app/super-admin/results/page.tsx`. Keep the Marks route to two tabs.

Rewrite `process_exam_results` to:

- Authorize with `public.is_super_admin()`.
- Read the selected exam’s per-exam setup.
- Use approved registrations from all institutions.
- Resolve global and class-specific subjects for each registration class.
- Process only students who have a saved mark for every required subject for their class.
- Report processed, skipped, missing-incomplete, and total counts.
- Preserve institution ID and name from the registration.
- Calculate total marks, total full marks, percentage, grade, pass/fail using the exam’s `pass_percent`, and the configured scholarship category.
- Store the setup version used to produce each result.
- Upsert results by `(exam_id, student_id)` and reset explicitly reprocessed rows to `DRAFT`.
- Never run automatically from a mark save.

Before replacing the results check constraint, normalize any legacy `ELIGIBLE` values safely. Widen `results.scholarship_status` to allow configured category names while retaining `NOT_ELIGIBLE` and `PENDING` as reserved values. Add `results.mark_setup_version INTEGER` for the configuration version used during processing, and select/map it in the TypeScript result types.

Update `src/lib/storage/results.ts` so the exam-results query supports the processing panel’s count/display needs rather than relying on a default first page of 20.

Update the super-admin Results page, institution Results page, public result page, and result status helpers to display arbitrary configured category names. The institution Results page must also use the selected exam’s configuration for manual recalculation rather than the old global defaults, and correct its existing result-registration comparison bug.

Setup saves do not recompute existing results. An explicit process action is the only operation that changes processed result rows.

### 7. Remove dead marks implementations and preserve compatibility

- Remove `src/components/marks/MarksMatrix.tsx`; the confirmed subject-first workflow does not expose a matrix.
- Preserve the old batch `useSaveExamMarks` API only if another caller needs it; otherwise migrate all callers to the corrected cell/filtered APIs.
- Keep the current route and sidebar URL unchanged.
- Do not add an institution-admin mark-entry route; the current super-admin-only permission remains in force.

## Validation plan

### Static validation

Run after implementation:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

### Database validation

Apply the new migration in a staging Supabase project first, then verify:

- Existing exams receive valid default per-exam setup rows.
- Setup saves reject overlaps, gaps, invalid bounds, duplicate category names, and invalid subject/class data without partial writes.
- Two exams can hold different grade and scholarship policies without cross-contamination.
- `save_exam_marks` accepts the client payload, validates range, upserts, and returns rejected reasons.
- `clear_exam_mark` removes only the selected registration/exam/subject row.
- `get_marks_sheet_page` returns correct totals and filters for all-institution Class 5, one institution, search, and pagination.
- Blank input creates no mark; explicit clear deletes an existing mark.
- A non-super-admin cannot call setup, save, clear, or process functions.
- Result processing excludes incomplete students, handles custom categories, preserves institution fields, and leaves prior results unchanged until explicitly reprocessed.

### Manual UX scenarios

1. Select an exam and edit subjects/classes in both light and dark themes.
2. Save valid setup and verify the version/preview update.
3. Attempt overlapping grade/category ranges and verify inline prevention.
4. Select Class 5 with `All institutions` and confirm students from multiple institutions appear.
5. Narrow to one institution, search by name/registration/roll, and page through results.
6. Enter decimal marks rapidly, blur a cell, and verify saving/saved/error transitions.
7. Navigate away with a pending valid edit and verify it flushes or warns.
8. Use keyboard navigation and copy-to-selected on a multi-institution page.
9. Clear a saved mark through the explicit action and verify confirmation.
10. Process a complete and an incomplete exam from the Results page and verify counts and category labels.
11. Confirm existing published results remain unchanged after setup edits and change only after explicit processing.

## Main risks and mitigations

- **Class identity:** registrations currently store `class_name`, not `class_id`; resolve class IDs through the existing class-name model and avoid assuming duplicate class names are supported. Add a future class-id migration only if duplicate names are found in production.
- **Concurrent autosave:** use per-cell revisions and cancel stale responses so an older request cannot overwrite a newer local value.
- **Filter changes:** flush or block navigation while valid saves are pending; never silently discard them.
- **Database deployment order:** apply the migration and verify RPC signatures before deploying the client that calls them.
- **Legacy configuration:** preserve valid existing grading values during backfill and keep fallback defaults until every exam has a config row.
- **Custom category compatibility:** widen the database/type/UI status handling together so arbitrary names are never rejected at only one layer.

## Scope boundaries

Included: Marks page redesign, per-exam setup, filtered/paginated Mark Entry, explicit autosave/clear behavior, per-subject live grade feedback, server-side marks-sheet queries, RPC/data fixes, and the separate Results processing workflow.

Excluded: institution-admin mark-entry permissions, automatic result processing on mark saves, an all-subject matrix in the Marks page, public result downloads/printing, and changes to unrelated registration/payment workflows.
