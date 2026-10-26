# Cloudflare NBER Release Trigger Design

**Status:** APPROVED by Human Principal on 2026-09-14 via `academic-door/academic-door-main-control#52`.

**Owner:** ③ 前沿之门 / Working Papers.

**Problem:** GitHub Actions `schedule` delivery for `.github/workflows/detect-weekly-release.yml` is materially sparser than the configured 15-minute cadence. GitHub schedule remains best-effort and cannot be treated as a release-observation SLA.

## Decision

Add a dedicated Cloudflare Cron Trigger + Worker as an independent trigger for the existing detector workflow. The Worker is not a second NBER implementation.

The external component MUST:

- contain no NBER membership, reconciliation, translation, publication, or QA logic;
- dispatch only `.github/workflows/detect-weekly-release.yml` in `academic-door/nber-working-papers-pipeline`;
- dispatch `main` through GitHub's `workflow_dispatch` REST endpoint;
- use a fine-grained GitHub credential limited to this repository with only the minimum `Actions: write` repository permission required for workflow dispatch;
- read that credential only from Cloudflare Worker secret storage;
- never store the token in source, Wrangler vars, logs, Issues, or chat;
- preserve native GitHub `schedule` as opportunistic redundancy;
- preserve the detector's existing 120-second stability confirmation, publication duplicate suppression, fail-closed behavior, and QA.

## Scheduling contract

Cloudflare Cron Triggers execute in UTC. The Worker therefore uses the scheduled event timestamp and `Intl.DateTimeFormat(..., { timeZone: "America/New_York" })` to decide whether the current event is inside the NBER observation window:

- Sunday: local hour 18 through 23;
- Monday: local hour 0 through 13;
- Tuesday: local hour 0 through 13.

The Cloudflare cron fires at `:14/:29/:44/:59` on Sunday through Tuesday UTC. This is a 15-minute cadence and is deliberately offset from the native GitHub detector schedule at `:07/:22/:37/:52` to reduce normal-path collisions. The Worker-local New York gate handles DST and prevents dispatch outside the approved release window.

## GitHub dispatch contract

The Worker sends:

- `POST https://api.github.com/repos/academic-door/nber-working-papers-pipeline/actions/workflows/detect-weekly-release.yml/dispatches`
- `Authorization: Bearer <Cloudflare secret>`
- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2026-03-10`
- JSON body: `{ "ref": "main", "inputs": { "trigger_source": "cloudflare-cron" } }`

The detector workflow exposes an optional `workflow_dispatch.inputs.trigger_source` input defaulting to `manual` and records that source in the Actions summary for acceptance evidence. The input is observability metadata only; it does not grant privilege or alter detector/source-truth semantics.

## Failure semantics

- Outside the approved local release window: return without calling GitHub.
- Missing Cloudflare secret: fail the scheduled event loudly.
- Non-2xx GitHub response: fail the scheduled event loudly with status and a bounded response excerpt; never log the Authorization header or secret.
- GitHub detector/publication failures continue to follow existing owner-repo incident and fail-closed semantics.

## Acceptance

Repository acceptance requires:

1. unit tests covering EST and EDT release-window boundaries;
2. tests proving the exact GitHub repository/workflow/ref/source contract and that no dispatch happens outside the window;
3. existing Python regression suite plus Worker tests GREEN on the exact PR head;
4. merged owner-repo code/config/docs without weakening current detector/publication safeguards;
5. controlled real `workflow_dispatch` evidence after Cloudflare secret placement;
6. subsequent Cloudflare Cron evidence showing scheduled invocation creates detector runs during the approved window.

Items 5-6 require the Human Principal to create the fine-grained credential and place it into Cloudflare secret storage. Those are the only manual security-boundary steps.