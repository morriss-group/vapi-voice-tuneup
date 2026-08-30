# Contributing

This kit exists because production scars are more useful than documentation
theater. Contributions are welcome under the same rule: **we only publish
what someone has run against real phone calls.**

## What we want most
- **Platform adapters** (Retell, Bland, Synthflow…): your platform's
  equivalent of `base-config.json` + an apply script, with a note on what
  you run in production and what the settings fixed. This is the #1 ask.
- **Corrections from the field**: a setting that's changed, a default VAPI
  fixed, a latency trick we missed — with how you verified it.
- **Deploy-guide improvements** for hosts other than Railway.

## Ground rules
1. **Tested-in-production or clearly marked otherwise.** "Should work" goes
   in an issue, not the guide.
2. **No secrets, ever** — no API keys, assistant IDs, phone numbers, or
   client names in any file or example.
3. Keep the voice: plain language, short sentences, say what broke and
   what fixed it. This kit is written for busy operators, not conference
   talks.
4. Small PRs beat big ones. One fix per PR where possible.

## How
Fork → branch → PR with a description of what you run in production and
how you verified the change. Questions or ideas → open an Issue.

Maintained by The Morriss Group. Be kind; everyone here also has a real
business to run.
