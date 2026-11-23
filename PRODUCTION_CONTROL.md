# NBER Production Control

This document is the repo-local H1 control contract for the Academic Door Working Papers subsystem.

## Health authority

A production decision must not be inferred from repo HEAD, one workflow conclusion, or an open/closed Issue alone.

The canonical health snapshot is `reports/production-health-latest.json`. Every successful publication builds and persists a deployment-coupled snapshot in `.github/workflows/update-site.yml` after public Pages deployment and Composer sync. `.github/workflows/production-health.yml` independently refreshes the same canonical snapshot from the currently deployed Pages / pipeline / Composer evidence as a supplementary control-plane check. It joins four evidence layers:

1. official-source state from the deployed public `data/site_status.json`;
2. audited ready and translation reports for the same week;
3. the exact public `gh-pages` commit and the pipeline source SHA recorded in its deployment commit message;
4. the Composer downstream issue for the same week, including count and `qa_passed`.

`status=GREEN` requires every recorded check to pass. A RED snapshot is still persisted so the failed contract is inspectable.

The deployment-linked `canonical_metrics` block in this health snapshot is the current production metric authority. Checked-in artifacts such as `reports/source-truth-verification.json` and `reports/stale-translation-ledger.json` are point-in-time repo diagnostics: their `generated_at` may predate the current Pages deployment and their stale-translation count may therefore legitimately differ after the canonical source/metadata plane changes. Production health records these files under `diagnostic_snapshots` with their timestamps, counts, and `matches_current_canonical_stale`. A mismatch is observable but does not itself make production RED; it must not be interpreted as current release truth or used as a reason to call the translation model merely to align report counts.

## Incident lifecycle

`Update NBER pipeline` and `NBER SEO check` remain responsible for creating failure alerts. The release detector/watchdog may also create control-plane alerts when an official batch is ready but publication is not active, or when live release evidence remains blocked.

`.github/workflows/reconcile-incidents.yml` owns recovery reconciliation after successful `Update NBER pipeline` or `NBER SEO check` completions.

For update failures, it reads the deployed public status and closes only failure Issues whose incident date belongs to the same Monday week as the complete public latest week. This prevents an unrelated later success from silently closing an unresolved older publication incident.

The transient `[NBER publication watchdog] <week> official batch ready but publication not active` alert follows the same same-week rule: once a successful update leaves complete public production on that week, the publication-inactive condition is directly disproven and the watchdog alert is closed with recovery evidence.

`[NBER release rollover blocked]` and `[NBER release detector blocked]` alerts are intentionally not generically closed by any successful update. Controlled rebuilds can succeed from already accepted evidence without proving that those live detector conditions have cleared, so they remain explicit until separately verified.

For SEO failures, a successful live SEO check closes previous open SEO alerts because the check is site-wide and directly proves recovery of that condition.

Every automatic closure adds the successful run URL and recovery evidence before closing with `state_reason=completed`.

## Release observation control plane

The release detector is `.github/workflows/detect-weekly-release.yml`. Its source-truth semantics remain entirely repo-local: official NBER New This Week observation, the 120-second stability confirmation, duplicate suppression, publication dispatch, and fail-closed decisions are not delegated to any external scheduler.

GitHub Actions `schedule` is treated as **best-effort redundancy**, not as a 15-minute service-level clock. Issue `#68` records multi-hour gaps between schedule-created detector runs despite valid 15-minute cron configuration.

The Parent/Human Principal-approved independent trigger is `infra/cloudflare/nber-release-trigger/`:

- Cloudflare Cron invokes only a dedicated scheduled Worker;
- the Worker evaluates the scheduled timestamp in `America/New_York` and only acts during the bounded Sunday/Monday/Tuesday release window;
- before dispatch, it derives the current Monday release anchor and checks only GitHub Actions delivery/run metadata for that target week;
- if a non-expired `nber-<week>-delivery` artifact comes from a `main` workflow run that GitHub confirms completed successfully, the external detector dispatch is quiesced for that target week;
- if the acceptance probe cannot be verified, it fails open to the existing detector dispatch so an observability problem cannot suppress a legitimate release;
- a new target week automatically re-arms because the expected delivery artifact name changes; Sunday evening uses the upcoming Monday anchor;
- the external trigger carries no NBER payload, does not inspect NBER membership, and cannot publish directly;
- the existing native GitHub detector schedule stays enabled as independent best-effort redundancy.

