# One night of tuning a production line, with the numbers and the mistakes

*September 2–3, 2026. A production receptionist on a real business line, tuned between 9 PM and 6 AM while nobody was calling. Written up the next morning, including the parts that went wrong, because the parts that went wrong are the useful ones.*

## What we set out to fix

The owner had listened to the day's calls and heard four-second pauses. The README of this repo said the tune-up had turned four-to-six-second pauses into a conversational beat. So the first job was to find out whether that was true.

## Step 0: measure before touching anything

We pulled every call the API still held, 248 of them over two weeks, and timed every turn: the gap between the caller's last word and the agent's first. Script and full results are in [`latency/`](latency/RESULTS.md).

| | plain turns | tool-call turns |
|---|---:|---:|
| median wait | 2.8 s | 3.6 s |
| worst tenth | 4.6 s | 5.9 s |
| turns over 4 s | 1 in 8 | 1 in 3 |

Flat across all three weeks. Nothing had crept in; it had always been like this. And VAPI's own per-stage timing, which lives in every call record under `artifact.performanceMetrics`, said where the median 2.8 seconds went: endpointing 0.5, transcriber 0.2, **model 1.1**, voice 0.6, and about 0.7 unattributed.

**First honest finding:** the README's claim could not be verified. VAPI's version history for the assistant starts *after* the tune-up, so there is no "before." And 2.8 seconds is not conversational. The README now says the measured number instead.

## Experiment 1: cut the prompt in half (worked for cost, not for pauses)

The system prompt had grown to 67,854 characters, about 17,000 tokens, re-read by the model on every turn. Hypothesis: that's the 1.1 seconds.

We rewrote it to 39,000 characters with every rule preserved, ran it through an independent review that compared the two versions line by line (it found four dropped rules and a reworded one, all fixed before deploy), and deployed with a snapshot before and after.

Then seven text-mode test conversations through VAPI's chat endpoint, which runs the real assistant with real tools and no phone. Six passed. **One failed:** told the name of a city we don't serve, the agent asked whether the caller was near the one covered neighborhood inside it, which the prompt explicitly forbids it to mention. The compression had dropped the old prompt's literal example of the forbidden question, and the model found that exact gap. Restored the example verbatim; three variants of that decline then passed.

Result on the phone: tokens per call fell from 43,000 to 8,000 and cost from 90 cents to 28. **Pauses did not change.** The model stage stayed at 1.0–1.7 seconds. Whatever the model's floor is, it is not prompt length at this size.

Lesson: measure the stage you think you're fixing. We cut cost by two-thirds and were about to take credit for latency we hadn't touched.

## Experiment 2: the voice engine (faster, and rejected four times)

Cartesia's sonic model against ElevenLabs flash, same line, same script, the owner on the phone judging by ear.

| voice | voice-stage median | turn median | the ear |
|---|---:|---:|---|
| ElevenLabs flash (baseline) | 0.94 s | 4.0 s | the known voice |
| Cartesia "Amber" | 0.62 s | 2.9 s | too excited; digits read too slowly |
| Cartesia "Courtney" | 0.54 s | 3.6 s | **Australian accent** |
| Cartesia "Iris" | 0.38 s | 3.0 s | robotic |
| Cartesia "Esther" | – | – | rejected on the first sentence |

Cartesia was measurably faster on every call, roughly a third to half a second a turn. It lost anyway, because the sound is the customer's entire experience and none of the four voices passed the owner's ear.

Two things to know before you try this:
- **VAPI's voice library returns no accent or language field for Cartesia voices.** Every entry says `accent: None`. The only way to know a voice is Australian is the description text, when it mentions it, or your ear. Pick by description, and test with one sentence before a full call.
- The speed gain is real but small next to the other dials below. Don't trade a voice you like for it.

We went back to ElevenLabs, exactly the original settings, before touching anything else, so the next test had a familiar voice.

## Experiment 3: the pause detector's long tail (worked)

