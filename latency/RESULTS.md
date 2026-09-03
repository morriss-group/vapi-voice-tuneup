# Measured response latency — Steel City production line

Measured 2026-09-02 from VAPI's own call records for the production
receptionist (assistant `394cf62d…`), using `measure-latency.py` in this
folder. Numbers only — no caller data, no transcript text.

## The short version

- **248 calls, 2026-08-20 → 2026-09-02, all on the tuned configuration.**
  Median silence between the caller's last word and the agent's first word:
  **2.8 s**. p90: **4.6 s**. 13% of plain turns still exceed 4 s.
- **There is no "before" data.** VAPI's retrievable call history for this
  org starts 2026-08-20. The smart-endpointing fix has been on this
  assistant since the first version in its history (v1, 2026-08-09), and
  the voice/model latency tweaks landed at v32 (2026-08-19 01:02 UTC) —
  both *before* the first retrievable call. **The README's "4–6 second
  pauses → conversational" claim cannot be verified from this data**, and
  the measured after-number does not support the word "conversational"
  (a human-to-human turn gap is well under a second).
- Of the ~3.2 s VAPI itself attributes to a turn, endpointing is now the
  *smallest* big piece (0.5 s median). The model (1.1 s) and the voice
  (0.6 s) are the larger ones.

## Results by week (UTC weeks; the line was tuned before all of them)

