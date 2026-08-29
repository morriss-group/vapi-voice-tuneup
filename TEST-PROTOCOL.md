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

## The rules
- Test after EVERY change, not after every few.
- One change at a time when hunting a problem — or you won't know which
  fix worked.
- Your ear outranks the dashboard. If it sounds wrong, it is wrong.
- New agents inherit a known-good base config; they don't rediscover it.