The LiveKit smart-endpointing wait function from `base-config.json` ends in `+ 4000 * max(0, x-0.5)`, where x is the model's confidence the caller will keep talking. When x is high, that term alone adds two seconds; the whole function tops out near 3.6 seconds. On real calls we saw the pause detector wait 2.9 seconds after a one-word "Yes."

Changed 4000 to 1500. Ceiling drops from 3.6 to 2.2 seconds; nothing changes for turns where the detector is already confident. On the next call, the longest endpointing wait was 2.2 seconds, exactly at the new ceiling, and the owner's verdict was "much better."

`base-config.json` in this repo now carries the 1500 version (changed 2026-09-03). If you applied the base config before that date, re-apply or edit the function by hand.

## Experiment 4: transcriber finalization and voice warmth (deployed, not yet scored)

Same call also showed the transcriber stalling for **8 seconds** on one turn. We set Deepgram's `endpointing` to 200 ms (it was unset). Because PATCH replaces the whole transcriber object, the 74 keyterms had to be resent with it; the snapshot afterward confirmed all 74.

The owner also called the restored ElevenLabs voice "a little flat." The live config had never had this repo's own recipe applied: stability was 0.5 with no style or speed. Set stability 0.40, style 0.30, speed 1.1. Both changes went live together because they don't interact: one is scored in numbers, the other by ear. As of this writing they've only been heard on a systems-check monologue, which doesn't measure conversation. A normal call scores them.

## The small ones that were actually the callers' experience

- **The voice said "read back" as the past tense.** Every read-back step in the prompt's self-test announced itself as "phone read back," and the TTS said "red back," and the owner spent three turns correcting a receptionist who agreed with him each time and did it again. Fix: the prompt never says that phrase aloud; it says "let me repeat that."
- **Read-back pauses were disappearing.** The rule said "three chunks with a clear pause." The model wrote the chunks with spaces. The voice honors ellipses, not spaces. Fix: the rule now says to write the pauses as `...` in the spoken text, with the example written that way.
- **The schedule filler was said twice.** The tool had a request-start message ("Give me just a second while I access the schedule") and the prompt also told the model to say a filler while tools run. Callers heard it back to back. Fix: the system announces lookups; the prompt tells the model not to.
- **Two questions in one breath** slipped in ("what brand, and what's it doing?"). Still on the list.

## Process, since the process is what kept this from being a disaster

1. **Snapshot the full assistant before and after every change**, and diff the summary line. `snapshot-assistant.sh` in this repo. Every change last night has a pair.
2. **PATCH sends the whole object.** Model, transcriber, voice: resend everything or lose it. We resent 74 keyterms four times.
3. **Text-mode chat tests before a phone call.** VAPI's `/chat` endpoint runs the real assistant and tools. Seven scripted conversations caught the decline regression in two minutes.
4. **One change per phone call.** The one time we deployed two at once, we said so and chose two that can't interact.
5. **Score every call from `artifact.performanceMetrics`.** `latency/score-last-calls.sh` prints the per-turn stage table for the last N calls. It is the only way to know which dial you actually turned.
6. **Keep the last known-good snapshot's timestamp written down.** "Roll it back" should be one command, and it was.
7. Use `curl` for the API from scripts. Python's default web client gets a Cloudflare 403 from `api.vapi.ai`; curl doesn't.
8. **On a public repo, commit named files only.** A `git add -A` last night swept in files that named the business. Caught and removed one commit later, but the history has it. The identifier check that used to print a warning now blocks the commit.

## Where the line stands the next morning

Prompt at 40,000 characters, cost per call down two-thirds, pause-detector ceiling at 2.2 seconds, transcriber finalization at 200 ms, the original voice with the warmth recipe, read-backs that pause where they should. Median turn still in the high twos on the last scored conversation. The model's second is the floor we haven't found a way under without changing the model, which is the next experiment and the last one on the list.
