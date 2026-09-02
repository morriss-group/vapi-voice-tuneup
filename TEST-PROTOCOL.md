# The systems test — never let an untested agent take a real call

Every config change, every prompt edit, every voice swap: TEST-CALL FIRST.
This protocol is ~5 minutes and catches what dashboards can't.

## The scorecard (say these out loud on a real phone call to your agent)
1. LATENCY: does it respond on a conversational beat after you stop
   talking? (4+ second pauses = endpointing problem — see README fix #1.)
2. VOICE: does it sound like a person? (Robotic = stability too high.)
3. IDENTITY: "Are you a real person?" — it must answer honestly, exactly
   as its prompt specifies.
4. THE FORBIDDEN QUESTION: ask the thing it must never answer (a price it
   shouldn't quote, an address it shouldn't give). It should deflect
   gracefully, not comply and not glitch.
5. THE HANDOFF: "Can I just talk to a human?" — it should do exactly what
   its prompt promises (callback, transfer) and nothing it can't deliver.
6. GARBLE TEST: give a name/address slightly mumbled. Does it read back
   and confirm? (Keyterms + numerals settings matter here.)
7. VOICEMAIL: call from a line that goes to voicemail, don't pick up —
   confirm it leaves the message instead of greeting the beep.
8. THE REPORT: after hanging up, confirm the transcript + summary arrived
   where layer 3 sends them.
9. THE FENCE: give an address just outside your service area. It must
   decline politely and offer nothing — not book it, not "check with the
   owner." Then give one just inside; it must book.

## The rules
- Test after EVERY change, not after every few.
- One change at a time when hunting a problem — or you won't know which
  fix worked.
- Your ear outranks the dashboard. If it sounds wrong, it is wrong.
- New agents inherit a known-good base config; they don't rediscover it.

## The out-of-area audit (monthly, 20 minutes)
The scorecard tests one call. This tests the last month of real ones.

1. Pull every job booked in the last 30 days from your scheduling system
   (API or CSV export) with its town/ZIP and its SOURCE — voice agent,
   website booking widget, walk-in, phone.
2. Mark every job whose town/ZIP is outside your service area.
3. Group the marked jobs BY SOURCE before you touch the agent.

When we first ran this, the agent had booked ZERO out-of-area jobs. All
fifteen leaks came from the website booking widget, which had no ZIP fence
at all — anyone anywhere could book. The prompt got blamed for a week
before anyone looked. The fix was in the widget, not the AI.

Rules that fell out of it:
- Audit the whole intake path, not just the AI. The agent is the newest
  thing, so it catches the blame; it is rarely the only door.
- Keep the exclusion list in ONE place (the prompt, or a tool the prompt
  calls) and read it back after every prompt edit — it is easy to lose a
  town when you rewrite a paragraph.
- Every out-of-area booking costs a real drive or an awkward cancellation.
  A 20-minute monthly audit is cheaper than either.
