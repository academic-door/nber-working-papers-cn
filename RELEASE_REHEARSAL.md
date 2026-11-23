# NBER Release Rehearsal

`.github/workflows/release-rehearsal.yml` is a non-production replay control for the Working Papers publication path. It exists to move known failure modes out of the next live NBER rollover and into an on-demand, repeatable rehearsal.

The workflow replays the **latest already accepted** `sources/weekly_evidence/<week>.json` batch. Blank input selects that latest accepted evidence. An explicit `accepted_week` is only an assertion that the caller expects that week to be the current latest accepted batch; older accepted weeks are intentionally rejected here and remain the domain of deterministic rebuild verification. `scripts/prepare_release_rehearsal.py` requires `complete=true`, a non-empty canonical membership, and an exact match between canonical membership and the paper payload before materializing the evidence into the runner's API-weekly input.

The rehearsal downloads and validates the official NBER TSV metadata bundle directly into runner temporary storage for enrichment. This repository does not commit a `data/nber` metadata bundle, so the rehearsal fails closed if the official TSV bundle cannot be obtained and validated; it never fabricates or silently substitutes enrichment data. It explicitly disables all supported translation API keys, reuses only the committed translation cache, performs a full site build in runner temporary storage, runs translation QA, rebuilds the weekly ready artifact, and runs strict site QA for the replayed week. Missing/stale cached translations therefore block the rehearsal instead of creating a paid model call.

Safety contract:

- repository permissions are `contents: read` only;
- no GitHub/Cloudflare/Composer/Pages credentials are bound;
- no Composer mutation, Pages deployment, IndexNow submission, git commit/push, issue mutation, or workflow dispatch occurs;
- accepted weekly evidence is replayed, never inferred or rewritten;
- all generated site/ready/report outputs live in runner temporary storage and are retained only as a bounded Actions artifact.

A GREEN rehearsal proves the current code can reproduce the accepted batch through the local preparation/build/translation-quality/ready/site-QA path without production mutation. It does **not** replace the next real rollover acceptance: live NBER source timing, a genuinely new batch, translation-provider availability for new content, Cloudflare timing, Composer mutation, Pages deployment, and deployment-coupled production health still require real production evidence.

Operational use: run `NBER release rehearsal` with blank `accepted_week` to replay the latest accepted batch. If an explicit week is supplied, it must equal the current latest accepted Monday anchor and acts as a guard against replaying an unexpected release. For older incidents or historical recovery, use `.github/workflows/rebuild-verify.yml` and the deterministic rebuild contract instead. Treat any rehearsal RED as owner-local reliability evidence and repair it before relying on the next live release for discovery of the same failure mode.
