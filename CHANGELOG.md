# Changelog — what changed, when, and what to change in yours

Newest first. **GitHub does not tell you when a repo you copied from changes.** Most readers of the guide opened this page and copied settings by hand, or downloaded a ZIP; neither of those ever updates. The only ways you will hear about a fix are: (1) on the repo page, click **Watch → Custom → Releases**; each entry below is also published as a Release, and GitHub emails release subscribers; (2) come back and read this file; (3) if you cloned the repo with git, `git pull`. Nothing else notifies you.

Each entry says what changed and, in bold, what to edit in your own prompt or settings.

## 2026-09-22, evening — v4b: five prompt rules, and an end-call tool on the Retell backup
Found by reading one booking call that had gone fine. Detail: [TUNING-LOG-2026-09-22.md](TUNING-LOG-2026-09-22.md), "Later the same day."
- **Add the owner's name to the prompt.** The agent invented one when asked.
- **Add a don't-know rule:** "If it is not in these instructions, you do not know it. Say 'I don't have that in front of me, but [owner] can tell you.' Never guess a name, number, date, price, or policy."
- **Change your read-back rule so digits are words with ellipses, never a hyphen touching a digit.** The voice reads `E-4-2` as "E minus four minus two."
- **Make neutral questions exact:** "Ask 'And what neighborhood is that?' in exactly those words; no list of names for the caller to pick from."
- **Add a goodbye rule:** "When the caller says goodbye or that they are all set, say one short goodbye and call endCall in the same turn."
- **Retell users:** add an `end_call` tool to the LLM's `general_tools`. Without it, no prompt wording can hang up.

## 2026-09-22, morning — v4: three prompt rules, a transcriber fallback, three latency settings, and a code fix
Detail: [TUNING-LOG-2026-09-22.md](TUNING-LOG-2026-09-22.md).
- **Prompt:** the ZIP comes before any decline; names and emails letter by letter with a name-vs-email cross-check; use the tool's words exactly when a tool returns a `speakable` or `message` field.
- **Transcriber:** add a `fallbackPlan` (AssemblyAI behind Deepgram). Fires on provider failure only.
- **Latency:** endpointing floor 350 → 150 ms in the wait function; `startSpeakingPlan.waitSeconds` 0.4 → 0.2; `voice.chunkPlan.minCharacters` 30 → 15. Reversible; measured result pending.
- **Tools server:** normalize every email before it reaches the CRM (strip spaces, fold spoken "at"/"dot", validate); a bad email must never kill the booking. See `tools-server/server.js`.

## 2026-09-02 — first tuning log
Detail: [TUNING-LOG-2026-09-02.md](TUNING-LOG-2026-09-02.md). Smart endpointing, voice settings, max duration, voicemail, transcriber keyterms. The base configuration in `base-config.json` reflects these plus the 2026-09-22 latency settings.
