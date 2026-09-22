# Three weeks later: the same pauses, three rules, and a booking lost to a space

*September 21–22, 2026. The same production receptionist on the same business line. The owner listened to a Monday's calls and said the agent "wasn't acting the same as Friday." Written up the next morning. Same rule as the first log: the numbers, and the parts that went wrong.*

## Step 0: was anything different?

Before touching a setting, we read all 24 of Monday's calls against Friday's 17 and pulled the config history. Nothing had changed. Same assistant version since the 14th, same tools-server code since the 15th, zero calls on the backup line, zero tool errors on any day but one. Turn latency was inside the nine-day band to the tenth of a second.

What was different was the day: 24 calls instead of 17, 7 bookings instead of 3, 4 callers asking for the owner by name instead of none, 5 robocalls. A heavier day surfaces the same defects more often. It does not mean the agent drifted. **Check the config history before you believe the feeling.** It took ten minutes and it changed what we fixed.

## What the transcripts actually showed

Four defects, in order of what they cost:

1. **A booking failed on the last step and the caller hung up.** The tool that creates the appointment returned a failure; the agent offered the website; the caller said "I'll just do it" and was gone. He booked himself through the website two minutes later, so the business kept him. The next one might not.
2. **A city was declined without asking the ZIP.** Parts of that city are inside the service area. The agent turned the caller away on the name alone.
3. **A misheard surname went onto a ticket.** The caller's email spelled the real name. The agent read both back, got a "yes" to both, and never noticed they disagreed. Fourth time this class of mistake had happened.
4. **An email failed three read-backs** (an "s" kept coming through as "minus"), so the agent skipped it and booked without one. That is the designed fallback, and it is still a hole.

One thing that looked like a defect and wasn't: transcripts showing the agent saying "September 20 second." With the transcriber's numerals setting on, that is the transcriber writing down the agent's own audio of "twenty-second." Callers heard it fine. Bot lines in VAPI's transcript are transcriptions of the agent's speech unless you turn on `modelOutputInMessagesEnabled`; know which you are reading.

## The failed booking: found in the logs, fixed in code

The tools server logs one line for a failed booking. Reading it needed the hosting provider's command-line tool, which turned out to be installed on the machine but off the `PATH`, and not logged in. Ten seconds after login:

```
book error: HCP POST /customers -> 400: Email must be a single, valid email address
```

The agent had passed the email with a space in the middle of it, leaked in from the letter-by-letter read-back. The CRM rejects anything that isn't one clean address, and the tools server created the customer before the appointment, so the whole booking died on the email.

The fix is in the tools server, not the prompt. Every email is normalized before it touches the CRM: whitespace stripped, spoken "at" and "dot" folded into symbols, lowercased, validated. If it still isn't an address, the customer is created without one and the tool's reply says so in words the agent speaks verbatim: *"The email address didn't come through clearly, so your confirmation will come by text to your cell instead."* The fake CRM in the test suite now rejects bad emails exactly the way the real one did, and three fixtures lock the behavior, including the exact address that failed.

**The rule underneath:** a prompt can ask the model for clean data. The code has to survive dirty data. Anything the model types into a field that a downstream system validates gets normalized in code before the request, or a transcription slip costs a customer.

## Three prompt rules, and how they were tested before they went live

The prompt was also cut, from about 54,600 characters to 44,800, by rebuilding it from an earlier compaction plus everything added since, minus everything the owner had deleted since. No rule lost. Three rules added:

- **The ZIP comes before any decline.** A covered place name continues. Any other answer, including a city the list says to decline, gets exactly one question first: "And what's the zip code there?" Conditional ZIPs get one neutral "And what neighborhood is that?" The agent never names the covered neighborhood for the caller. Decline on the ZIP, never on the city.
- **Names and emails letter by letter, with a cross-check.** The agent spells back what it heard, "B-R-O-W-N — Brown, did I get that right?", and never asks the caller to spell first. Emails are read letter by letter before the @. If the letters of the email contain a surname that isn't the one given, it asks which is right before booking.
- **Use the tool's words exactly.** When a tool returns a `speakable` or `message` field, the agent says it word for word, first, and never turns it into a calendar claim. The tool says "Same-day appointments cannot be booked over the phone — the earliest I can offer is tomorrow"; the agent had been saying "Monday is fully booked."