The Cloudflare Worker credential is a fine-grained GitHub token restricted to this repository with repository `Actions: Read and write`: read access verifies the accepted-delivery artifact/run metadata and write access performs workflow dispatch. The value lives only in Cloudflare secret storage under `GITHUB_ACTIONS_DISPATCH_TOKEN`; it must not be committed, copied to GitHub Issues/PRs, or written to logs.

A successful controlled `workflow_dispatch` proves the external auth/endpoint contract but does not by itself prove Cron timing reliability. The external timing contract was accepted only after a real Cloudflare Cron invocation inside the approved release window was correlated with the resulting GitHub detector run. Post-acceptance quiescence additionally requires live evidence that a real scheduled invocation recognizes the accepted target-week delivery and skips the Cloudflare-originated detector dispatch. Deployment, verification, rollback, credential, and quiescence instructions live in `infra/cloudflare/nber-release-trigger/README.md`.

## `main` change-control model

### Verified current state

As of 2026-09-09, `main` is not protected. The production workflow also writes audited generated state directly back to `main` (`data/translations`, `sources/weekly_archive`, `ready/weekly`, `reports`, and `wechat-editor/data/latest.json`). The scheduled agent check-in separately writes `activity/agent-checkins.csv` directly to `main`.

Therefore ordinary PR-only branch protection cannot be enabled safely without first changing the writer model.

GitHub's current product documentation states that protected branches and repository rulesets for private repositories require GitHub Pro, Team, Enterprise Cloud, or Enterprise Server. The repository rulesets API also returned an upgrade-required response during H1 investigation. H1 does not change the account plan or shared credential model.

### Current enforceable convention

Until an eligible protection mechanism and bypass actor are available:

- human substantive code/config changes use a branch and pull request;
- production automation may directly persist only the explicit path allowlists already encoded in its workflow;
- scheduled attribution writes remain limited to `activity/agent-checkins.csv`;
- no workflow may use a broad `git add .` / unrestricted generated-state push to `main`;
- publication acceptance is determined by the production-health contract, not by `main` HEAD.

### Target protected model

Do not enable this automatically. When account capability and actor design are available, prefer one of these models:

**Preferred:** protect `main` for human changes, require PR + regression status checks, block force pushes/deletion, and move mutable generated production state to a dedicated state branch or artifact store.

**Alternative:** keep generated state on `main`, but authenticate production writes through a dedicated GitHub App that is explicitly and narrowly allowed to bypass the ruleset. Do not assume the built-in `GITHUB_TOKEN` or `github-actions[bot]` will be a safe/available bypass actor without testing it first.

Any plan upgrade, shared GitHub App, or cross-repository credential redesign is a Parent-level decision.

## Deterministic rebuild contract

The public `gh-pages` branch is deployed with `force_orphan=true`; it is a complete deployment snapshot, not the durable rollback ledger.

The durable rebuild inputs are private:

- implementation and static site code in this repository;
- `sources/monthly_ready`;
- `sources/weekly_archive`;
- `sources/weekly_preservation.json`;
- `data/translations/nber_weekly_zh.json`;
- audited `ready/weekly` and `reports` evidence.

`.github/workflows/rebuild-verify.yml` performs a non-deploying recovery build without downloading fresh NBER metadata and without calling the translation model. It rebuilds into runner temporary storage from preserved repository state, then compares semantic production invariants with the live public site.

The comparison intentionally excludes volatile build timestamps. It requires equality for latest week, paper counts, archive totals, translation coverage, official-source kind/completeness/evidence, and verifies that the latest rebuilt week has Chinese title/abstract fields and required public files.

This workflow is the acceptance test for reconstructability. It must pass before using the recovery path for an actual Pages replacement.

## Pages rollback / recovery procedure

Because force-orphan deployments do not provide a durable linear branch history, do not treat `git revert gh-pages` as the recovery mechanism.

For an actual recovery:

1. identify the production source SHA from the last known-good Pages deployment message or canonical health snapshot;
2. preserve the current private state branch before changing anything;
3. reproduce the site from private preserved inputs and the intended implementation version;
4. run the non-deploying rebuild verification and publication QA against that output;
5. only after verification, deploy the rebuilt directory as a new full `gh-pages` snapshot;
6. re-run production health and confirm the Pages SHA, source week/count, QA, and Composer contract are GREEN.

A recovery deployment is therefore a new audited snapshot, not a history rewind.

## Production identity

Repo `main` HEAD is not production identity because scheduled check-ins and health snapshots can advance it without changing the deployed site.

The canonical production code identity is the 40-character pipeline SHA embedded in the current `gh-pages` deployment commit message:

`deploy: academic-door/nber-working-papers-pipeline@<sha>`

The health workflow parses and records that SHA explicitly.