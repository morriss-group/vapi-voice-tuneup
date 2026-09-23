# Start here — for business owners, not programmers

**Never used GitHub, or not sure what "open source" means for you?** Read [How this works, and what to click](https://morriss-group.github.io/ai-for-appliance-repair/how-this-works) first: what this site is, what a repository is, why nothing updates by itself, and the exact taps on a phone to get an email when a fix is posted.

If you landed here because someone said "an AI can answer your phone and
book jobs," and the rest of this site looked like a foreign language —
this page is for you. No jargon. Read it in five minutes and you'll know
whether this is worth your time.

---

## What is this, in plain English?

You get a **phone number that answers itself.** A caller says their washer
is leaking. The AI asks what's wrong, gets their address, checks whether
you cover that area, looks at your real calendar, offers actual open
windows, and books the appointment. You find out when it lands on your
schedule.

It talks. It's not a phone tree. Nobody presses 1 for service.

This site is the collection of **settings and fixes** that make one of
those sound like a person instead of a robot — earned on a real appliance
repair line taking real customer calls, not in a demo.

## What it actually does for a one-truck shop

The problem it solves isn't "I hate answering the phone." It's this:
**you can't answer with your hands inside a machine.** Those calls go to
voicemail, and a good chunk of them just call the next guy.

- Answers at 9 PM, on Sundays, and while you're on your back behind a dryer
- Books straight onto your calendar — no callback, no phone tag
- Knows your rules: brands you won't touch, areas you won't drive, who you
  refer out to
- Recognizes repeat customers by their number
- Never gets tired, rude, or overwhelmed on a bad day

**It is not a replacement for you.** It's a replacement for voicemail.

## What it costs — honestly

**It is not one subscription. These are the meters,** and their prices change, so this page names them and sends you to each one's pricing page instead of quoting a number that will be wrong by the time you read it:

- **The voice service (VAPI):** billed per minute of call; by default that minute includes the model and the voice, so you do not need separate model or voice accounts to start.
- **The phone number (Twilio):** a small monthly charge for the number plus per-minute call charges.
- **Hosting for the tools server (Railway or similar):** a few dollars a month for the small program in `tools-server/`. Only needed once you want the agent to look at a calendar.
- **Your scheduling software's plan that allows API access,** if you want it booking onto your real calendar. Some vendors put that behind their higher tier; check yours before you plan on it.
- **A chat subscription (Claude or similar)** if you also follow the guide's chapters on setting the shop's memory up. Not needed for the phone agent alone.


One warning that belongs with the phone number: **not a VAPI-provided number if your agent will ever transfer a caller to a person.** Those cannot do it, and the failure is silent to the caller and cryptic to you; README fix #9 has the test that showed it. The voice itself (ElevenLabs, Cartesia) is bundled into the VAPI minute unless you pick a voice vendor it does not bundle.

In practice the calls themselves land in the pennies-per-minute range, so a shop taking a normal volume of calls is looking at a modest monthly bill. Check each provider's current pricing page before you commit; these change. The comparison that matters: a human answering service typically costs far more per month, doesn't know your brands, and can't book onto your calendar.

Add whatever it costs you in time to set up. Which brings us to:

## Is this actually for you? (the honest version)

**This is not a no-code product.** There's no app store button. You will
copy settings into a dashboard, and for the booking part, something has to
connect the AI to your calendar software — that's real technical work.

**Do this yourself if:** you're comfortable poking around in software
settings, you've set up your own website or CRM before, and you're willing
to spend a weekend on it and make some test calls.

**Hire someone if:** the words "API key" make you want to close the laptop.
That's a legitimate answer. Hand this site to whoever does your tech and
it'll save them a month of trial and error.

**Skip it entirely if:** you take three calls a week and answer them all.
Don't solve a problem you don't have.

## What you'd need before starting

- A VAPI account (or similar voice platform)
- A phone number you're willing to route — **buy it through Twilio and import
  it, not a Vapi-provided one; Vapi numbers cannot transfer a call to a person**
  (start with a NEW number and test
  it for weeks before touching your real business line — see below)
- Your business rules written down: hours, service area, brands you decline,
  what you charge for a diagnostic
- For real booking: your scheduling software's API access

## ★ The one rule that matters most

**Never point your real business number at a new agent.** Get a second
number, live with it for a few weeks, call it yourself at night, let it
book fake appointments, and listen to every recording. Your phone line is
your income. Earn the trust before you hand it over.

## Never used GitHub before?

This website is just a folder of documents. Nothing to install, no account
needed, nothing to buy. Click a file name to read it. Click the repo name
at the top-left any time to get back to the front page. Files ending in
`.md` are just text documents that display nicely.

If you make a free account, the ⭐ **Star** button at the top bookmarks
this so you can find it again. Not required.

## Where to go next

| You are… | Read |
|---|---|
| Ready to build | [README.md](README.md) — the five fixes, in order of impact |
| Wondering how it fits together | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Actually deploying | [DEPLOY-GUIDE.md](DEPLOY-GUIDE.md) |
| Wanting to test it properly | [TEST-PROTOCOL.md](TEST-PROTOCOL.md) |
| Wanting every call reported to your inbox | [MAKE-WEBHOOK-WALKTHROUGH.md](MAKE-WEBHOOK-WALKTHROUGH.md) — reports, not booking |
| Built yours already and wondering what changed | [CHANGELOG.md](CHANGELOG.md) |
| Handing this to your tech person | Give them the whole link — start with README |

Built by Marc Morriss, Steel City Appliance Repair, Homewood (Birmingham), Alabama —
30 years fixing appliances, and the last year teaching a phone to book them.
