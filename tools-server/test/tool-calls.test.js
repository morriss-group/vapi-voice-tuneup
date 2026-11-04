import { test, before, after } from "node:test";
import assert from "node:assert/strict";
process.env.NODE_TEST = "1";
process.env.SHARED_SECRET = "test-only-secret";
const { app } = await import("../server.js");

let server, base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function postVapi(message) {
  const res = await fetch(`${base}/vapi`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-only-secret" },
    body: JSON.stringify({ message }),
  });
  assert.equal(res.status, 200);
  return res.json();
}

// The shape on docs.vapi.ai/server-url/events: the list is message.toolCallList.
const call = (id, name, args) => ({ id, type: "function", function: { name, arguments: args } });

test("reads toolCallList, the field VAPI documents", async () => {
  const body = await postVapi({ type: "tool-calls", call: {}, toolCallList: [call("call-a", "check_availability", {})] });
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].toolCallId, "call-a");
  assert.doesNotMatch(body.results[0].result, /unknown tool/);
});

test("answers every call in a request that carries two, each by its own id", async () => {
  const body = await postVapi({
    type: "tool-calls",
    call: {},
    toolCallList: [call("call-a", "check_availability", {}), call("call-b", "check_availability", '{"day":"Tue"}')],
  });
  assert.deepEqual(body.results.map((r) => r.toolCallId), ["call-a", "call-b"]);
  for (const r of body.results) assert.doesNotMatch(r.result, /unknown tool/);
});

test("still reads toolCalls when toolCallList is absent", async () => {
  const body = await postVapi({ type: "tool-calls", toolCalls: [call("call-c", "check_availability", {})] });
  assert.equal(body.results[0].toolCallId, "call-c");
  assert.doesNotMatch(body.results[0].result, /unknown tool/);
});

test("an undeclared tool name gets an error result, not silence", async () => {
  const body = await postVapi({ type: "tool-calls", toolCallList: [call("call-d", "no_such_tool", {})] });
  assert.equal(body.results[0].toolCallId, "call-d");
  assert.match(body.results[0].result, /unknown tool: no_such_tool/);
});

test("an empty toolCallList does not hide the calls in toolCalls", async () => {
  const body = await postVapi({ type: "tool-calls", toolCallList: [], toolCalls: [call("call-e", "check_availability", {})] });
  assert.deepEqual(body.results.map((r) => r.toolCallId), ["call-e"]);
});
