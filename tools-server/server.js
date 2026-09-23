// Minimal VAPI tools server — the layer-4 skeleton.
// Each tool your assistant declares points at an endpoint here; this is
// where the AI's requests meet your real business systems.
import express from "express";
import crypto from "node:crypto";
const app = express();
app.use(express.json({ limit: "256kb" }));

// ---------------------------------------------------------------------------
// THE SECRET. Read this before you deploy.
//
// This endpoint is on the public internet. VAPI reaches it from their servers,
// which means anyone who guesses or finds the URL reaches it too. On the day it
// returns a hard-coded example that does not matter. The day you wire it to your
// real calendar — which is the entire point of this file — an open endpoint lets
// a stranger read your schedule and book on it.
//
// So: one shared secret, set in your hosting dashboard, sent by VAPI on every
// tool call, checked here before anything else runs.
//
// TWO RULES THAT ARE EASY TO GET WRONG AND EXPENSIVE TO GET WRONG:
//
// 1. A MISSING SECRET MUST REJECT EVERYTHING. If SHARED_SECRET is unset —
//    because you forgot it, or a deploy dropped it — this must refuse every
//    request, not wave them all through. The naive version of this check treats
//    "no secret configured" as "nothing to check" and quietly becomes an open
//    door at the exact moment you stop watching.
//
// 2. COMPARE IN CONSTANT TIME. A plain === returns faster on a wrong first
//    character than on a wrong last one, and that difference is measurable over
//    enough requests. timingSafeEqual does not leak that.
// ---------------------------------------------------------------------------
const SHARED_SECRET = (process.env.SHARED_SECRET || "").trim();

const MAX_SECRET_CHARS = 256;

// VAPI's dashboard default today is an `Authorization: Bearer <secret>`
// credential. Older setups and the walkthrough in DEPLOY-GUIDE use a custom
// header. Accept all three so a reader who follows either instruction works —
// they all still have to know the secret.
function readSuppliedSecret(req) {
  const rawAuth = String(req.get("authorization") || "");
  const bearer = rawAuth.toLowerCase().startsWith("bearer ") ? rawAuth.slice(7) : "";
  return String(req.get("x-vapi-secret") || req.get("x-shared-secret") || bearer || "");
}

function secretOk(req) {
  // Rule 1: nothing configured means nothing gets in.
  if (!SHARED_SECRET) return false;
  const supplied = readSuppliedSecret(req);
  if (!supplied || supplied.length > MAX_SECRET_CHARS) return false;
  // Rule 2: hash both sides first. Comparing the raw strings needs a length
  // check before timingSafeEqual (it throws on a mismatch), and that early
  // return leaks the secret's length. Digests are always 32 bytes.
  const a = crypto.createHash("sha256").update(supplied).digest();
  const b = crypto.createHash("sha256").update(SHARED_SECRET).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireSecret(req, res, next) {
  if (!secretOk(req)) {
    // Say nothing useful. "unauthorized" and a 401, no hint about why.
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// Health check (Railway + your own monitoring). Deliberately NOT behind the
// secret: your host has to be able to reach it to know the app is alive. It
// returns ok:true and whether a shared secret is configured (never the value), so a deploy that dropped the variable is visible from outside.
app.get("/status", (_req, res) =>
  res.json({ ok: true, secretConfigured: Boolean(process.env.SHARED_SECRET) })
);

// Example tool endpoint. In VAPI, create a tool whose server URL is
// https://<your-app>.up.railway.app/vapi and route on the tool name.
app.post("/vapi", requireSecret, async (req, res) => {
  const call = req.body?.message?.toolCalls?.[0];
  const name = call?.function?.name;
  const args = call?.function?.arguments || {};
  let result;
  switch (name) {
    case "check_availability":
      // STUB. These are not real openings. Do not attach this tool to an
      // assistant that answers a live number until it reads a real calendar —
      // the agent will read these windows out loud as if they were bookable.
      result = { available: true, next_slots: ["Tue 10-12", "Wed 2-4"] };
      break;
    default:
      result = { error: `unknown tool: ${name}` };
  }
  res.json({ results: [{ toolCallId: call?.id, result: JSON.stringify(result) }] });
});

// Every value the model types into a field that a downstream system validates gets
// normalized in code first. Found 2026-09-21: a read-back leaked a space into an
// email address, the CRM rejected it, and the whole booking died on the email.
// Strip whitespace, fold spoken "at" / "dot", lowercase, validate; return null if
// it still is not an address, and let the caller book without one rather than fail.
export function normalizeEmail(input) {
  let e = String(input || "").trim().toLowerCase();
  if (!e) return null;
  e = e.replace(/\s+at\s+/g, "@").replace(/\s+dot\s+/g, ".").replace(/\s+/g, "");
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null;
}

const port = process.env.PORT || 3000;
const server = process.env.NODE_TEST ? null : app.listen(port, () => console.log(`tools server on :${port}`));

// Graceful shutdown — with node as PID 1 (see railway.json) this actually
// runs, and redeploys exit clean instead of registering as crashes.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
