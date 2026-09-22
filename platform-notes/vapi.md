# VAPI field notes — things the docs made us find the hard way

Earned on a production line, September 2026. Same rule as the Retell notes: nothing here is speculation; each item was either read in the OpenAPI spec at `https://api.vapi.ai/api-json` or hit on a real call.

## Measuring pauses: use the call record, not the transcript

Every call record carries `artifact.performanceMetrics.turnLatencies`, one entry per agent turn:

```
{ "turnLatency": 3553, "modelLatency": 1221, "voiceLatency": 0,
  "transcriberLatency": 0, "endpointingLatency": 454 }   // milliseconds
```

Sum the four pieces and compare to `turnLatency`; the remainder is plumbing and, on lookup turns, the second model pass. A `voiceLatency` of 0 usually marks a turn where the first thing the caller heard was the tool's pre-recorded "one sec" message. Gaps measured off transcript timestamps are a proxy; this is the instrument. `latency/measure-latency.py` reads it.

## Bot lines in the transcript are the agent's audio, transcribed

Unless `modelOutputInMessagesEnabled` is on, the `bot` messages in `artifact.messages` are the transcriber's rendering of the agent's own speech. With Deepgram's `numerals` on, "September twenty-second" comes back as "September 20 second." That is not what the caller heard. Read model output, not transcription, when you are judging wording.

## Test a prompt before you deploy it

`POST https://api.vapi.ai/chat` with `assistantId`, `input`, and `assistantOverrides` (`model.messages` for a replacement system prompt, `model.toolIds` for a different tool set) runs the candidate against the real tools without changing the live assistant. Chain turns with `previousChatId`. Tool `request-start` messages show up in the output as their own assistant lines, so you can see what the caller would hear. Use a dummy phone number: a real one matches a real customer's record.

## PATCH replaces whole objects

`PATCH /assistant/{id}` with `model` replaces the entire model object. Send the full object from a snapshot with the one field changed, or you will drop `toolIds`, `maxTokens`, and the temperature. Same for `transcriber` and `voice`. Snapshot before every change; `snapshot-assistant.sh` in this repo.

## Transcriber fallback

```
"transcriber": { "provider": "deepgram", "model": "nova-3", "language": "en",
  "fallbackPlan": { "autoFallback": { "enabled": true },
    "transcribers": [ { "provider": "assembly-ai", "speechModel": "universal-streaming-english", "language": "en" } ] } }
```

Per the docs, fallback fires on a provider *failure*. A slow transcriber is not a failure; nothing here helps a 9-second finalization.

## Tool completion messages can replace the second model pass

From the spec, `ToolMessageComplete.type`: *"If this message is not provided, the model will be requested to respond. If this message is provided, only this message will be spoken and the model will not be requested to respond."* `role` defaults to assistant (spoken); `role: system` passes the content to the model instead. `ApiRequestTool.variableExtractionPlan` exposes response fields as `{{ name }}` during the call and stores them in `call.artifact.variableValues`. Whether a `request-complete` content of `{{speakable}}` renders on a real call is unverified as of 2026-09-22: in chat mode it was spoken literally. Test on a call before relying on it.

## Endpointing: what the wait function's `x` means

Per the speech-configuration docs, in the LiveKit smart endpointing plan `x` is the model's probability that the caller is still speaking, and the function returns milliseconds to wait. The default is `200 + 8000 * x`. Any constant you add is paid on every turn, including when the caller has plainly stopped. `startSpeakingPlan.waitSeconds` (default 0.4) is a separate wait on top.

## Two settings with default values you never see

`startSpeakingPlan.waitSeconds` defaults to 0.4 s and `voice.chunkPlan.minCharacters` defaults to 30; neither appears in a GET until you set them. Both are on every turn.
