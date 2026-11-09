# #82 · Monthly search cold-load performance baseline (2026-10-21)

Owner: ③ 前沿之门 / Working Papers. This is **owner-local engineering evidence**, not a second source-truth registry or change to canonical NBER product contracts.

## Human-approved acceptance

- Visible feedback on click **≤200ms**.
- Already-loaded search, filtering, pagination **P95 ≤200ms** on stated reference profiles.
- Improve cold first usable content and strive toward **~1s full result** on a reference network/device, without promising universal ≤1s transport.
- Retain full **8,863 accepted monthly rows**, year/China/translation filters, NBER IDs, English and Chinese titles, author names, monthly accepted version-paired Chinese abstracts, and distinct accepted weekly translation fallback attribution; no field-level or membership loss.
- No unconditional 4MB+ homepage prefetch, new paid search infrastructure, cross-subsystem contracts or broad Phase-1/2 redesign.

## Last live production baseline

`gh-pages@6a6368cba2fa0b9d59b44abb96e383b31ce52125`, 2026-10-19 accepted 29/29. Chromium 1440px and 390px representative probes (not universal SLAs):

| Interaction | Desktop | 390px viewport |
|---|---:|---:|
| Warm all-corpus search, 20 term P95 | 86.7ms | 82.9ms |
| Cold first-query **visible loading feedback** | 62.7ms | 50.8ms |
| Cold first all-year **complete result**, `inflation` | 4,455ms | 4,316ms |
| First China shard result | 495.7ms | 355.6ms |
| First weekly shard result | 472.5ms | 515.3ms |

These were observed on one actual remote Chromium environment. Network timings, download bytes, caches, and hardware must be reported for any later P95 claim.

## Exact source data observation and negative index result

`data/monthly_search_manifest.json` lists **7 annual shards, 8,863 monthly records** for 2020–2026. All seven live JSON shards were downloaded read-only and passed complete manifest count/year validation. The published monthly rows contain English **title** and Chinese title/abstract; not all 8,863 monthly rows carry English abstract fields. Never inflate the contract by claiming indexed English abstracts on every monthly record. Some 2026 monthly rows have `accepted_week_zh_title`, `accepted_week_zh_abstract`, `accepted_week_date`, and `accepted_week_detail_url` specifically to label a **different** accepted weekly English version; these are not drop-safe.

Run the read-only benchmark after cloning the current published `gh-pages` into a temporary directory:

```bash
python scripts/benchmark_monthly_search_payload.py --site-root /path/to/gh-pages
```

Result from the 2026-10-21 full 8,863 row fixture:

| Encoding | Compressed bytes (gzip -9) |
|---|---:|
| Baseline current 7 annual JSON files | **4,075,077** |
| Baseline all rows packed into one JSON | 4,063,863 |
| **Field-exact** sparse positional packed all rows (presence-bit mask; missing field ≠ `null`) | **3,969,035** |

**Savings only 2.6%** versus current annual shards when full field presence/version evidence is preserved. Earlier dense array exploration suggested ~9% savings but **did not preserve missing-vs-null semantics**, so it is unfit for production without more contracts. A single large file also sacrifices annual lazy fetch and is **not** a justified cold-performance migration solely on this compression result. No generated candidate has been published.

The benchmark `compact()/restore()` strictly round-trips all values, absent fields, ordering and 8,863 rows and is read-only. It does **not** modify any production data. Compression alone will not reduce a 4.3s cold search to 1.0s.

## Next bounded experiment

Keep accepted/year/China data shards intact and test **progressive, source-honest query rendering** while annual shards resolve asynchronously:

1. Latest years first where possible; first matching results are explicitly labeled **partial / still loading** with number of years scanned and no false exact count or completion badge; full count and pagination only after all 7 years.
2. Under fast query changes, cancel/ignore stale render completion with generation IDs; maintain exact final rows, order, year filters and source/provenance labels. Error/fallback behavior must not claim source parity when an annual shard fails.
3. Compare cold time-to-first-usable result **and** time-to-final-complete on 1440px/390px with full 8,863-row parity across queries including English title, Chinese title/summary, NBER number, author, China/year selectors and mismatched-version accepted-week alternates.
4. If it improves perceived usability without falsely claiming a 1-second *complete* search, treat it as bounded UX improvement. Otherwise fail closed; a genuine hard cold-complete 1s requirement is a distinct delivery-architecture and possible cost decision.

## Production guardrail

Future changes ship only after exact-head CI, static row/hash/version comparisons, authorized site-only release, Pages deployment and live browser readback. Natural NBER release around 2026-10-26 takes precedence; expected accepted week must always be read fresh from public production before site-only dispatch.
