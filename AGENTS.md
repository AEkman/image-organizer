# Project instructions

- Track all AI token usage from 2026-11-03T19:08:44.769Z onward in `spendage.md`.
- Run `python3 tools/record_spendage.py` at the start and end of each work turn. The final response's usage may only become available on the next run.
- Use measured usage when available. Identify estimates and unknown usage explicitly; never report missing usage as zero.
- Keep local and cloud usage separate. Cached input is already included in input tokens; reasoning output is already included in output tokens. Do not add either twice.
- Record other AI services separately in the manual section of `spendage.md`, with the tool, date, counting method and evidence reference. The script preserves that section.
- Keep dated evidence of development, failures and decisions for the SweClockers competition. The initial project directory was empty on 3 November 2026.
