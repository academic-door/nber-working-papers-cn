# Cloudflare NBER Release Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested Cloudflare Cron Worker that independently dispatches the existing NBER release detector every 15 minutes inside the approved release window without moving any NBER source-truth or publication logic outside the owner repo.

**Architecture:** A scheduled-only JavaScript Worker runs at staggered UTC minutes, converts `controller.scheduledTime` to `America/New_York`, and dispatches only `detect-weekly-release.yml` on `main` when inside the approved Sunday/Monday/Tuesday local window. GitHub's native schedule remains redundant; the existing detector and publication pipeline remain authoritative.

**Tech Stack:** Cloudflare Workers JavaScript modules, Wrangler TOML, Node.js built-in test runner, existing Python `unittest` regression suite, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-cloudflare-release-trigger.md`

## Global Constraints

- External Worker contains no NBER membership, translation, publication, or QA logic.
- External Worker dispatches only `academic-door/nber-working-papers-pipeline/.github/workflows/detect-weekly-release.yml` on `main`.
- GitHub credential is a Cloudflare secret only and is never committed or logged.
- Minimum fine-grained GitHub permission is repository `Actions: write` only.
- Existing 120-second release stability confirmation, duplicate publication suppression, fail-closed behavior, and QA remain unchanged.
- Native GitHub schedule remains enabled as best-effort redundancy.
- No shared-scheduler rollout to other subsystems is part of this change.

---

### Task 1: Add RED contract tests

**Files:**
- Create: `tests/test_external_release_trigger.mjs`
- Create: `tests/test_external_release_trigger_contract.py`
- Modify: `.github/workflows/regression.yml`

**Interfaces:**
- Consumes: approved scheduling and dispatch contract from the spec.
- Produces: executable expectations for `isReleaseWindow(date)`, `buildDispatchRequest(token)`, `runScheduled(controller, env, fetchImpl)`, the Wrangler cron, and the detector `trigger_source` input.

- [ ] **Step 1: Write failing JavaScript behavior tests** covering EST/EDT boundaries, outside-window no-op, missing secret failure, exact GitHub dispatch URL/ref/input/headers, and non-2xx failure.
- [ ] **Step 2: Write failing Python static contract test** requiring the Worker/config files and detector `trigger_source` input while preserving native schedule and 120-second confirmation.
- [ ] **Step 3: Update regression workflow** to install Node 24 and run `node --test tests/test_external_release_trigger.mjs` after the existing Python suite.
- [ ] **Step 4: Open a draft PR and verify RED**. Expected failure: Worker/config contract is absent on the test-only head; existing Python tests should otherwise remain intact.
- [ ] **Step 5: Record the RED workflow run** in PR/#68 evidence.

### Task 2: Implement the minimal Cloudflare trigger

**Files:**
- Create: `infra/cloudflare/nber-release-trigger/worker.mjs`
- Create: `infra/cloudflare/nber-release-trigger/wrangler.toml`
- Modify: `.github/workflows/detect-weekly-release.yml`

**Interfaces:**
- `isReleaseWindow(date: Date) -> boolean`: evaluates the scheduled timestamp in `America/New_York`.
- `buildDispatchRequest(token: string) -> { url: string, init: RequestInit }`: returns the fixed GitHub workflow-dispatch request.
- `runScheduled(controller, env, fetchImpl) -> Promise<{ dispatched: boolean, status?: number }>`: no-ops outside the approved window; otherwise requires `env.GITHUB_ACTIONS_DISPATCH_TOKEN` and dispatches GitHub.
- Default Worker export: `scheduled(controller, env, ctx)` delegates to `runScheduled` using global `fetch`.

- [ ] **Step 1: Implement pure New York window evaluation** for Sunday 18-23 and Monday/Tuesday 00-13.
- [ ] **Step 2: Implement fixed workflow-dispatch request** to the single owner repo/workflow/ref with `trigger_source=cloudflare-cron` and GitHub API version `2026-03-10`.
- [ ] **Step 3: Implement scheduled handler failure semantics**: missing secret or non-2xx GitHub response throws; error text is bounded and never contains the Authorization header/token.
- [ ] **Step 4: Add Wrangler config** with scheduled-only Worker identity, compatibility date `2026-09-14`, observability enabled, and cron `14,29,44,59 * * * SUN-TUE`.
- [ ] **Step 5: Add detector dispatch-source input and summary line** while leaving detector logic, permissions, concurrency, native schedule, and publication dispatch unchanged.
- [ ] **Step 6: Verify PR CI turns GREEN** on exact head: Python regression + Node Worker tests + existing verification workflows.

### Task 3: Document deployment/security runbook

**Files:**
- Modify: `docs/PRODUCTION_CONTROL.md`
- Create: `infra/cloudflare/nber-release-trigger/README.md`

**Interfaces:**
- Consumes: implemented Worker/config and approved credential boundary.
- Produces: Human Principal setup steps and durable acceptance procedure.

- [ ] **Step 1: Document reliability semantics**: GitHub schedule is best-effort; Cloudflare trigger is the independent observation clock; detector/publication source truth remains repo-local.
- [ ] **Step 2: Document credential creation**: fine-grained token scoped only to `academic-door/nber-working-papers-pipeline`, repository `Actions: write`, no additional repository permissions unless GitHub UI mechanically requires metadata read.
- [ ] **Step 3: Document secret placement** as Cloudflare secret `GITHUB_ACTIONS_DISPATCH_TOKEN`; explicitly prohibit chat/source/log storage.
- [ ] **Step 4: Document deployment and controlled verification** using Wrangler/dashboard, a scheduled-event test, GitHub Actions evidence, then real Cron evidence.
- [ ] **Step 5: Re-run exact-head CI and review the PR diff** for scope creep/secrets.

### Task 4: Merge repo-local contract and reach the real external checkpoint

**Files:** no new files expected.

- [ ] **Step 1: Merge only after exact-head CI and independent diff review are GREEN.**
- [ ] **Step 2: Verify `main` contains the merged contract.**
- [ ] **Step 3: Stop at the genuine Human Principal boundary** if the GitHub credential has not yet been created/placed in Cloudflare; provide only the minimum UI steps needed.
- [ ] **Step 4: After secret placement, execute controlled Cloudflare dispatch acceptance and capture GitHub run evidence.**
- [ ] **Step 5: Keep #68 open until at least one real Cloudflare Cron invocation during the approved release window is evidenced; then close #68 and resolve main-control #52 with durable acceptance pointers.