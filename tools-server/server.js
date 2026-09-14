// Minimal VAPI tools server — the layer-4 skeleton.
// Each tool your assistant declares points at an endpoint here; this is
// where the AI's requests meet your real business systems.
import express from "express";
import crypto from "node:crypto";
const app = express();
app.use(express.json());

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

function secretOk(req) {
  // Rule 1: nothing configured means nothing gets in.
  if (!SHARED_SECRET) return false;
  // VAPI sends whichever header you configured on the tool. Accept both names.
  const supplied = String(req.get("x-vapi-secret") || req.get("x-shared-secret") || "");
  const a = Buffer.from(supplied);
  const b = Buffer.from(SHARED_SECRET);
  // Rule 2: equal lengths first, because timingSafeEqual throws on a mismatch.
  if (a.length !== b.length) return false;
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
// returns nothing but ok:true, so there is nothing here to protect.
app.get("/status", (_req, res) =>
  res.json({ ok: true, secretConfigured: Boolean(SHARED_SECRET) })
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
      // Replace with a real lookup against your calendar/FSM API.
      result = { available: true, next_slots: ["Tue 10-12", "Wed 2-4"] };
      break;
    default:
      result = { error: `unknown tool: ${name}` };
  }
  res.json({ results: [{ toolCallId: call?.id, result: JSON.stringify(result) }] });
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`tools server on :${port}`));

// Graceful shutdown — with node as PID 1 (see railway.json) this actually
// runs, and redeploys exit clean instead of registering as crashes.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