Method A — silence the caller hears (assistant reply start − caller's last word end):

| week | calls | calls w/ user turns | turns | median gap s | p90 gap s | turns >4 s | tool turns | tool median s | tool p90 s | excl >30 s | greeting median s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-08-17 (from 08-20) | 54 | 47 | 172 | 2.80 | 4.79 | 14% | 44 | 3.66 | 5.61 | 0 | 1.12 |
| 2026-08-24 | 126 | 100 | 297 | 2.83 | 4.26 | 10% | 122 | 3.46 | 5.24 | 0 | 1.12 |
| 2026-08-31 (to 09-02) | 68 | 53 | 215 | 2.81 | 4.79 | 17% | 61 | 3.75 | 5.87 | 0 | 1.12 |
| **all** | **248** | **200** | **684** | **2.82** | **4.59** | **13%** | **227** | **3.58** | **5.76** | **0** | **1.12** |

Method B — VAPI's per-turn breakdown (`artifact.performanceMetrics.turnLatencies`, seconds):

| week | turns | total median | total p90 | endpointing median | endpointing p90 | transcriber median | model median | model p90 | voice median | voice p90 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-08-17 | 218 | 3.16 | 5.33 | 0.51 | 1.55 | 0.16 | 1.15 | 1.63 | 0.64 | 1.35 |
| 2026-08-24 | 438 | 3.22 | 5.31 | 0.51 | 1.26 | 0.25 | 1.13 | 1.65 | 0.63 | 1.29 |
| 2026-08-31 | 296 | 3.19 | 6.11 | 0.52 | 2.07 | 0.23 | 1.13 | 1.93 | 0.62 | 1.33 |
| **all** | **952** | **3.20** | **5.57** | **0.51** | **1.60** | **0.23** | **1.13** | **1.71** | **0.63** | **1.32** |

Other numbers from the same data:
- Greeting: the first assistant words start a median **1.12 s** after the
  call starts (p90 1.27 s); 243 of 248 calls measurable.
- Tool-call turns (a booking-system lookup between the caller's answer and
  the reply): median **3.6 s**, p90 5.8 s, **34% over 4 s**. These are the
  pauses most worth attacking next.
- Endpointing was over 2 s on 7.9% of turns and over 4 s on 0.2% — the
  smart-endpointing curve is doing its job; the residual long pauses are
  mostly model + voice + tool time.
- No gap exceeded the 30 s exclusion cutoff, so nothing was thrown away.
- Per assistant version (v38 → v45, prompt/keyterm/tool edits only) the
  median gap ranges 2.6–3.0 s. No version shows a step change.

## Method

Source: `GET https://api.vapi.ai/call?assistantId=…&limit=100`, paged
backwards with `createdAtLt` until empty (248 calls; the org-wide list has
263, so this is the whole retained history).

**Method A (gap).** For each `artifact.messages[]` entry in order: a `user`
message carries `endTime` (ms epoch, end of the caller's last word); the
next `bot` message carries `time` (ms epoch, start of the agent's reply).
gap = bot.time − user.endTime. The first `bot` message in a call is the
greeting and is reported separately (`secondsFromStart`). If a
`tool_calls`/`tool_call_result` message sits between the user turn and the
reply, the turn is counted as a *tool turn* in its own columns. Gaps over
30 s would be excluded and counted (none occurred). Only bot messages that
directly follow a user turn are measured — an agent that speaks twice in a
row yields one measurement.

**Method B (VAPI breakdown).** `artifact.performanceMetrics.turnLatencies[]`
gives, per turn, `endpointingLatency`, `transcriberLatency`, `modelLatency`,
`voiceLatency`, `turnLatency` in ms. VAPI defines these; the script only
reports percentiles. The two methods agree: per-call, the mean gap and the
mean VAPI turn latency differ by a median of −0.13 s (IQR −0.46 to +0.03).

Percentiles are linear-interpolated. Weeks are Monday-start in UTC.

## Boundary evidence (why there is no before/after)

`GET /assistant/{id}/versions` returns the full config history. Only the
latency-relevant changes:

| version | when (UTC) | what changed |
|---|---|---|
| v1 | 2026-08-09 04:41 | first recorded version already has `startSpeakingPlan.smartEndpointingPlan` (livekit, custom waitFunction), deepgram nova-3, 11labs flash, stability 0.7, optimizeStreamingLatency 4, autoMode on |
| v6 | 2026-08-09 07:20 | maxTokens 1000 |
| v32 | 2026-08-19 01:02 | stability 0.7 → 0.5, optimizeStreamingLatency 4 → 3, autoMode off, maxTokens 800, temperature 0.25 |
| v33–v45 | 08-19 → 09-02 | prompt text, keyterms (0 → 69 → 74), one tool added — nothing that touches endpointing, voice, or model |

The first retrievable call is 2026-08-20 00:37 UTC, i.e. after v32. The
assistant itself was created 2026-06-13, but VAPI's version history starts
at v1 on 2026-08-09, so there is no API record of what ran between June and
August 9. Corroborating repo evidence: `~/themrfixedit-agent`
`voice-stack-review-GROK-BRIEF.md` (committed 2026-08-19) quotes the pre-v32
voice settings (stability 0.7, optimizeStreamingLatency 4) alongside the
same smartEndpointingPlan; `~/hcp-booking-agent` CLAUDE.md (2026-08-28)
records the endpointing plan as the "single biggest latency fix" learned on
a *different* assistant's test calls, copied from Steel City. Neither is a
measurement of Steel City before the fix.

**Verdict: no defensible before/after boundary exists in retained data.**
Weekly buckets are reported instead and show no step change — as expected,
since nothing latency-relevant changed inside the window.

## Caveats (read before quoting any of this)

1. **After-only.** Every number above is the tuned line. The "4–6 s" before
   figure in the README is recollection, not measurement, and this dataset
   cannot confirm or refute it. To get a real before-number: create a
   throwaway assistant with VAPI's default `startSpeakingPlan` and the same
   prompt, place ~10 test calls, and run
   `measure-latency.py --assistant-id <test-id> --by all` on both.
2. **2.8 s is not "conversational".** Callers still wait a median 2.8 s and
   about one turn in eight waits over 4 s. An honest README line is
   "median 2.8 s, p90 4.6 s, endpointing share 0.5 s" — not "conversational".
3. **Component times are VAPI's attribution.** Method B's pieces are what
   VAPI reports; they sum to ~2.5 s against a 3.2 s median turn, so ~0.7 s
   is unattributed (transport/queueing). Method A is the ground truth for
   what the caller hears; use B only to say which piece is biggest.
4. **Call mix is not controlled.** Real customers, spam calls, and the
   owner's own test calls are all in here (no transcript filtering was done
   to keep this file free of caller data). 48 of 248 calls had no user turn
   at all (hang-ups, voicemail, misdials) and contribute only a greeting time.
5. **One phone line, two weeks, one region.** Not a benchmark of VAPI;
   a measurement of this assistant.
6. **Turn counting.** Method A measures 684 plain + 227 tool turns from 200
   calls; Method B reports 952 turns from 197 calls. They count slightly
   different things (B includes some turns A cannot pair), which is why both
   are shown.

## Reproduce

```bash
export VAPI_API_KEY=...                     # never printed or saved
python3 latency/measure-latency.py --assistant-id <your-assistant-id>
python3 latency/measure-latency.py --assistant-id <id> --by version
python3 latency/measure-latency.py --assistant-id <id> --boundary 2026-08-19   # before/after split
```

Python 3.9+, no packages. Uses `curl` as a fallback if Cloudflare rejects
Python's HTTP client. `--cache-dir` saves the raw call JSON (which *does*
contain transcripts — keep it private).
