# vapi-voice-tuneup

**Field-tested fixes for the two things wrong with every new VAPI voice
agent: multi-second pauses, and sounding like a robot.**

Built by an appliance repairman who runs his business on voice agents —
booking real appointments, calling real suppliers — and tuned these
settings across dozens of live calls. Every fix here was earned on a
production phone line, not a demo.

## New here? Not a programmer?

**If you run a service business and someone told you an AI could answer
your phone — [START HERE](START-HERE.md) instead.** Plain English, no
jargon, five minutes: what this does, what it honestly costs, and whether
you should build it yourself or hand it to someone.

## The problem

A fresh VAPI assistant ships with defaults that produce:
- **Multi-second pauses** before responses (callers say "hello? are you
  there?"). On our own line, measured across 248 real calls after the
  fixes below, the median wait was still **2.8 s** (p90 4.6 s); see
  [`latency/RESULTS.md`](latency/RESULTS.md). We could not measure the
  "before" — the API's history starts after the tune-up — so we don't
  quote one. The biggest single dial we found afterward is the
  endpointing tail (fix #6).
- **Flat, robotic delivery** even on premium voices
- Calls that get **cut off at 10 minutes** mid-conversation
- Agents that **never leave voicemail messages** (they greet the machine,
  get confused, hang up)
- Mangled names and jargon in transcripts

## The fixes (in order of impact)

### 1. Smart endpointing — the big one
The default endpointing waits conservatively to decide the caller has
finished speaking. THIS is most of your latency — the agent isn't slow to
think, it's slow to realize you stopped talking. Fix: set a LiveKit
smartEndpointingPlan (see `base-config.json`).

### 2. Voice settings that sound human
- ElevenLabs: **high stability sounds robotic.** ~0.40 ≈ human; 0.60 =
  monotone. Add `style` 0.3–0.35 for real inflection, `speed` 1.1
  (defaults feel slow on the phone), and `optimizeStreamingLatency: 3`.
- The flash tier is fastest and flattest; turbo is more human for ~0.5s.
- **Cartesia sonic is measurably faster** — 0.4–0.6 s to first audio
  against 0.9–1.4 s for ElevenLabs flash on our line — but in a proper
  A/B on real calls, four Cartesia voices in a row lost on *sound* (too
  excited, robotic, and one that turned out to be Australian). The
  library's accent field is empty for Cartesia voices; pick by the
  description text and test one sentence before a full call. Our earlier
  note here that Cartesia "beat every ElevenLabs config for human-ness"
  did not survive the owner's ear; corrected 2026-09-03. Details in
  [`TUNING-LOG-2026-09-02.md`](TUNING-LOG-2026-09-02.md).

### 3. Prompt-side latency: fast paths
An instruction like "decide what to ask next" makes the model deliberate —
and deliberation is audible. For known callers or predictable moments,
write the response INTO the prompt ("respond immediately with...").
Deliberation off the phone, scripts on it.

### 4. The settings everyone forgets
- `maxDurationSeconds`: default 600 WILL cut off a real conversation.
  Set 1800+.
- `voicemailDetection` (twilio provider) + `voicemailMessage`: without
  machine-level detection the model mistakes voicemail greetings for
  people. We watched an agent say "Goodbye" to a beep.
- Transcriber `keyterm` list: load every name/brand/term your calls will
  hear. Accents + jargon mangle transcripts otherwise. Add `numerals`.
- Self-contained first message: phone audio garbles the first second;
  a greeting that survives losing its first word prevents the
  "hello?—hey—hello?" dance.
- **Write read-back pauses as ellipses.** "Pause between chunks" in the
  prompt does nothing — the voice pauses only where the text has `...`.
  Put the example in the prompt exactly as it should be spoken:
  "six oh one... three one oh... oh eight nine two."
- **Never let the prompt say "read back" aloud.** The voice pronounces it
  as the past tense ("red back"). Use "let me repeat that."
- **A rule in the prompt only fires on the path that reads it.** Our read-back
  rule was correct and live, and the agent still spoke a phone number as a run
  of digits — because the *self-test script* in the same prompt handed it the
  number as literal numerals, and it read what it was given. If you write
  example data anywhere in a prompt, write it the way it should be **spoken**,
  not the way it is stored.
- **Callers confirm read-backs they have not checked.** Ours repeated an email
  back with a letter missing and the customer said "that's correct." The
  address that got saved had a different typo again, to a domain with no mail
  server, so the confirmation silently bounced. If an address matters, spell it
  back letter by letter, and validate the domain before you rely on it.
- **Say that the call is recorded, in the greeting.** Ours disclosed that it was
  an AI in the first sentence but never mentioned recording, and a listener in
  another state asked about it. Recording-consent law differs by state (some
  need only one party's consent, some need everyone's) and we are not lawyers —
  check your own, then put it in the first line. It costs two seconds and
  removes the question permanently.
- **One filler per tool call.** If the tool has a request-start message,
  tell the model not to add its own; otherwise callers hear both.

### 5. The API trap that will bite you
**PATCH replaces the ENTIRE object you send — `model` AND `transcriber`.**
Send a prompt tweak without resending tools/toolIds/temperature and you
silently strip your agent's tools. Send a transcriber tweak (switching
models, tuning endpointing) without resending `keyterm` and you silently
drop every keyterm — and you won't find out until a caller says a town
name and the agent hears something else. That exact thing happened on our
line: one tuning pass on the transcriber wiped 30+ keyterms; city names
that had worked for weeks stopped landing, and nobody connected it to the
change for days. Always GET the live assistant, mutate, and send the
complete object back. `apply-base.mjs` does this correctly.

**Snapshot before AND after every change.**
`VAPI_API_KEY=... ./snapshot-assistant.sh <assistant-id>` saves the full
live config and prints the six numbers that go missing silently: prompt
length, model settings, tool count, keyterm count, transcriber, voice. Run
it, make your change, run it again, compare the two summaries. A count
that dropped is a thing you just deleted.

### 6. The endpointing tail (found by measuring, not by ear)
The LiveKit wait function in `base-config.json` tops out near 3.6 s when
the model thinks the caller will keep talking — and it thinks that after a
one-word "Yes." Change `4000 * max(0, x-0.5)` to `1500 * max(0, x-0.5)`
(ceiling 2.2 s, no change for confident turns). Measured on a live line:
the longest pause-detector wait dropped from 2.9 s to 2.2 s in one call.
Also set the transcriber's `endpointing` (Deepgram) explicitly — we saw
one 8-second finalization stall with it unset. The whole night, with the
numbers and the four voices that lost on sound while winning on speed, is
in [`TUNING-LOG-2026-09-02.md`](TUNING-LOG-2026-09-02.md).

### 7. The interruption plan nobody sets (and the 4-second gap it causes)
If you never set `stopSpeakingPlan`, you get the default `numWords: 0` — which
means **any** sound from the caller stops the assistant mid-sentence. Every
"perfect", "yep", "okay" aborts the reply. And an abort is expensive: it
restarts the whole cycle — endpointing wait, then the model's ~1 second floor,
then text-to-speech. On our line that added up to a 3–4 second silence after a
one-word answer, twice in one call, and the caller said "hello?" because he
thought it had dropped.

Fix, in `base-config.json`:

```json
"stopSpeakingPlan": { "numWords": 3, "voiceSeconds": 0.2, "backoffSeconds": 0.6 }
```

`numWords: 3` means one- and two-word acknowledgements no longer interrupt;
three words or more still do. State the trade-off to yourself: a two-word
correction ("no, wrong") now gets talked over. Drop to 2 if you hear that on a
real call. `backoffSeconds` (default 1.0) is the wait *after* a genuine
interruption before the assistant resumes.

**Only a real call shows this.** A scripted self-test is a monologue — nobody
interrupts it — so it will look perfect while callers hear the gap.

## Quick start — the wizard

```bash
VAPI_API_KEY=... node setup.mjs
```

Walks you from an empty account to a live, fully-tuned receptionist:
creates the assistant with every fix below pre-applied, attaches your
phone number, wires call reports, makes you run the systems test, and
ends by writing **BUILD-BRIEF.md** — a personalized brief you paste into
an AI coding session (Claude Code, etc.) to build your booking/tools
layer. The installer's last step is instructions for your agent, because
that's how software gets built now.

## Manual usage

```bash
export VAPI_API_KEY=...
node apply-base.mjs <assistant-id>          # applies base-config.json
node apply-base.mjs <assistant-id> --dry    # show what would change
```

## Other platforms (Retell, Bland, Synthflow)?

The CONCEPTS here are universal — endpointing/latency, voice-setting
tuning, voicemail detection, keyterm lists, the test-call discipline, the
tools-server pattern. The SPECIFICS in this kit are VAPI, because that's
where every fix was earned on a real production line. We won't publish
configs we haven't run in production — but if you run Retell or Bland
live, a platform adapter (their equivalent of base-config + apply script)
would make a great first pull request.

Field notes from our own cross-platform work live in `platform-notes/` —
starting with [Retell setup scars](platform-notes/retell.md) from building
a real VAPI→Retell failover, including the human-only setup gates every
autonomous deployment needs to plan around.

## License
MIT
