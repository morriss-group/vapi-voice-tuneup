# Step-by-step: zero to answering your business line

## Layer 1+2 — assistant and phone (30-60 min)
1. Create a VAPI account (vapi.ai) → Assistants → Create.
2. Model: Anthropic claude-sonnet class, temperature ~0.25, maxTokens 800.
   (Low temperature = consistent; 800 tokens = it can't monologue.)
3. Write the system prompt. Non-negotiables that survive contact with real
   callers: 1-3 short sentences per turn · ONE question at a time · never
   invent prices or promises ("Marc will confirm that") · exact wording for
   how it identifies itself · what it must NEVER discuss · **exact wording
   for when the caller asks for a person** — take a name and number and end
   the call, do not keep them on the line hoping the agent can handle it ·
   **"this call is recorded" in the first sentence of the greeting.**
   Alabama and federal law are both one-party consent; several states are
   all-party, and an interstate call can pull in the stricter one. If you
   record and you are not in a one-party state, ask a lawyer in yours. The
   greeting line costs you nothing either way.
4. **Snapshot first:** `./snapshot-assistant.sh <id>`. Then apply this repo's
   base settings: `node apply-base.mjs <assistant-id>` (add `--dry` first if
   the assistant already has settings you tuned by hand). Snapshot again after
   every later change — README fix #5 explains what silently disappears
   otherwise. `apply-base.mjs` does not touch `model`, so your prompt and
   tools survive it. It does replace `stopSpeakingPlan` and `voicemailDetection`
   whole, and merges `startSpeakingPlan` onto what is live.
   Add transcriber keyterms: your business name, your city names, brand
   names your callers say.
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

## Layer 4.5 — lock the tools server BEFORE you connect it to anything real

**Do this in the same sitting as Layer 4. Not "later."** The moment Layer 5 wires
that endpoint to your actual calendar, an unprotected URL is a stranger reading
your schedule and booking on it. Until then it returns a hard-coded example and
nothing is at stake — which is exactly why it is easy to skip and easy to forget.

1. Generate a secret. Any long random string; this makes one:

   ```
   openssl rand -hex 32
   ```

2. In your host's dashboard (Railway: your service → Variables), add
   `SHARED_SECRET` and paste it. Redeploy.

3. In VAPI, on **each** tool you created, add the credential. Every tool, not
   just the first one — a single unprotected tool is an unprotected server.
   VAPI's current dashboard default is an `Authorization: Bearer <secret>`
   credential; older setups use a custom header named `x-vapi-secret`. This
   server accepts either, plus `x-shared-secret`. Pick one and use the same
   one on every tool. (If a custom header named `x-vapi-secret` stops
   arriving, VAPI is using that name itself — switch to `x-shared-secret`.)

4. Verify it actually works, because an untested gate is not a gate:

   ```
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<your-app>.up.railway.app/vapi
   ```

   That must print **401**. If it prints 200 you are running a build without
   the gate. `/status` answers `{"ok":true}` either way — it is a health check
   and deliberately tells you nothing about your config. To confirm the secret
   is actually set, check your host's Variables tab. Then call your own agent
   and confirm a real tool call still succeeds.

5. Do not attach the example `check_availability` tool to an assistant that
   answers a live number. It returns invented windows ("Tue 10-12"), and the
   agent will read them to a caller as if they were on your calendar. Layer 5
   replaces it with a real lookup first.

5. `GET /status` reports `secretConfigured: true/false` so you can check a deploy
   picked the variable up without ever printing the value.

**The trap this avoids, and it is the one that catches people:** the obvious way
to write that check treats "no secret configured" as "nothing to check" and lets
everything through. So the day a deploy drops the variable, the endpoint silently
opens instead of failing loudly. The server in this repo refuses every request
when `SHARED_SECRET` is missing. Keep it that way.

## Layer 5 — your business systems
Your tools server is the only thing that talks to them. Keep credentials
in env vars on the server — the AI never sees them; it just calls your
endpoints. Least privilege: give the server an API key that can do only
what the agent needs.

## Rollout discipline
Overflow-first (AI answers only what you miss) → watch a week of
transcripts → then let it answer first. Never skip the middle step.
