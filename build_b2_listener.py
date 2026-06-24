"""
Build the B2 n8n Listener workflow — catches YCloud Embedded Signup completion webhooks.

When a client (Oscar, Marjorie, etc.) completes the YCloud Embedded Signup flow,
YCloud fires a POST webhook containing their WABA ID and Phone Number ID.
This workflow receives that payload, extracts the key fields, and sends
a notification to Gonzalo so he knows the client is live.

Workflow: YCloud Webhook → Extract Fields → Respond 200 → Notify Gonzalo

Usage:
  python build_b2_listener.py
"""

import json, urllib.request, urllib.error, sys
sys.stdout.reconfigure(encoding="utf-8")

N8N_HOST = "https://gonzaloleiva22.app.n8n.cloud"
N8N_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwYTZhMDlmZS1hODRmLTQ3YjctOTllYy0zNjU3NjgzYjc5YmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc1OTI5NDA4fQ.JurRzVWMtwRXalRtaBmszNHAKCqjGCkdCZKgE-P64_U"


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


# ── Node definitions ──────────────────────────────────────────────────────────

webhook_node = {
    "id": "b2-webhook-001",
    "name": "YCloud Embedded Signup Listener",
    "type": "n8n-nodes-base.webhook",
    "typeVersion": 2,
    "position": [240, 300],
    "webhookId": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
    "parameters": {
        "httpMethod": "POST",
        "path": "ycloud-embedded-signup-listener",
        "responseMode": "onReceived",
        "responseData": "allEntries"
    }
}

extract_node = {
    "id": "b2-extract-001",
    "name": "Extract Client Data",
    "type": "n8n-nodes-base.set",
    "typeVersion": 3.4,
    "position": [460, 300],
    "parameters": {
        "mode": "manual",
        "fields": {
            "values": [
                {
                    "name": "waba_id",
                    "type": "string",
                    "value": "={{ $json.body.wabaId || $json.body.waba_id || $json.body.businessId || 'NOT_FOUND' }}"
                },
                {
                    "name": "phone_number_id",
                    "type": "string",
                    "value": "={{ $json.body.phoneNumberId || $json.body.phone_number_id || 'NOT_FOUND' }}"
                },
                {
                    "name": "phone_number",
                    "type": "string",
                    "value": "={{ $json.body.phoneNumber || $json.body.phone_number || $json.body.displayPhoneNumber || 'NOT_FOUND' }}"
                },
                {
                    "name": "business_name",
                    "type": "string",
                    "value": "={{ $json.body.businessName || $json.body.business_name || $json.body.name || 'NOT_FOUND' }}"
                },
                {
                    "name": "event_type",
                    "type": "string",
                    "value": "={{ $json.body.type || $json.body.event || 'embedded_signup_complete' }}"
                },
                {
                    "name": "raw_payload",
                    "type": "string",
                    "value": "={{ JSON.stringify($json.body) }}"
                }
            ]
        }
    }
}

notify_node = {
    "id": "b2-notify-001",
    "name": "Notify Gonzalo",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [680, 300],
    "parameters": {
        "method": "POST",
        "url": "https://api.ycloud.com/v2/whatsapp/messages",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "X-API-Key", "value": "f83c09b93b0654160eb0f3909a91005e"}
            ]
        },
        "sendBody": True,
        "contentType": "json",
        "body": (
            "={{ JSON.stringify({"
            " from: 'ACELERAIA_WHATSAPP_NUMBER',"
            " to: '+61413428714',"
            " type: 'text',"
            " text: { body:"
            "  '✅ New client onboarded!\\n'"
            "  + 'Business: ' + $json.business_name + '\\n'"
            "  + 'Phone: ' + $json.phone_number + '\\n'"
            "  + 'WABA ID: ' + $json.waba_id + '\\n'"
            "  + 'Phone Number ID: ' + $json.phone_number_id"
            " }"
            "}) }}"
        ),
        "options": {}
    }
}

# ── Connections ───────────────────────────────────────────────────────────────

connections = {
    "YCloud Embedded Signup Listener": {
        "main": [[{"node": "Extract Client Data", "type": "main", "index": 0}]]
    },
    "Extract Client Data": {
        "main": [[{"node": "Notify Gonzalo", "type": "main", "index": 0}]]
    }
}

# ── Assemble workflow ─────────────────────────────────────────────────────────

workflow = {
    "name": "B2 — YCloud Embedded Signup Listener",
    "nodes": [webhook_node, extract_node, notify_node],
    "connections": connections,
    "settings": {
        "executionOrder": "v1"
    }
}

# Save locally
import os
out_path = os.path.join(os.path.dirname(__file__), "b2_listener_workflow.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(workflow, f, ensure_ascii=False, indent=2)
print(f"Saved to {out_path}")

# POST to n8n
print("\nCreating B2 Listener workflow in n8n...")
result = n8n_post("/workflows", workflow)
print(f"  Created! ID = {result['id']}")
print(f"  Name = {result['name']}")
print(f"  Edit URL: {N8N_HOST}/workflow/{result['id']}")
print()
print("Webhook URL (give this to YCloud as the Embedded Signup callback):")
print(f"  {N8N_HOST}/webhook/ycloud-embedded-signup-listener")
print()
print("Next steps:")
print("  1. Open the workflow in n8n and activate it")
print("  2. Replace ACELERAIA_WHATSAPP_NUMBER in Notify Gonzalo node with AceleraIA's own WhatsApp number")
print("  3. Paste the webhook URL into YCloud's Embedded Signup callback settings")
print("  4. Test by sending a mock POST to the webhook URL")
