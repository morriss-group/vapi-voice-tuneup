# The full stack — how a production AI receptionist actually fits together

Five layers. Each is simple; the wiring is what nobody documents.

```
  CALLER
    │ dials your business number
    ▼
  [1] PHONE NUMBER  (Twilio via VAPI, or VAPI-native)
    │ routes the call
    ▼
  [2] VAPI ASSISTANT  (the brain: model + voice + transcriber + prompt)
    │ when the agent needs to DO something (check a calendar, book a job,
    │ look up a customer) it calls a tool ──────────────┐
    ▼                                                   ▼
  [3] END-OF-CALL WEBHOOK                    [4] TOOLS SERVER (yours)
      (transcript + summary → Make.com,          small web service that
      Zapier, or your own endpoint —             answers the agent's tool
      how YOU find out what happened)            calls and talks to your
                                                 real systems (calendar,
                                                 CRM, field-service app)
                                                        │
                                                        ▼
                                             [5] YOUR BUSINESS SYSTEMS
                                                 (Housecall Pro, Jobber,
                                                  Google Calendar, etc.)
```

Layer 2 alone gets you an agent that TALKS. Layers 3-5 make it an agent
that WORKS: books real appointments, checks real availability, and tells
you what happened on every call.

Start with 1+2+3 (a receptionist that answers and takes messages, with
transcripts delivered to you). Add 4+5 when you're ready for real booking.
