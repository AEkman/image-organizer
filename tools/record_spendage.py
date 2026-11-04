#!/usr/bin/env python3
"""Refresh the measured Codex section without copying private chat content."""

import json
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
START = "2026-11-03T19:08:44.769Z"
START_DATE = START[:10].replace("-", "/")
COUNTERS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
)
BEGIN = "<!-- BEGIN MEASURED CODEX USAGE -->"
END = "<!-- END MEASURED CODEX USAGE -->"


def records(path):
    with path.open() as stream:
        for line in stream:
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                # The live session writer may not have finished its last line.
                continue


def collect():
    root = Path.home() / ".codex" / "sessions"
    if not root.is_dir():
        raise SystemExit("Codex session logs unavailable; existing ledger unchanged.")
    rows, sources = [], []
    for path in sorted(root.glob("*/*/*/*.jsonl")):
        if path.relative_to(root).as_posix()[:10] < START_DATE:
            continue
        stream = records(path)
        meta = next(stream, {})
        payload = meta.get("payload", {})
        if meta.get("type") != "session_meta" or payload.get("cwd") != str(PROJECT):
            continue
        session = payload["id"]
        previous = dict.fromkeys(COUNTERS, 0)
        added = False
        for record in stream:
            payload = record.get("payload", {})
            if record.get("type") != "event_msg" or payload.get("type") != "token_count":
                continue
            usage = (payload.get("info") or {}).get("total_token_usage")
            if usage is None:
                continue
            if any(not isinstance(usage.get(key), int) for key in COUNTERS):
                raise SystemExit(f"Incomplete token counters in {path}; ledger unchanged.")
            current = {key: usage[key] for key in COUNTERS}
            delta = {key: current[key] - previous[key] for key in COUNTERS}
            previous = current
            timestamp = record.get("timestamp", "")
            if timestamp < START or not any(delta.values()):
                continue
            if any(value < 0 for value in delta.values()):
                raise SystemExit(f"Token counter reset in {path}; reconcile before updating.")
            if delta["total_tokens"] != delta["input_tokens"] + delta["output_tokens"]:
                raise SystemExit(f"Inconsistent token total in {path}; ledger unchanged.")
            rows.append((timestamp, session, delta))
            added = True
        if added:
            sources.append((session, path))
    if not rows:
        raise SystemExit("No measured usage found for this project; ledger unchanged.")
    return sorted(rows), sources


def main():
    rows, sources = collect()
    totals = {key: sum(row[2][key] for row in rows) for key in COUNTERS}
    lines = [
        BEGIN,
        "## Measured Codex cloud usage",
        "",
        f"Latest recorded usage: {rows[-1][0]}.",
        "",
        f"**Cloud tokens: {totals['total_tokens']:,}** "
        f"(input {totals['input_tokens']:,}; output {totals['output_tokens']:,}).",
        "",
        f"Included subsets: cached input {totals['cached_input_tokens']:,}; "
        f"reasoning output {totals['reasoning_output_tokens']:,}.",
        "",
        "Local inference tokens for these Codex calls: **0**. "
        "These calls use a cloud model; running tools on this Mac is not local inference.",
        "",
        "| Recorded at (UTC) | Session | Input | Cached input (included) | Output | Reasoning (included) | Total |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for timestamp, session, delta in rows:
        values = " | ".join(f"{delta[key]:,}" for key in COUNTERS)
        lines.append(f"| {timestamp} | {session} | {values} |")
    lines.extend(["", "### Evidence", ""])
    for session, path in sources:
        local_path = "~" + str(path)[len(str(Path.home())):]
        lines.append(f"- Session `{session}`: `{local_path}` (private local source).")
    lines.extend(["", END])
    section = "\n".join(lines)
    ledger = PROJECT / "spendage.md"
    content = ledger.read_text() if ledger.exists() else (
        "# Token usage — image-organizer\n\n"
        f"Tracking requested from {START}. Earlier competition research is excluded.\n\n"
        "## Counting method\n\n"
        "Measured deltas from cumulative `total_token_usage` events in local Codex "
        "session logs whose working directory matches this project. The last counter "
        "before tracking started is subtracted. Repeated snapshots are ignored. "
        "Cached input is part of input; reasoning is part of output.\n\n"
        "Counts include repeated context, tools and project administration. "
        "They describe processed tokens, not currency charges or an invoice. "
        "No monetary cost is inferred for subscription usage.\n\n"
        "Run `python3 tools/record_spendage.py` to refresh. Usage arrives after model "
        "responses, so the latest response may be absent until the next refresh. "
        "This is an on-demand ledger, not a background monitor. Sessions in other "
        "directories, other AI services and unavailable logs require separate records.\n\n"
        + BEGIN + "\n" + END + "\n\n"
        "## Other tools and estimates\n\n"
        "No other AI inference has been recorded since tracking began. "
        "Missing records must not be interpreted as zero usage.\n\n"
        "| Date | Tool / model | Local tokens | Cloud tokens | Measured / estimated / unknown | Method and evidence |\n"
        "| --- | --- | ---: | ---: | --- | --- |\n"
    )
    if content.count(BEGIN) != 1 or content.count(END) != 1:
        raise SystemExit("Ledger section markers missing or ambiguous; file unchanged.")
    prefix, remainder = content.split(BEGIN, 1)
    _, suffix = remainder.split(END, 1)
    ledger.write_text(prefix + section + suffix)
    print(f"Recorded {totals['total_tokens']:,} cloud tokens across {len(rows)} measured events.")


if __name__ == "__main__":
    main()
