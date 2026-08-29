// Minimal VAPI tools server — the layer-4 skeleton.
// Each tool your assistant declares points at an endpoint here; this is
// where the AI's requests meet your real business systems.
import express from "express";
const app = express();
app.use(express.json());

// Health check (Railway + your own monitoring)
app.get("/status", (_req, res) => res.json({ ok: true }));

// Example tool endpoint. In VAPI, create a tool whose server URL is
// https://<your-app>.up.railway.app/vapi and route on the tool name.
app.post("/vapi", async (req, res) => {
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
