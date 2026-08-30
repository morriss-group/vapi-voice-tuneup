# Retell field notes — toward a full adapter

Earned during a real failover build (a VAPI-primary business line getting a
Retell backup agent), August 2026. These are SETUP scars; call-handling
tuning notes will follow once this backup has taken production traffic.
Per this kit's rule: nothing here is speculation.

## API gotchas that cost us real time
- **Model names differ from Anthropic's own.** Retell wants
  `claude-4.6-sonnet` (their naming), not `claude-sonnet-4-6`. The error
  message helpfully lists all valid values — read it.
- **Phone-number → agent binding is mid-migration (2026).** The old
  `inbound_agent_id` field is hard-rejected as deprecated; the newer
  `inbound_rule` shape was SILENTLY IGNORED on PATCH for us (nickname in
  the same call applied; the binding didn't). The dashboard dropdown works
  every time. Until their migration settles: **bind inbound agents in the
  dashboard, verify by calling the number.**
- **Custom functions (tools):** Retell POSTs `{ call, name, args }` to your
  URL — a different envelope than VAPI's. If your tools server was built
  for VAPI, add a small adapter route that unwraps `name`/`args` into the
  same handlers (ours was ~20 lines). If you can't set custom headers on
  the platform side, support a `?key=` query param for the shared secret.
- **First-call fixes (from our backup's first live test):** the begin
  message fires the instant the line connects — before the caller's audio
  path settles — so the greeting's first words get CLIPPED. Fix:
  `begin_message_delay_ms: 1000` on the agent, plus a clip-resistant
  greeting (lead with a throwaway "Hi there!" so a lost first word never
  costs the business name). And Retell's transcriber needs
  `boosted_keywords` on the agent (their equivalent of Deepgram keyterms) —
  without it, our tester's "Hoover" transcribed as "Uber" and "Homewood"
  as "homework."
- **Voices:** 300+ in `/list-voices`, spanning ElevenLabs, Cartesia,
  OpenAI, MiniMax and platform voices. Our ear-test winner from the VAPI
  side (Cartesia) is available here too.

## The human gates (no API will do these — plan ONE sitting for all of them)
Autonomous setup hits four walls that are human-only by design. The
workaround isn't automation — it's batching: do them in one sitting, in
this order, then everything after is scriptable.
1. **Account creation** (any platform) — always human.
2. **Payment method on file** — numbers and usage won't provision without
   a card, and entering payment is rightly human-only.
3. **KYC / identity verification** — Retell requires it before the FIRST
   number, and the flow only starts inside the dashboard's buy-number UI
   (API returns "No valid KYC"). Have ready: legal/business name, address,
   and a one-line use-case ("inbound customer-service line for X").
4. **The one mid-migration dashboard step** — currently the inbound-agent
   binding (above).
Everything else — agent creation, prompts, tools, number provisioning
(post-KYC), config — is clean API territory.

## The failover pattern this was built for
Primary agent on platform A; backup agent on platform B with the SAME
prompt + the same tools via an adapter route; the phone number's carrier-
level fallback URL points at the backup. Result: a platform outage on A
costs you zero missed calls. Full write-up once ours has survived a real
outage.
