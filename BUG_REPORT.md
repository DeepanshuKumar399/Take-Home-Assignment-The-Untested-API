# Bug Report

## Bug 1 — `getByStatus` uses substring match instead of exact match

**File:** `src/services/taskService.js`, `getByStatus`

**Expected:** `GET /tasks?status=todo` returns only tasks with status `"todo"`.

**Actual:** Uses `t.status.includes(status)`, so querying `?status=in` matches `in_progress`, and querying `?status=done` would match any future status containing the word "done". Any partial string is a valid accidental filter.

**How discovered:** Reading the source. Confirmed by writing a test that filters by `"todo"` and checking that `in_progress` tasks are not returned.

**Fix:** Replace `.includes(status)` with strict equality `=== status`.

**Status: Fixed.** Changed in `src/services/taskService.js`.

---

## Bug 2 — `getPaginated` uses 0-based page index but the route defaults `page` to `1`

**File:** `src/services/taskService.js`, `getPaginated` / `src/routes/tasks.js`

**Expected:** `GET /tasks?page=1&limit=2` returns the first two tasks.

**Actual:** `offset = page * limit`, so `page=1, limit=2` produces `offset=2`, skipping the first two tasks entirely. Page 1 behaves like page 2. Page 0 would be needed to see the first results, but the route defaults `page` to `1` when the param is absent or invalid, making the first page unreachable through normal use.

**How discovered:** Writing a pagination test that created 5 tasks and expected `page=1` to return task 1. The test failed because task 3 was returned instead.

**Fix:** Change offset calculation to `(page - 1) * limit` so page 1 maps to offset 0.

**Status: Fixed.** Changed in `src/services/taskService.js`.

---

## Bug 3 — `completeTask` silently resets `priority` to `"medium"`

**File:** `src/services/taskService.js`, `completeTask`

**Expected:** Completing a task changes its `status` to `"done"` and sets `completedAt`. Priority is not affected.

**Actual:** The implementation hardcodes `priority: 'medium'` in the updated task object, silently overwriting whatever priority the task had. A `high`-priority task becomes `medium` the moment it is completed, with no documentation or validation explaining why.

**How discovered:** Reading the source. The line `priority: 'medium'` stands out immediately as unintentional — there is no business rule documented anywhere that would justify it.

**Fix:** Remove the `priority: 'medium'` line from the spread in `completeTask`.

**Status: Fixed.** Changed in `src/services/taskService.js`.

---

## Bug 4 — README documents the wrong status enum

**File:** `README.md`

**Expected:** README and ASSIGNMENT.md agree on the allowed status values.

**Actual:** README says `pending | in-progress | completed`. ASSIGNMENT.md and the actual source code (`validators.js`, `taskService.js`) use `todo | in_progress | done`. The README is stale.

**How discovered:** Comparing the two docs before writing any tests. The validator and service both use `todo | in_progress | done`, so the code and ASSIGNMENT.md are consistent — README is the outlier.

**Impact:** Any developer reading only the README will send invalid status values and get 400 errors with no obvious explanation.

**Fix:** Update README to reflect the actual enum: `todo | in_progress | done`.

**Status: Not fixed** (doc-only change, outside the scope of the code deliverables, but flagged here).

---

## Summary of fixes applied

| Bug | File | Fixed |
|-----|------|-------|
| `getByStatus` partial match | `src/services/taskService.js` | Yes |
| `getPaginated` off-by-one page | `src/services/taskService.js` | Yes |
| `completeTask` resets priority | `src/services/taskService.js` | Yes |
| README wrong status enum | `README.md` | No (doc only) |

---

## Submission notes

### What I'd test next

- Malformed JSON request bodies (Express should return 400, worth confirming)
- `page=0`, `limit=0`, and very large `limit` values — the pagination has no guard against these
- Due-date edge cases: tasks due exactly at the current millisecond, tasks with `dueDate` in the future
- Whether `PUT /:id` is truly a full replacement or a partial merge — the current implementation merges via spread, which means fields can never be cleared once set

### Anything that surprised me

The `priority: 'medium'` reset inside `completeTask` was the most surprising line in the codebase. It is not a validation error or an obvious typo — it looks intentional, but there is no comment, no test, and no spec entry that explains it. That is the kind of silent data mutation that causes real production bugs because nothing breaks loudly; data just comes back wrong.

### Questions I'd ask before shipping

1. **Which status enum is the source of truth?** The README and the assignment brief disagree. Clients, validators, and any future SDK need one canonical answer.
2. **Should `PUT /:id` be a true full replacement?** Right now it merges fields via object spread, so you cannot unset `description` or `dueDate` by omitting them. If clients expect REST semantics, this is a contract bug.
3. **Is there any authentication or rate limiting planned?** The assign endpoint stores arbitrary user names with no identity check. That is fine for an internal tool, but worth confirming before it is public-facing.
