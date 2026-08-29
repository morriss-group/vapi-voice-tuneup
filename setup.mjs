#!/usr/bin/env node
// vapi-voice-tuneup interactive setup — walks you from nothing to a live,
// well-tuned AI receptionist, then hands you a brief for your AI coding
// assistant to build the custom layers.
//   VAPI_API_KEY=... node setup.mjs
import { createInterface } from "node:readline/promises";
import { writeFileSync, readFileSync } from "node:fs";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, def = "") => {
  const a = (await rl.question(def ? `${q} [${def}] ` : `${q} `)).trim();
  return a || def;
};
const KEY = process.env.VAPI_API_KEY;
const api = (path, opts = {}) =>
  fetch(`https://api.vapi.ai${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`${opts.method || "GET"} ${path} -> ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  });

console.log(`
╔════════════════════════════════════════════════════════════╗
║  vapi-voice-tuneup setup                                   ║
║  From zero to a tuned AI receptionist on your phone line.  ║
╚════════════════════════════════════════════════════════════╝
`);

// ── Step 0: API key ─────────────────────────────────────────
if (!KEY) {
  console.log(`No VAPI_API_KEY found.
  1. Create an account at https://vapi.ai
  2. Dashboard → left sidebar → API Keys → create a PRIVATE key
  3. Re-run:  VAPI_API_KEY=your-key node setup.mjs\n`);
  process.exit(1);
}
try { await api("/assistant?limit=1"); console.log("✓ API key works.\n"); }
catch (e) { console.error("✗ API key rejected:", e.message); process.exit(1); }

// ── Step 1: the business ────────────────────────────────────
console.log("── Step 1 of 5: your business ──");
const biz = await ask("Business name?");
const trade = await ask("What kind of business? (e.g. appliance repair, salon, HVAC)");
const area = await ask("Service area / city?");
const goal = await ask("What should the agent do? (1=answer & take messages, 2=also book appointments)", "1");
const keyterms = [biz, area, ...(await ask("Words callers will say that transcripts must get right (brands, neighborhoods — comma-separated)?", "")).split(",")]
  .map((s) => s.trim()).filter(Boolean);

// ── Step 2: create the tuned assistant ──────────────────────
console.log("\n── Step 2 of 5: creating your assistant (with all tuning pre-applied) ──");
const prompt = `You are the friendly AI receptionist for ${biz}, a ${trade} business serving ${area}.
HOW YOU TALK: 1-3 short sentences per turn. ONE question at a time — wait for the answer. Warm, natural, never robotic. If asked whether you are a real person, say plainly that you are ${biz}'s AI receptionist.
YOUR JOB: greet the caller, learn why they're calling, and ${goal === "2" ? "collect what's needed to book them: name, phone number (read it back grouped to confirm), address, and what needs service. Say someone will confirm the exact time." : "take a complete message: name, phone number (read it back grouped to confirm), and what they need. Promise a callback."}
HARD RULES: never invent prices, availability, or promises — say "they'll confirm that with you directly." Never give out personal information. If the caller is angry or it's an emergency, be kind and promise a fast callback. Keep the whole call efficient and pleasant.`;
const created = await api("/assistant", {
  method: "POST",
  body: JSON.stringify({
    name: `${biz} receptionist`,
    firstMessage: `Thanks for calling ${biz}! I'm the AI receptionist — how can I help you today?`,
    model: { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.25, maxTokens: 800,
      messages: [{ role: "system", content: prompt }] },
    voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM", model: "eleven_turbo_v2_5",
      stability: 0.4, style: 0.3, speed: 1.1, optimizeStreamingLatency: 3 },
    transcriber: { provider: "deepgram", model: "nova-3", numerals: true, keyterm: keyterms },
    startSpeakingPlan: JSON.parse(readFileSync(new URL("./base-config.json", import.meta.url))).startSpeakingPlan,
    maxDurationSeconds: 1800,
    voicemailDetection: { provider: "twilio", enabled: true, machineDetectionTimeout: 25,
      voicemailDetectionTypes: ["machine_start", "machine_end_beep", "machine_end_silence"] },
    voicemailMessage: `Hi, this is the assistant for ${biz}. Sorry we missed you — please call us back and we'll take care of you. Thanks!`,
  }),
});
console.log(`✓ Assistant created: ${created.id}\n  (endpointing, voice, voicemail detection, 30-min ceiling: all pre-tuned)`);

