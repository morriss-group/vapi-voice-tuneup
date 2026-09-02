#!/bin/bash
# Snapshot the FULL live config of a VAPI assistant — not just the prompt.
# Run it BEFORE and AFTER every change, then compare the two summary lines.
# A count that dropped is something you just deleted without meaning to.
#
# Usage:  VAPI_API_KEY=... ./snapshot-assistant.sh <assistant-id>
# Output: config-snapshots/<id-prefix>-<timestamp>.json  (full config, pretty-printed)
#         plus a 6-line summary of the things that vanish silently.
#
# Why this exists: a PATCH to `transcriber` that didn't resend `keyterm`
# wiped 30+ keyterms on a production line. Town names that had worked for
# weeks stopped landing, and nobody connected it to the change for days.
# The before/after numbers would have shown "keyterms: 69 -> 32" in one glance.
set -e
ID="${1:?usage: snapshot-assistant.sh <assistant-id>}"
: "${VAPI_API_KEY:?set VAPI_API_KEY in the environment}"
mkdir -p config-snapshots
OUT="config-snapshots/${ID:0:8}-$(date +%Y%m%d-%H%M%S).json"
curl -sf -H "Authorization: Bearer $VAPI_API_KEY" "https://api.vapi.ai/assistant/$ID" \
  | python3 -m json.tool > "$OUT"
python3 - "$OUT" << 'PY'
import json, sys
d = json.load(open(sys.argv[1]))
m = d.get('model') or {}
t = d.get('transcriber') or {}
print("SNAPSHOT:", sys.argv[1])
print("  prompt chars :", sum(len(x.get('content', '')) for x in (m.get('messages') or [])))
print("  model        :", m.get('provider'), m.get('model'), "| temp", m.get('temperature'), "| maxTokens", m.get('maxTokens'))
print("  toolIds      :", len(m.get('toolIds') or []))
print("  keyterms     :", len(t.get('keyterm') or []))
print("  transcriber  :", t.get('provider'), t.get('model'))
print("  voice        :", (d.get('voice') or {}).get('provider'), (d.get('voice') or {}).get('voiceId'))
PY
# Compare two snapshots later with:  diff <(python3 -m json.tool A.json) <(python3 -m json.tool B.json)
