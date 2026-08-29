# vapi-voice-tuneup

**Field-tested fixes for the two things wrong with every new VAPI voice
agent: multi-second pauses, and sounding like a robot.**

Built by an appliance repairman who runs his business on voice agents —
booking real appointments, calling real suppliers — and tuned these
settings across dozens of live calls. Every fix here was earned on a
production phone line, not a demo.

## The problem

A fresh VAPI assistant ships with defaults that produce:
- **4–6 second pauses** before responses (callers say "hello? are you
  there?")
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
- In our ear-tests, **Cartesia sonic beat every ElevenLabs config** for
  human-ness AND speed. Worth an A/B on your own line.

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

### 5. The API trap that will bite you
**PATCH replaces the ENTIRE `model` object.** Send a prompt tweak without
resending tools/toolIds/temperature and you silently strip your agent's
tools. Always GET the live assistant, mutate, and send the complete model
object back. `apply-base.mjs` does this correctly.

## Usage

```bash
export VAPI_API_KEY=...
node apply-base.mjs <assistant-id>          # applies base-config.json
node apply-base.mjs <assistant-id> --dry    # show what would change
```

## License
MIT
