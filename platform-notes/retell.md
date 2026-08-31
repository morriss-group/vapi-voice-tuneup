# Retell field notes — toward a full adapter

Earned during a real failover build (a VAPI-primary business line getting a
Retell backup agent), August 2026. These are SETUP scars; call-handling
tuning notes will follow once this backup has taken production traffic.
Per this kit's rule: nothing here is speculation.

## API gotchas that cost us real time
- **Model names differ from Anthropic's own.** Retell wants
  `claude-4.6-sonnet` (their naming), not `claude-sonnet-4-6`. The error
  message helpfully lists all valid values — read it.
- **Phone-number → agent binding: use the ARRAY fields, not the old
  single-agent ones.** ⚠️ *Corrected 2026-08-31 after Retell's deprecation
  email — our first version of this note was wrong.* We bound a number in
  the dashboard and concluded the API couldn't do it. It can; we were
  calling deprecated fields. `inbound_agent_id` / `outbound_agent_id` (and
  their `_version` twins) were retired 03/31/2026 and are now no-ops that
  fail quietly. The replacement is a weighted array:

  ```json
  { "inbound_agents": [ { "agent_id": "agent_xxx", "agent_version": 1, "weight": 1 } ] }
  ```

  Same shape for `outbound_agents`, `inbound_sms_agents`,
  `outbound_sms_agents`. Weights let you split traffic across agents;
  a single agent is just `weight: 1`. Verify by reading the number back —
  a dashboard-bound number returns the new `inbound_agents` array, which is
  how we caught our own mistake.
- **Agent listing moved too.** `GET /list-agents` and `GET /list-chat-agents`
  were retired 07/31/2026 in favor of `POST /v2/list-agents`: POST not GET,
  filter with `filter_criteria.channel` (voice or chat), read results from
  `items` (not a top-level array), paginate with `pagination_key` +
  `has_more`, and drop `pagination_key_version`.
- **Watch your inbox, not just your status codes.** Both of the above kept
  "working" (or failing silently) long past their removal dates; we only
  learned we were on deprecated paths from Retell's automated deprecation
  emails. Deprecated-but-tolerated calls are the ones that bite later.
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
~~4. The inbound-agent binding.~~ **RETRACTED 2026-08-31:** we listed this
   as a human gate; it isn't. The API binds numbers fine via the
   `inbound_agents` array — we had simply been calling deprecated fields
   (see above). The lesson generalizes: before you file something as a
   human gate, check whether you're calling a retired endpoint. A gate you
   invented is worse than one you documented.
Everything else — agent creation, prompts, tools, number provisioning
(post-KYC), config — is clean API territory.

## The failover pattern this was built for
Primary agent on platform A; backup agent on platform B with the SAME
prompt + the same tools via an adapter route; the phone number's carrier-
level fallback URL points at the backup. Result: a platform outage on A
costs you zero missed calls. Full write-up once ours has survived a real
outage.
