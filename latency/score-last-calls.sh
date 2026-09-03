#!/bin/bash
# Score the last N calls on a VAPI assistant from VAPI's own per-turn stage timings.
# Usage: VAPI_API_KEY=... ASSISTANT_ID=... ./score-last-calls.sh [N]   (default 2)
: "${VAPI_API_KEY:?set VAPI_API_KEY}"
N="${1:-2}"
OUT=/tmp/last-calls.json
curl -s -m 40 -H "Authorization: Bearer $VAPI_API_KEY" "https://api.vapi.ai/call?assistantId=${ASSISTANT_ID:?set ASSISTANT_ID}&limit=$N" -o "$OUT"
python3 - "$OUT" <<'PY'
import json,sys,statistics as st
calls=json.load(open(sys.argv[1]))
def med(xs): return st.median(xs) if xs else float('nan')
for c in calls:
    pm=((c.get("artifact") or {}).get("performanceMetrics") or {}); turns=pm.get("turnLatencies") or []
    v=(c.get("costs") or [])
    voice=[x for x in v if x.get("type")=="voice"]; vdesc=(voice[0].get("voice") or {}) if voice else {}
    print(f"\nCALL {c['id'][:8]}  {c.get('startedAt','')[11:19]}Z  ended={c.get('endedReason')}  turns={len(turns)}  voice={vdesc.get('provider')}/{vdesc.get('model')}  cost=${c.get('cost',0):.2f}")
    if not turns: print("   (no turn metrics)"); continue
    print("   turn   endpt  transcr  model  voice  TOTAL")
    for t in turns:
        print(f"   {'':4}  {t.get('endpointingLatency',0):5.0f}  {t.get('transcriberLatency',0):7.0f}  {t.get('modelLatency',0):5.0f}  {t.get('voiceLatency',0):5.0f}  {t.get('turnLatency',0):5.0f}")
    print(f"   MEDIAN {med([t.get('endpointingLatency',0) for t in turns]):5.0f}  {med([t.get('transcriberLatency',0) for t in turns]):7.0f}  {med([t.get('modelLatency',0) for t in turns]):5.0f}  {med([t.get('voiceLatency',0) for t in turns]):5.0f}  {med([t.get('turnLatency',0) for t in turns]):5.0f}   (ms)")
PY
