# Step-by-step: zero to answering your business line

## Before you start — a phone cannot finish this

Everything below needs a computer. A phone can read this page, download a ZIP, and click Watch, and that is where a phone stops. If you have never used a terminal:

- **Install Node.** Go to nodejs.org and install the LTS version with the normal installer. Nothing else.
- **Open a terminal.** Mac: press Command-Space, type Terminal, press Return. Windows: press the Windows key, type PowerShell, press Return. Every command in this guide is typed into that window and run with Return.
- **Check it worked.** Type `node -v` and press Return. You should see a version number starting with 20 or higher. If you see "command not found," Node did not install; close the terminal, run the installer again, open a new terminal.
- **The commands below that start with `node`, `./`, `curl`, or `git` are all typed into that same window,** from inside the folder you unzip or clone in the next section (`cd` followed by the folder's path gets you there; on a Mac you can type `cd ` and drag the folder into the window).

## Before you start — get the files onto your machine
The steps below run scripts from this repository, so you need a copy of it. Two ways:
- **Download:** the green **Code** button on the repo page → **Download ZIP** → unzip it. Simple, but a ZIP never changes; when a fix is published here you will not have it until you download again.
- **Clone:** `git clone https://github.com/morriss-group/vapi-voice-tuneup.git`. Later, `git pull` inside that folder brings in every fix.
Either way, click **Watch → Custom → Releases** on the repo page so GitHub emails you when something changes, and read [CHANGELOG.md](CHANGELOG.md) for the exact line to edit in your own prompt. Nothing updates on its own.

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
   ⚠️ **BUY THE NUMBER THROUGH TWILIO AND IMPORT IT. Do not use a
   Vapi-provided number if your agent will ever hand a caller to a person.**
   Two reasons, and the second one is not optional:
   1. Twilio's inventory has far better LOCAL area-code selection, and for a
      local business a caller seeing their own area code answer is worth real
      trust.
   2. **A Vapi-provided number cannot transfer a call.** We tested the same
      assistant, same transfer plan, same destination, on both: the Vapi
      number failed every time with `call.in-progress.error-transfer-failed`
      and the Twilio number connected on the first try. The error says nothing
      about why. See README fix #9. Import: Twilio console → buy number → VAPI dashboard →
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

**What the server in this repository is:** a stand-in that answers every availability question with made-up openings, so you can prove the wiring end to end. It calls no calendar, retries nothing, and will cheerfully "book" the same slot twice. The real one, the part that talks to your scheduling software, is your build; keep it private.

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
   the gate. `GET /status` answers `{"ok":true,"secretConfigured":true}` when
   the variable is set and `false` when it is not — it never prints the value.
   Then call your own agent and confirm a real tool call still succeeds. (Until September 23, 2026 this guide said in one place that `/status` told you nothing about your config; the code now returns this field, and it never prints the value.)

5. Do not attach the example `check_availability` tool to an assistant that
   answers a live number. It returns invented windows ("Tue 10-12"), and the
   agent will read them to a caller as if they were on your calendar. Layer 5
   replaces it with a real lookup first.

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
