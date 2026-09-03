# Step-by-step: zero to answering your business line

## Layer 1+2 — assistant and phone (30-60 min)
1. Create a VAPI account (vapi.ai) → Assistants → Create.
2. Model: Anthropic claude-sonnet class, temperature ~0.25, maxTokens 800.
   (Low temperature = consistent; 800 tokens = it can't monologue.)
3. Write the system prompt. Non-negotiables that survive contact with real
   callers: 1-3 short sentences per turn · ONE question at a time · never
   invent prices or promises ("Marc will confirm that") · exact wording for
   how it identifies itself · what it must NEVER discuss.
4. Apply this repo's base settings: `node apply-base.mjs <assistant-id>`.
   Add transcriber keyterms: your business name, your city names, brand
   names your callers say. Then snapshot the assistant
   (`./snapshot-assistant.sh <id>`) and snapshot again after every later
   change — README fix #5 explains what silently disappears otherwise.
5. Phone Numbers → buy/import a number → attach the assistant.
   NUMBER-BUYING TIP (from running this in production): buy the number
   through TWILIO and import it into VAPI, rather than buying VAPI-native.
   Twilio's inventory has far better LOCAL area-code selection — and for a
   local business, a caller seeing their own area code answer is worth
   real trust. Import: Twilio console → buy number → VAPI dashboard →
   Phone Numbers → Import from Twilio (needs your Twilio SID + auth token). Forward
   your business line to it, or start with it as an overflow/after-hours
   line (calls roll to the AI only when you don't answer — the gentlest
   rollout).

## Layer 3 — know what happened on every call (30 min)
Not a programmer? [MAKE-WEBHOOK-WALKTHROUGH.md](MAKE-WEBHOOK-WALKTHROUGH.md) is this layer done click by click, both tabs, with the fixes for when it doesn't fire.
1. In Make.com (or Zapier): create a scenario starting with a Webhook
   trigger. Copy the webhook URL.
2. On the assistant: set `server.url` to that URL and `serverMessages` to
   `["end-of-call-report"]`. Enable `analysisPlan.summaryPlan` so reports
   include a summary, not just a transcript.
3. In Make: route the report wherever you actually look — email, Slack,
   a spreadsheet. Include: caller number, summary, transcript link.
4. Call your own agent; confirm the report lands. A webhook nobody
   verified is a webhook firing into the void.

## Layer 4 — the tools server (when you're ready for real booking)
Deploy `tools-server/` from this repo to Railway (or any Node host):
1. Push it to a GitHub repo → Railway → New Project → Deploy from repo.
2. CRITICAL, learned the hard way: the included railway.json runs
   `node server.js` directly. npm must NOT be PID 1 — it eats shutdown
   signals and every redeploy looks like a crash.
3. Set env vars for whatever business systems you connect.
4. In VAPI: create tools pointing at your endpoints; attach to the
   assistant. ⚠ THE TRAP: PATCHing the assistant's model replaces the
   WHOLE model object — always GET, mutate, resend complete (tools
   included), or you'll silently strip them.

## Layer 5 — your business systems
Your tools server is the only thing that talks to them. Keep credentials
in env vars on the server — the AI never sees them; it just calls your
endpoints. Least privilege: give the server an API key that can do only
what the agent needs.

## Rollout discipline
Overflow-first (AI answers only what you miss) → watch a week of
transcripts → then let it answer first. Never skip the middle step.
