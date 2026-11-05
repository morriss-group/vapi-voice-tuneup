import { test, before, after } from "node:test";
import assert from "node:assert/strict";
process.env.NODE_TEST = "1";
process.env.SHARED_SECRET = "test-only-secret";
const { app, tools } = await import("../server.js");

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
  assert.equal(body.results[0].error, "unknown tool: no_such_tool");
  assert.equal(body.results[0].result, undefined, "error or result, never both");
});

test("an empty toolCallList does not hide the calls in toolCalls", async () => {
  const body = await postVapi({ type: "tool-calls", toolCallList: [], toolCalls: [call("call-e", "check_availability", {})] });
  assert.deepEqual(body.results.map((r) => r.toolCallId), ["call-e"]);
});

test("a tool that throws gets an error result, and the other calls in the request still get theirs", async () => {
  const real = tools.run;
  tools.run = async (name, args) => {
    if (name === "check_availability") throw new Error("calendar down");
    return real(name, args);
  };
  try {
    const body = await postVapi({ type: "tool-calls", toolCallList: [call("call-f", "check_availability", {}), call("call-g", "no_such_tool", {})] });
    assert.deepEqual(body.results.map((r) => r.toolCallId), ["call-f", "call-g"]);
    assert.equal(body.results[0].error, "tool failed: check_availability");
    assert.equal(body.results[1].error, "unknown tool: no_such_tool");
  } finally {
    tools.run = real;
  }
});

test("VAPI's documented example request, verbatim but for the call object, gets one entry for abc123", async () => {
  // docs.vapi.ai/server-url/events, opened 2026-11-05. sendEmail is not a tool here, so it gets an error.
  const body = await postVapi({
    type: "tool-calls",
    call: {},
    toolCallList: [{ id: "abc123", type: "function", function: { name: "sendEmail", arguments: { emailAddress: "john@example.com", message: "Hi!" } } }],
    toolWithToolCallList: [{
      type: "function",
      function: { name: "sendEmail", parameters: {} },
      toolCall: { id: "abc123", type: "function", function: { name: "sendEmail", arguments: { emailAddress: "john@example.com", message: "Hi!" } } },
    }],
  });
  assert.deepEqual(body.results, [{ name: "sendEmail", toolCallId: "abc123", error: "unknown tool: sendEmail" }]);
});

test("a result that cannot be turned into a string, or no result at all, still gets a well-formed entry", async () => {
  const real = tools.run;
  tools.run = async (name) => {
    if (name === "circular") { const o = {}; o.self = o; return o; }
    return undefined;
  };
  const lines = [];
  const saved = console.error;
  console.error = (...a) => lines.push(a.join(" "));
  try {
    const body = await postVapi({ type: "tool-calls", toolCallList: [call("call-h", "circular", {}), call("call-i", "nothing", {})] });
    assert.deepEqual(body.results, [
      { name: "circular", toolCallId: "call-h", error: "tool failed: circular" },
      { name: "nothing", toolCallId: "call-i", result: "null" },
    ]);
  } finally {
    tools.run = real;
    console.error = saved;
  }
  assert.deepEqual(lines, ["tool circular failed (TypeError)"], "the log names the tool and the error type, never the message");
});

test("a body that is not JSON gets a plain 400 with no stack, before the secret is checked", async () => {
  const res = await fetch(`${base}/vapi`, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "bad request" });
});
