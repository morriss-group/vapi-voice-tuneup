#!/usr/bin/env node
// vapi-voice-tuneup: apply the field-tested base settings to a VAPI assistant.
// Deliberately NEVER touches the `model` object (see README: PATCH replaces it
// wholesale — your prompt and tools are yours; this tool stays out of them).
import { readFileSync } from "node:fs";

const KEY = process.env.VAPI_API_KEY;
const [id, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry");
const withVoice = flags.includes("--voice");        // opt-in: 11labs settings
const withTranscriber = flags.includes("--transcriber"); // opt-in: deepgram settings

if (!KEY || !id) {
  console.error("usage: VAPI_API_KEY=... node apply-base.mjs <assistant-id> [--dry] [--voice] [--transcriber]");
  process.exit(1);
}

const base = JSON.parse(readFileSync(new URL("./base-config.json", import.meta.url)));
const api = (path, opts = {}) =>
  fetch(`https://api.vapi.ai${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...opts.headers },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`${opts.method || "GET"} ${path} -> ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  });

const live = await api(`/assistant/${id}`);
console.log(`assistant: ${live.name} (${id})`);

const patch = {
  startSpeakingPlan: base.startSpeakingPlan,
  maxDurationSeconds: base.maxDurationSeconds,
  voicemailDetection: base.voicemailDetection,
};
if (withVoice) {
  const v = { ...base.voice_11labs_suggested };
  if (live.voice?.provider === "11labs" && live.voice?.voiceId) v.voiceId = live.voice.voiceId; // keep their voice
  if (!v.voiceId) { console.warn("no 11labs voiceId on assistant; skipping --voice"); }
  else patch.voice = v;
}
if (withTranscriber) {
  patch.transcriber = { ...(live.transcriber || {}), provider: "deepgram", model: "nova-3", numerals: true };
  console.warn("note: add your own keyterm list to the transcriber for names/brands your calls hear");
}

for (const [k, v] of Object.entries(patch)) {
  const cur = JSON.stringify(live[k] ?? null), nxt = JSON.stringify(v);
  console.log(`${cur === nxt ? "  keeps" : "CHANGES"} ${k}${cur === nxt ? "" : `\n    from: ${cur?.slice(0, 100)}\n      to: ${nxt?.slice(0, 100)}`}`);
}

if (dry) { console.log("\n--dry: nothing sent."); process.exit(0); }
await api(`/assistant/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
console.log("\napplied. Test-call your agent before real traffic — always.");
