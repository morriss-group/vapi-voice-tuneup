# Every call, reported to you — the Make.com webhook, click by click

This is Layer 3 of the deploy guide done slowly: when a call ends, VAPI sends a report (caller number, summary, full transcript, recording link) to a Make.com scenario, and Make puts it wherever you actually look. Thirty minutes the first time. No code.

You'll switch between two browser tabs: **Make.com** and the **VAPI dashboard**. Button names below are current as of September 2026; if one has drifted, look for the nearest thing that means the same.

---

## Part 1 — Make: create the scenario and get your webhook address

1. Go to make.com and sign in. (Free tier is enough for a few hundred calls a month.)
2. Left sidebar, click **Scenarios**.
3. Top right, click the purple **Create a new scenario** button. You land on an empty canvas with a big **+** in the middle.
4. Click the **+**. A search box opens. Type **webhooks** and click the **Webhooks** app (the one with the hook icon, not "HTTP").
5. Click **Custom webhook**. A module appears on the canvas with a settings panel open on the right.
6. In the panel, next to "Webhook," click **Add**.
7. Name it **VAPI end-of-call** and click **Save**.
8. The panel now shows an address that starts with `https://hook.` and ends in a long random string, with a **Copy address to clipboard** button. Click it. That's your webhook URL. Leave this tab open; Make is now waiting to receive its first message so it can learn the shape of the data.

## Part 2 — VAPI: point the assistant at that address

9. New tab: dashboard.vapi.ai, sign in, click **Assistants** in the left sidebar, and click your assistant.
10. Along the top of the assistant page, click the **Advanced** tab (on some layouts it's a gear icon, or the section is called "Messaging").
11. Find **Server URL**. Paste the Make address into it.
12. Just below, find **Server Messages** (a list of checkboxes). Check **end-of-call-report**. Leave the others unchecked for now; each one you add is another message Make has to handle.
13. Now click the **Analysis** tab at the top of the assistant page.
14. Turn on **Summary**. Leave the default summary prompt, or replace it with one line: *"Summarize this call in three sentences for the business owner: who called, what they wanted, what happened."*
15. Click **Publish** (top right). Nothing reaches Make until you publish.

## Part 3 — Make: teach it what a report looks like

16. Back in the Make tab. In the webhook panel, click **Redetermine data structure** if you see it; otherwise Make is already saying "Waiting for data" under the module.
17. Call your own agent from your phone. Say anything, let it answer once, hang up.
18. Within about 30 seconds the Make module shows **Successfully determined**. It has now seen a real report and knows every field in it. If it still says waiting after two minutes: go back to step 11 and check the address has no spaces at either end, and that you clicked Publish.

## Part 4 — Make: send the report somewhere you'll see it

Pick one. Email is the simplest; a spreadsheet is the most useful after a month.

**Email version**

19. On the canvas, hover the right edge of the webhook module and click the **+** that appears.
20. Search **Gmail** and choose **Send an email**. (For Outlook, choose Microsoft 365 Email → Send an email; same idea.)
21. In the panel, click **Add** next to Connection, sign in to the Google account you want to send from, and allow Make. (You are granting Make permission to send mail as you; that's expected here.)
22. **To:** your own address.
23. **Subject:** click into the box. A panel of mapped fields pops up. Type `Call from ` then click **message → call → customer → number** from the pop-up so it lands in the subject.
24. **Content:** build it from the pop-up fields, one per line:
    - **message → analysis → summary**
    - **message → artifact → transcript**
    - **message → recordingUrl**
    - **message → endedReason**
25. Click **OK**.

**Spreadsheet version**

19. Hover the webhook module's right edge, click **+**, search **Google Sheets**, choose **Add a row**.
20. Add the connection, sign in, allow.
21. Pick your spreadsheet and sheet. Make one first with headers: Date, Caller, Summary, Ended, Recording, Transcript.
22. Map each column from the pop-up: **message → startedAt**, **message → call → customer → number**, **message → analysis → summary**, **message → endedReason**, **message → recordingUrl**, **message → artifact → transcript**.
23. Click **OK**.

## Part 5 — Turn it on and prove it

26. Bottom left of the canvas, click **Run once**. Then call your agent again and hang up. Watch the modules light up with a green **1** bubble each. Click the bubble on the email or sheet module to see exactly what was sent.
27. If both bubbles are green: bottom left, flip the **Scheduling** switch to **ON**. Make asks how often to run; choose **Immediately** (it triggers on each report as it arrives). Click **Save** (the floppy-disk icon).
28. Check your inbox or sheet. The report from step 26 is there. From now on every finished call arrives the same way, usually within a minute of hang-up.

---

## When it doesn't work

- **Webhook stuck on "waiting."** Nine times out of ten, the assistant wasn't published after the Server URL change, or the URL was pasted with a trailing space. Once in ten, the call was a test that ended before the assistant spoke, and VAPI skips the report for calls under a second.
- **Green bubble on the webhook, red on the email.** The connection expired. Open the email module, click the connection, re-sign in.
- **Report arrives but the summary is blank.** Analysis → Summary is off, or you published before turning it on. Turn it on, publish again.
- **You get two reports per call.** You checked a second server message (like `status-update`). Uncheck it, publish.
- **You want the caller's name, not just their number.** VAPI only knows the number. The name lives in your booking system; if your agent books through a tools server (Layer 4), have that server write the name into the job notes and send the report from there instead.

## What this doesn't do

It reports; it doesn't alert. If you want a text on your phone the moment a call goes wrong (a caller asked for a human and got dropped, a booking failed), that's a filter step in Make after the webhook: Filters on `message → endedReason` or a keyword in the summary, then an SMS or push module. Add it after the basic report has run cleanly for a week, so you know what normal looks like first.
