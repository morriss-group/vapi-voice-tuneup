# Security

- **Reporting:** if you find a secret, a customer's data, or a way to make the tools server do something it should not, open an issue at [github.com/morriss-group/vapi-voice-tuneup/issues](https://github.com/morriss-group/vapi-voice-tuneup/issues) with the file and line and no values. Same-day reply.
- **What the tools server protects:** every request to `/vapi` must carry the shared secret; a deploy with no secret configured refuses everything rather than letting everything through (`tools-server/server.js`, `requireSecret`). `GET /status` reports whether the secret is configured and never its value.
- **History note (September 3, 2026):** commit `0658ed8` removed `latency/` because it held the shop's own identifiers: assistant and phone-number IDs. No customer data, no credentials. The file stays in git history on purpose; rewriting history would break the release tags builders watch.
- **What is never in this repository:** live credentials, the shop's system prompt, customer names or numbers. The tuning logs replace real surnames with placeholders.
