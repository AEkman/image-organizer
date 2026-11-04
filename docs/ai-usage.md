# AI usage

Tracking began on 3 November 2026 at 19:08:44.769 UTC, when development started from an empty project directory. Earlier competition research is excluded.

## Measured snapshot

Latest measured event: 2026-11-04T19:55:41.779Z.

- Cloud tokens: **36,602,058** (input 36,520,417; output 81,641).
- Included subsets: cached input 35,844,224; reasoning output 17,937. These are already included in the totals and are not added again.
- Local inference for these Codex calls: **0 tokens**. The model runs in the cloud; running development tools locally is not local inference.

These are processed-token counts, including repeated context and project administration, rather than monetary charges or an invoice. No subscription cost is inferred.

## Method and evidence

The local recorder, `tools/record_spendage.py`, measures deltas from cumulative Codex token-usage events associated with this project. It subtracts the last counter before tracking began and ignores repeated snapshots. Measured usage includes project sessions found by the recorder; sessions in other directories or unavailable logs are not assumed to be included.

Detailed timestamps, session identifiers and local evidence paths remain in the ignored local `spendage.md`. Raw sessions and private evidence are not published. This aggregate snapshot was copied from that ledger without estimates or double counting. It is not a live counter; later work and final replies may appear only in a subsequent update.

No other AI inference has been recorded since tracking began. Unavailable or missing usage must not be interpreted as zero. Other services must be recorded separately with tool, date, counting method and evidence.
