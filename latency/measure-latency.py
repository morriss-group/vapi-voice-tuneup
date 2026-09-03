#!/usr/bin/env python3
"""
measure-latency.py — measured response latency for a VAPI assistant, from the
call records VAPI already keeps. No dependencies beyond Python 3.9+ and curl.

    export VAPI_API_KEY=...            # never printed, never written to disk
    python3 measure-latency.py --assistant-id <id>
    python3 measure-latency.py --assistant-id <id> --by version
    python3 measure-latency.py --assistant-id <id> --boundary 2026-08-19

What it measures, per user -> assistant turn:
  A. "gap"  = assistant message start  minus  preceding user message end
              (artifact.messages[].time / .endTime, milliseconds).  This is the
              silence the caller actually hears.  The first assistant greeting
              has no user turn before it and is reported separately as
              "greeting" (secondsFromStart of the first bot message).
  B. VAPI's own artifact.performanceMetrics.turnLatencies[] which splits each
              turn into endpointing / transcriber / model / voice / total.

Exclusions:  gaps > 30 s are excluded from the stats and counted ("excl>30s")
             — holds, transfers, silence timeouts.  Turns with a tool call
             between the user turn and the reply are reported in their own
             columns ("tool turns"), not mixed into the plain-turn numbers.

Nothing in the output identifies a caller: no numbers, names or transcript.
"""
import argparse
import datetime as dt
import json
import os
import statistics
import subprocess
import sys
import urllib.error
import urllib.request

API = "https://api.vapi.ai"
UA = "vapi-voice-tuneup/measure-latency (python-urllib)"