**Test before deploy, in text, against the real tools.** VAPI's chat endpoint (`POST /chat`) accepts `assistantOverrides`, including a full replacement system prompt and a tool list, alongside the live assistant's id. That runs a candidate prompt through the real tool calls without touching the live line. Use a dummy phone number; a real customer's number matches their record and derails the test.

The first draft of the name rule failed that test. The agent asked the caller to spell a plain three-letter surname instead of spelling it back, then refused to move on until it got the letters. The rule was rewritten to say the agent spells first, asks for a spelling only after a correction, and never holds the call for it. Then it passed: with the name given as Brown and an email that spelled Braun, "Should the appointment be under Brown, or Braun?" appeared exactly where it should. Text mode has its own slips (it once spelled a three-letter name with the wrong first letter); real calls are the proof.

## The pauses, measured by piece

Three weeks after the first log, 355 turns:

| | ordinary replies | lookup turns |
|---|---:|---:|
| median wait | 3.0 s | 4.0 s |
| one in four over | 3.6 s | 5.4 s |
| one in ten over | 5.0 s | 7.1 s |
| turns over 4 s | 17% | 50% |

An ordinary reply is four fixed pieces plus plumbing: deciding the caller has finished, about 0.5 s; the transcriber, 0.4; the model, 1.1; the voice starting, 0.6; and about half a second unattributed. A lookup turn is a second model pass on top: the model decides to call the tool, the tool answers in a third of a second, the model reads the answer. Half of all lookup turns are over four seconds, and that is what a caller hears as "one sec while I pull up your info… (silence)."

Cutting the prompt did nothing for this, which the first log already found. The levers that remain, in order of size: the model (a faster model roughly halves the biggest piece, twice on lookups, at a rule-following risk), the voice provider (a faster one was rejected on sound in the first log), and the small fixed waits around the edges.

## What was changed without a test call, and why those

Three settings, all reversible, snapshots taken before and after:

- The pause detector's fixed floor, 350 ms down to 150 ms (the constant in the `waitFunction`, 700 → 300 before the halving).
- `startSpeakingPlan.waitSeconds` from the default 0.4 to 0.2.
- `voice.chunkPlan.minCharacters` from the default 30 to 15, so the voice starts on a shorter first chunk.

Expected: roughly half a second off every turn. Not changed: the model and the voice provider, because neither gets swapped on a live line before the owner has listened to it. The measured result of these three goes in `latency/RESULTS.md` once a day of real calls is in; until then they are applied, not proven.

## An experiment that is not finished

VAPI's OpenAPI spec says of a tool's `request-complete` message: *"If this message is provided, only this message will be spoken and the model will not be requested to respond."* With a `variableExtractionPlan`, fields of the tool's response become `{{variables}}`. If that works on a real call, the availability and booking turns lose their second model pass, about a second and a half each, and it lines up exactly with the tool's-words rule.

Tried in text on a cloned tool: the message was spoken literally as `{{speakable}}` and the model still answered. Either the variable isn't rendered in chat mode, the template needs different spelling, or extraction runs after the message fires. Inconclusive. The clone was deleted and nothing live was touched. It gets a real call.

## Housekeeping

- A transcriber fallback was added: AssemblyAI behind Deepgram. Per the docs it fires on provider failure only, not on slowness. The 7-to-10-second transcriber stalls seen on Monday are not the failure case; this catches the drops.
- The backup line (Retell) was ported to the same three rules the same morning, with its six failover differences kept: no repair-visit tool, no live transfer, a callback at the fourth ask and every ask after, and the silent hang-up on robocalls. Two lines, one set of rules.
- Every change is snapshotted before and after. The snapshot script in this repo is how.
