"""
Build a YCloud-based duplicate of the Twilio hotel WhatsApp workflow.

Changes from original (fOG5K4vIB48WsoVA):
  1. Twilio Webhook        → path: ycloud-whatsapp-oscar
  2. WhatsApp Parser Lab   → YCloud payload format
  3. Send WhatsApp         → HTTP Request to YCloud API (Twilio removed)
  4. Manager Escalation    → HTTP Request to YCloud API (Twilio removed)

Original workflow is NOT modified. This creates a new workflow.

Usage:
  python build_ycloud_workflow.py

Edit the two PLACEHOLDERs before activating:
  YCLOUD_API_KEY_HERE    → your YCloud API key (Settings → API Keys)
  OSCAR_PHONE_PLACEHOLDER → Oscar's hotel WhatsApp number e.g. +5112345678
"""

import json, copy, urllib.request, urllib.error, os, sys
sys.stdout.reconfigure(encoding="utf-8")

N8N_HOST = "https://gonzaloleiva22.app.n8n.cloud"
N8N_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwYTZhMDlmZS1hODRmLTQ3YjctOTllYy0zNjU3NjgzYjc5YmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1OTI5NDA4fQ.JurRzVWMtwRXalRtaBmszNHAKCqjGCkdCZKgE-P64_U"
ORIGINAL_WF_ID = "fOG5K4vIB48WsoVA"

def n8n_get(path):
    req = urllib.request.Request(
        f"{N8N_HOST}/api/v1{path}",
        headers={"X-N8N-API-KEY": N8N_KEY}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def n8n_post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{N8N_HOST}/api/v1{path}",
        data=data,
        headers={"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# ── Fetch original ────────────────────────────────────────────────────────────
print(f"Fetching workflow {ORIGINAL_WF_ID}...")
wf = n8n_get(f"/workflows/{ORIGINAL_WF_ID}")
print(f"  Got '{wf['name']}' — {len(wf['nodes'])} nodes")

nodes = copy.deepcopy(wf["nodes"])

for node in nodes:
    name = node["name"]

    # 1. Webhook path
    if name == "Twilio Webhook":
        node["parameters"]["path"] = "ycloud-whatsapp-oscar"
        print(f"  [1] Webhook path → ycloud-whatsapp-oscar")

    # 2. Parser: YCloud payload format
    elif name == "WhatsApp Parser Lab":
        for field in node["parameters"]["values"]["string"]:
            if field["name"] == "user_message":
                field["value"] = "={{ $json.data.whatsappInboundMessage.text.body || '' }}"
            elif field["name"] == "contact_id":
                field["value"] = "={{ $json.data.whatsappInboundMessage.from || '' }}"
        print(f"  [2] Parser → YCloud payload format")

    # 3. Send WhatsApp: Twilio → YCloud HTTP Request
    elif name == "Send WhatsApp":
        node["type"] = "n8n-nodes-base.httpRequest"
        node["typeVersion"] = 4.2
        node["parameters"] = {
            "method": "POST",
            "url": "https://api.ycloud.com/v2/whatsapp/messages",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "X-API-Key", "value": "YCLOUD_API_KEY_HERE"}
                ]
            },
            "sendBody": True,
            "contentType": "json",
            "body": (
                "={{ JSON.stringify({"
                " from: 'OSCAR_PHONE_PLACEHOLDER',"
                " to: ($('WhatsApp Parser Lab').item.json.contact_id || $json.contact_id),"
                " type: 'text',"
                " text: { body: $json.output }"
                " }) }}"
            ),
            "options": {}
        }
        print(f"  [3] Send WhatsApp → YCloud HTTP Request")

    # 4. Manager Escalation: Twilio → YCloud HTTP Request
    elif name == "Manager Escalation Alert":
        node["type"] = "n8n-nodes-base.httpRequest"
        node["typeVersion"] = 4.2
        node["parameters"] = {
            "method": "POST",
            "url": "https://api.ycloud.com/v2/whatsapp/messages",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "X-API-Key", "value": "YCLOUD_API_KEY_HERE"}
                ]
            },
            "sendBody": True,
            "contentType": "json",
            "body": (
                "={{ JSON.stringify({"
                " from: 'OSCAR_PHONE_PLACEHOLDER',"
                " to: '+61413428714',"
                " type: 'text',"
                " text: { body: $json.manager_alert }"
                " }) }}"
            ),
            "options": {}
        }
        print(f"  [4] Manager Escalation → YCloud HTTP Request")

new_wf = {
    "name": "Hotel WhatsApp — YCloud (Oscar)",
    "nodes": nodes,
    "connections": wf["connections"],
    "settings": wf["settings"]
}

# Save locally before posting
out_path = os.path.join(os.path.dirname(__file__), "ycloud_workflow.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(new_wf, f, ensure_ascii=False, indent=2)
print(f"\nSaved to {out_path}")

# POST to n8n
print("\nCreating new workflow in n8n...")
result = n8n_post("/workflows", new_wf)
print(f"  Created! ID = {result['id']}")
print(f"  Name = {result['name']}")
print(f"  Edit URL: {N8N_HOST}/workflow/{result['id']}")
print()
print("Next steps:")
print("  1. Open the workflow in n8n")
print("  2. Replace YCLOUD_API_KEY_HERE with your actual YCloud API key")
print("  3. Replace OSCAR_PHONE_PLACEHOLDER with Oscar's hotel number (e.g. +5112345678)")
print("  4. Activate when Oscar completes Embedded Signup")