# ----------------------------------------------------------------- fetching
def _get(url, key):
    """GET url as JSON. Tries urllib; falls back to curl if Cloudflare rejects
    urllib (HTTP 403 / error 1010 has been seen for urllib's default UA)."""
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + key,
                                               "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code != 403:
            raise
    out = subprocess.run(["curl", "-s", "-H", "Authorization: Bearer " + key, url],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def fetch_calls(assistant_id, key, cache_dir=None):
    calls, lt = {}, None
    while True:
        url = f"{API}/call?assistantId={assistant_id}&limit=100"
        if lt:
            url += "&createdAtLt=" + lt
        page = _get(url, key)
        if not isinstance(page, list) or not page:
            break
        for c in page:
            calls[c["id"]] = c
        lt = page[-1]["createdAt"]
        if len(page) < 100:
            break
    calls = sorted(calls.values(), key=lambda c: c["createdAt"])
    if cache_dir:
        os.makedirs(cache_dir, exist_ok=True)
        with open(os.path.join(cache_dir, "calls.json"), "w") as f:
            json.dump(calls, f)
    return calls


def fetch_versions(assistant_id, key):
    vers, cursor = {}, None
    while True:
        url = f"{API}/assistant/{assistant_id}/versions?limit=100"
        if cursor:
            url += "&cursor=" + cursor
        page = _get(url, key)
        for v in page.get("results", []):
            vers[v["version"]] = v
        meta = page.get("metadata") or {}
        cursor = meta.get("nextCursor") if meta.get("hasNextPage") else None
        if not cursor:
            break
    return sorted(vers.values(), key=lambda v: v["createdAt"])


# ---------------------------------------------------------------- analysis
def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def analyse_call(c, max_gap):
    art = c.get("artifact") or {}
    msgs = art.get("messages") or []
    gaps, tool_gaps, excluded = [], [], 0
    greeting, seen_bot = None, False
    prev_user_end, pending_tool = None, False
    for m in msgs:
        role = m.get("role")
        if role == "bot":
            if not seen_bot:
                seen_bot = True
                greeting = m.get("secondsFromStart")
                continue
            if prev_user_end is not None and m.get("time") is not None:
                g = (m["time"] - prev_user_end) / 1000.0
                if g > max_gap:
                    excluded += 1
                elif g >= 0:
                    (tool_gaps if pending_tool else gaps).append(g)
                prev_user_end, pending_tool = None, False
        elif role == "user":
            prev_user_end = m.get("endTime")
            pending_tool = False
        elif role in ("tool_calls", "tool_call_result"):
            pending_tool = True
    perf = (art.get("performanceMetrics") or {}).get("turnLatencies") or []
    return {
        "createdAt": c["createdAt"],
        "version": c.get("assistantVersion"),
        "n_user": sum(1 for m in msgs if m.get("role") == "user"),
        "gaps": gaps, "tool_gaps": tool_gaps, "excluded": excluded,
        "greeting": greeting, "perf": perf,
    }


def bucket_key(row, by, boundary):
    d = dt.datetime.fromisoformat(row["createdAt"].replace("Z", "+00:00"))
    if by == "week":
        monday = d - dt.timedelta(days=d.weekday())
        return "week of " + monday.strftime("%Y-%m-%d")
    if by == "day":
        return d.strftime("%Y-%m-%d")
    if by == "version":
        return row["version"] or "?"
    if by == "boundary":
        return ("after " if d >= boundary else "before ") + boundary.strftime("%Y-%m-%d")
    return "all"


def fmt(x, nd=2):
    return "-" if x is None else f"{x:.{nd}f}"


def summarise(rows, by, boundary=None):
    groups = {}
    for r in rows:
        groups.setdefault(bucket_key(r, by, boundary), []).append(r)
    lines = []
    lines.append("| bucket | calls | calls w/ user turns | turns | median gap s | p90 gap s | turns >4 s | tool turns | tool median s | tool p90 s | excl>30s | greeting median s |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for k, g in groups.items():
        gaps = [x for r in g for x in r["gaps"]]
        tg = [x for r in g for x in r["tool_gaps"]]
        greets = [r["greeting"] for r in g if r["greeting"] is not None]
        over4 = f"{100*sum(1 for x in gaps if x > 4)/len(gaps):.0f}%" if gaps else "-"
        lines.append(f"| {k} | {len(g)} | {sum(1 for r in g if r['n_user'])} | {len(gaps)} | {fmt(pct(gaps,.5))} | {fmt(pct(gaps,.9))} | {over4} | {len(tg)} | {fmt(pct(tg,.5))} | {fmt(pct(tg,.9))} | {sum(r['excluded'] for r in g)} | {fmt(statistics.median(greets)) if greets else '-'} |")
    lines.append("")
    lines.append("VAPI's own per-turn breakdown (artifact.performanceMetrics.turnLatencies, seconds):")
    lines.append("")
    lines.append("| bucket | turns | total median | total p90 | endpointing median | endpointing p90 | transcriber median | model median | model p90 | voice median | voice p90 |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for k, g in groups.items():
        tl = [t for r in g for t in r["perf"]]
        def col(f, p):
            v = [t[f] / 1000.0 for t in tl if t.get(f) is not None]
            return fmt(pct(v, p))
        lines.append(f"| {k} | {len(tl)} | {col('turnLatency',.5)} | {col('turnLatency',.9)} | {col('endpointingLatency',.5)} | {col('endpointingLatency',.9)} | {col('transcriberLatency',.5)} | {col('modelLatency',.5)} | {col('modelLatency',.9)} | {col('voiceLatency',.5)} | {col('voiceLatency',.9)} |")
    return "\n".join(lines)


def settings_changelog(versions):
    """Print only the versions where a latency-relevant setting changed, so a
    before/after boundary can be read off instead of guessed."""
    def fp(a):
        t = a.get("transcriber") or {}
        v = a.get("voice") or {}
        m = a.get("model") or {}
        return {
            "transcriber": {k: t.get(k) for k in ("provider", "model", "endpointing") if t.get(k) is not None},
            "startSpeakingPlan": a.get("startSpeakingPlan"),
            "stopSpeakingPlan": a.get("stopSpeakingPlan"),
            "voice": {k: v.get(k) for k in ("provider", "model", "stability", "similarityBoost", "style", "speed", "optimizeStreamingLatency", "autoMode") if v.get(k) is not None},
            "model": m.get("model"), "temperature": m.get("temperature"), "maxTokens": m.get("maxTokens"),
        }
    out, prev = [], None
    for a in versions:
        f = fp(a)
        changed = {k: f[k] for k in f if prev is None or f[k] != prev.get(k)}
        if changed:
            out.append(f"- {a['createdAt'][:19]}Z  {a['version']}: " + json.dumps(changed, sort_keys=True))
        prev = f
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--assistant-id", default=os.environ.get("VAPI_ASSISTANT_ID"), help="or set VAPI_ASSISTANT_ID")
    ap.add_argument("--by", choices=["week", "day", "version", "all"], default="week")
    ap.add_argument("--boundary", help="YYYY-MM-DD (UTC): also print a before/after split at this date")
    ap.add_argument("--max-gap", type=float, default=30.0, help="exclude gaps longer than this many seconds (default 30)")
    ap.add_argument("--cache-dir", help="save the raw call JSON here (contains transcripts — keep private)")
    ap.add_argument("--from-cache", help="read calls.json from this directory instead of the API")
    ap.add_argument("--no-versions", action="store_true", help="skip the assistant settings change log")
    args = ap.parse_args()

    key = os.environ.get("VAPI_API_KEY")
    if not args.assistant_id:
        sys.exit("need --assistant-id or VAPI_ASSISTANT_ID")
    if not key and not args.from_cache:
        sys.exit("set VAPI_API_KEY in the environment (it is never printed or saved)")

    if args.from_cache:
        with open(os.path.join(args.from_cache, "calls.json")) as f:
            calls = json.load(f)
    else:
        calls = fetch_calls(args.assistant_id, key, args.cache_dir)
    if not calls:
        sys.exit("no calls returned for that assistant id")

    rows = [analyse_call(c, args.max_gap) for c in calls]
    print(f"assistant {args.assistant_id}: {len(calls)} calls, {calls[0]['createdAt'][:10]} to {calls[-1]['createdAt'][:10]} (UTC)")
    print(f"gap = assistant reply start - caller's last word end; greeting excluded; gaps > {args.max_gap:g}s excluded and counted\n")
    print(summarise(rows, args.by))
    if args.boundary:
        b = dt.datetime.strptime(args.boundary, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
        print("\nBefore/after split:\n")
        print(summarise(rows, "boundary", b))
    if key and not args.no_versions:
        try:
            vers = fetch_versions(args.assistant_id, key)
            print(f"\nSettings change log ({len(vers)} versions; only latency-relevant changes shown):")
            print(settings_changelog(vers))
        except Exception as e:  # versions endpoint is optional
            print(f"\n(could not fetch assistant versions: {type(e).__name__})")


if __name__ == "__main__":
    main()