// ── Step 3: phone number ────────────────────────────────────
console.log("\n── Step 3 of 5: phone number ──");
const nums = await api("/phone-number");
if (nums.length === 0) {
  console.log(`No phone numbers on this account yet.
  → PRO TIP: buy through TWILIO and import — far better local area-code
    selection than VAPI-native numbers, and a local number answering
    builds caller trust. (Twilio console → buy → VAPI dashboard →
    Phone Numbers → Import from Twilio.)
  Then attach your new assistant to it, or re-run this setup.`);
} else {
  nums.forEach((n, i) => console.log(`  ${i + 1}. ${n.number} (${n.name || "unnamed"})`));
  const pick = await ask(`Attach the assistant to which number? (1-${nums.length}, or 'skip')`, "skip");
  if (pick !== "skip" && nums[+pick - 1]) {
    await api(`/phone-number/${nums[+pick - 1].id}`, { method: "PATCH", body: JSON.stringify({ assistantId: created.id }) });
    console.log(`✓ ${nums[+pick - 1].number} now answers as your assistant.`);
    console.log(`  Tip: forward your business line here only when you don't pick up — overflow-first is the safe rollout.`);
  }
}

// ── Step 4: call reports ────────────────────────────────────
console.log("\n── Step 4 of 5: transcripts & summaries to you ──");
const hook = await ask("Paste a Make.com/Zapier webhook URL for call reports (or 'skip'):", "skip");
if (hook !== "skip" && hook.startsWith("http")) {
  await api(`/assistant/${created.id}`, { method: "PATCH",
    body: JSON.stringify({ server: { url: hook, timeoutSeconds: 20 }, serverMessages: ["end-of-call-report"],
      analysisPlan: { summaryPlan: { enabled: true } } }) });
  console.log("✓ Every call now sends a transcript + summary to your webhook. Route it to email/Slack in Make.");
} else {
  console.log("Skipped. Set it up later: Make.com → Webhook trigger → paste URL into the assistant's Server URL.");
}

// ── Step 5: THE SYSTEMS TEST ────────────────────────────────
console.log(`\n── Step 5 of 5: the systems test (do not skip) ──
Call your agent RIGHT NOW and run the scorecard in TEST-PROTOCOL.md:
  fast responses · human voice · honest "are you real?" · refuses to
  invent prices · handles a mumbled name · leaves a voicemail properly.
Your ear outranks every dashboard.`);
await ask("\nPress Enter when you've made your test call...");

// ── The brief ───────────────────────────────────────────────
const brief = `# BUILD BRIEF — paste this into an AI coding session (Claude Code or similar)

I run ${biz}, a ${trade} business in ${area}. I've deployed a tuned VAPI
voice assistant (id: ${created.id}) using the vapi-voice-tuneup kit — it
answers calls${goal === "2" ? " and collects booking details" : " and takes messages"}, with call reports ${hook !== "skip" ? "delivered via my webhook" : "not yet wired (help me set that up too)"}.

Help me build the next layer — the TOOLS SERVER (see tools-server/ in the
kit for the skeleton and ARCHITECTURE.md for how it fits):
1. Deploy tools-server/ to Railway under my account (keep node as PID 1 —
   railway.json already does this).
2. Connect it to my real systems: I use [FILL IN: your calendar /
   field-service software / CRM] — build tool endpoints so the agent can
   [FILL IN: check real availability / create real bookings / look up
   customers].
3. Register those tools on my VAPI assistant. ⚠ When PATCHing the
   assistant, ALWAYS fetch the live model object first and resend it
   complete — PATCH replaces the whole model and will silently strip
   tools otherwise.
4. After every change, I will make a live test call before real traffic
   (TEST-PROTOCOL.md) — build in that rhythm; never ship untested.
Rules: least privilege on every API key; credentials live in Railway env
vars, never in code; the agent never sees credentials — it only calls my
endpoints.`;
writeFileSync("BUILD-BRIEF.md", brief);
console.log(`\n✓ Wrote BUILD-BRIEF.md — paste it into an AI coding session to build
  your booking/tools layer. Fill in the [FILL IN] blanks first.

Done. Your receptionist is live and tuned. Test-call it often.`);
rl.close();
