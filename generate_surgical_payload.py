
import json

def generate_payload():
    # Base nodes from the recent 'get_workflow' call
    nodes = [
        {
            "id": "cc27c19b-87a2-4fa9-bf9a-adac84d3dd6c",
            "name": "Vapi Webhook",
            "onError": "continueRegularOutput",
            "parameters": {
                "httpMethod": "POST",
                "options": {},
                "path": "vapi-inbound",
                "responseMode": "responseNode"
            },
            "position": [2288, 864],
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2.1
        },
        {
            "id": "9bdcc656-f617-4af1-869a-1497f218a228",
            "name": "Voice Parser Lab",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [2688, 864],
            "parameters": {
                "jsCode": """const safeTrim = (str) => typeof str === 'string' ? str.trim() : '';

const items = $input.all();

for (const item of items) {
  const json = item.json || {};
  const body = json.body || {};

  const messageObj = body.message || json.message || {};
  const messagesBody = messageObj.messages || body.messages || [];

  const artifactObj = messageObj.artifact || json.artifact || body.artifact || {};
  const messagesArtifact = artifactObj.messages || [];

  let extracted_message = '';
  let message_source = 'none';
  let event_type = 'unknown';

  if (messageObj.type) {
    event_type = String(messageObj.type);
  } else if (Array.isArray(messagesBody) && messagesBody.length > 0) {
    event_type = 'model-request';
  }

  if (typeof messageObj.transcript === 'string') {
    const trimmed = safeTrim(messageObj.transcript);
    if (trimmed) {
      extracted_message = trimmed;
      message_source = 'body.message.transcript';
    }
  }

  if (!extracted_message && Array.isArray(messagesBody) && messagesBody.length > 0) {
    for (let i = messagesBody.length - 1; i >= 0; i--) {
      const msg = messagesBody[i];
      if (msg && msg.role === 'user') {
        const content = msg.content || msg.message || msg.text || '';
        const trimmed = safeTrim(typeof content === 'string' ? content : JSON.stringify(content));
        if (trimmed) {
          extracted_message = trimmed;
          message_source = 'body.messages';
          break;
        }
      }
    }
  }

  if (!extracted_message && Array.isArray(messagesArtifact) && messagesArtifact.length > 0) {
    for (let i = messagesArtifact.length - 1; i >= 0; i--) {
      const msg = messagesArtifact[i];
      if (msg && msg.role === 'user') {
        const content = msg.content || msg.message || msg.text || '';
        const trimmed = safeTrim(typeof content === 'string' ? content : JSON.stringify(content));
        if (trimmed) {
          extracted_message = trimmed;
          message_source = 'artifact.messages';
          break;
        }
      }
    }
  }

  if (!extracted_message && typeof json.transcript === 'string') {
    const trimmed = safeTrim(json.transcript);
    if (trimmed) {
      extracted_message = trimmed;
      message_source = 'transcript';
    }
  }

  let contact_id = '51956782817';
  if (messageObj.customer?.number) {
    contact_id = messageObj.customer.number;
  } else if (messageObj.call?.customer?.number) {
    contact_id = messageObj.call.customer.number;
  }

  item.json = {
    ...json,
    user_message: extracted_message,
    contact_id: String(contact_id),
    channel: 'voice',
    event_type,
    message_source,
    raw_body_message_type: messageObj.type ? String(messageObj.type) : 'undefined',
    raw_has_body_messages: Array.isArray(messagesBody) && messagesBody.length > 0,
    raw_has_artifact_messages: Array.isArray(messagesArtifact) && messagesArtifact.length > 0
  };
}

return items;"""
            }
        },
        {
            "id": "debug-ingress-monitor-node",
            "name": "Debug Ingress Monitor",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [2624, 960],
            "parameters": {
                "assignments": {
                    "assignments": [
                        {"id": "a1", "name": "event_type", "type": "string", "value": "={{ $json.event_type }}"},
                        {"id": "a2", "name": "message_source", "type": "string", "value": "={{ $json.message_source }}"},
                        {"id": "a3", "name": "extracted_user_message", "type": "string", "value": "={{ $json.user_message }}"},
                        {"id": "a4", "name": "user_message_length", "type": "number", "value": "={{ $json.user_message ? $json.user_message.length : 0 }}"},
                        {"id": "a5", "name": "contact_id", "type": "string", "value": "={{ $json.contact_id }}"},
                        {"id": "a6", "name": "raw_body_message_type", "type": "string", "value": "={{ $json.raw_body_message_type }}"},
                        {"id": "a7", "name": "raw_has_body_messages", "type": "boolean", "value": "={{ $json.raw_has_body_messages }}"},
                        {"id": "a8", "name": "raw_has_artifact_messages", "type": "boolean", "value": "={{ $json.raw_has_artifact_messages }}"},
                        {"id": "a9", "name": "user_message", "type": "string", "value": "={{ $json.user_message }}"},
                        {"id": "a10", "name": "channel", "type": "string", "value": "={{ $json.channel }}"}
                    ]
                }
            }
        },
        {
            "id": "speech-filter-switch-id",
            "name": "Speech Filter",
            "type": "n8n-nodes-base.switch",
            "typeVersion": 3.4,
            "position": [2592, 1120],
            "parameters": {
                "mode": "expression",
                "output": "={{ $json.event_type === 'model-request' && $json.user_message && $json.user_message.trim().length > 0 ? 1 : 0 }}"
            }
        },
        {
            "id": "cf12e577-10ad-4f64-955e-fdaf7f6207e9",
            "name": "Respond OK (Verified)",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [2640, 1008],
            "parameters": {"options": {}}
        },
        {
            "id": "4c1a28a7-bd0a-4df8-85c2-f9c1956689ab",
            "name": "Check State",
            "type": "n8n-nodes-base.redis",
            "typeVersion": 1,
            "position": [2688, 752],
            "parameters": {},
            "credentials": {"redis": {"id": "HeH0gtQL2DHVTg4I", "name": "Upstash Global Redis"}}
        },
        {
            "id": "03905e3f-0465-4bd1-91eb-09cc46d3be2c",
            "name": "State Router",
            "type": "n8n-nodes-base.switch",
            "typeVersion": 1,
            "position": [2880, 752],
            "parameters": {"fallbackOutput": 1}
        },
        {
            "id": "f9d87c2b-2dd7-4986-9022-0af83e144e56",
            "name": "Escalation Alert",
            "type": "n8n-nodes-base.noOp",
            "typeVersion": 1,
            "position": [3088, 656],
            "parameters": {}
        },
        {
            "id": "73219488-2396-4453-9600-0a12a4efca9d",
            "name": "Intent Classifier",
            "type": "n8n-nodes-base.openAi",
            "typeVersion": 1,
            "position": [3088, 864],
            "parameters": {
                "options": {},
                "prompt": "=Classify the user intent into EXACTLY ONE word in lowercase.\\nCategories:\\n- booking (new reservations, check availability, room price, \\\\\\\"quiero una reserva\\\\\\\")\\n- confirm (affirmations, \\\"yes\\\", \\\"ok\\\", \\\"thanks\\\", \\\"quiero\\\", \\\"ya\\\", \\\"listo\\\", \\\"bueno\\\", \\\"dale\\\", \\\"si\\\")\\n- cancel (no, stop, remove, \\\"no quiero\\\", \\\"cancela\\\")\\n- chat (greetings, \\\"hola\\\", \\\"buenas tardes\\\", \\\"hello\\\", \\\"como estas\\\")\\n\\nUser Message: {{ $json.user_message }}\\n\\nOutput MUST be ONE category word in lowercase:",
                "requestOptions": {}
            },
            "credentials": {"openAiApi": {"id": "YcZrjZr6zXnCWerf", "name": "OpenAi account"}}
        },
        {
            "id": "3abe12ae-d49d-4c58-9670-08d581fb6b9e",
            "name": "Merge Intent Data",
            "type": "n8n-nodes-base.set",
            "typeVersion": 1,
            "position": [3200, 960],
            "parameters": {
                "options": {},
                "values": {
                    "string": [
                        {"name": "intent", "value": "={{ $json.text }}"},
                        {"name": "user_message", "value": "={{ $('Speech Filter').item.json.user_message }}"},
                        {"name": "contact_id", "value": "={{ $('Speech Filter').item.json.contact_id || '51956782817' }}"},
                        {"name": "channel", "value": "={{ $('Speech Filter').item.json.channel }}"}
                    ]
                }
            }
        },
        {
            "id": "c82ce2eb-5b8e-4dfa-9cf7-ec826e8cd060",
            "name": "Intent Router",
            "type": "n8n-nodes-base.switch",
            "typeVersion": 1,
            "position": [3280, 864],
            "parameters": {
                "mode": "expression",
                "output": "={{ $json.intent === 'confirm' ? 1 : (['booking', 'chat'].includes($json.intent) ? 0 : 2) }}"
            }
        },
        {
            "id": "35daaebf-b2fb-420c-b757-d9af60728499",
            "name": "AI Agent",
            "type": "@n8n/n8n-nodes-langchain.agent",
            "typeVersion": 3,
            "position": [3472, 704],
            "parameters": {
                "options": {
                    "systemMessage": "Eres un asistente de reservas para un hotel en Perú.\\nSi el usuario confirma (dice \"si\", \"ok\", \"adelante\"), DEBES llamar a 'Booking_Tool'.\\n\\nDatos obligatorios:\\n- Guest_Name: Nombre del huésped.\\n- Check_In: YYYY-MM-DD.\\n- Check_Out: YYYY-MM-DD.\\n- Room_Type: Tipo de habitación.\\n\\nExtrae los datos del historial y Llama a 'Booking_Tool' DE INMEDIATO tras la confirmación. No respondas texto antes de llamar a la herramienta."
                },
                "promptType": "define",
                "text": "={{ $json.user_message || $('Speech Filter').item.json.user_message }}"
            }
        },
        {
            "id": "8b2b7323-81bf-4188-bef8-b2b3433990b5",
            "name": "CONFIRM Bridge",
            "type": "n8n-nodes-base.noOp",
            "typeVersion": 1,
            "position": [3472, 992],
            "parameters": {}
        },
        {
            "id": "3691b8f8-43a1-4697-ab6d-889dc48990bb",
            "name": "Channel Response Router",
            "type": "n8n-nodes-base.switch",
            "typeVersion": 1,
            "position": [4016, 864],
            "parameters": {
                "mode": "expression",
                "output": "={{ $('Speech Filter').item.json.channel === 'whatsapp' ? 0 : 1 }}"
            }
        },
        {
            "id": "fe67c542-e150-4c52-8b0d-f0eeeda3078b",
            "name": "Send Vapi Voice",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [4208, 960],
            "parameters": {
                "options": {},
                "respondWith": "json",
                "responseBody": "={{ { \"message\": { \"role\": \"assistant\", \"content\": $json.output || \"\" } } }}"
            }
        },
        {
            "id": "82f9f170-cbf6-417c-b1cc-12d98f7adeed",
            "name": "OpenAI Chat Model",
            "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
            "typeVersion": 1.3,
            "position": [3472, 1040],
            "parameters": {
                "builtInTools": {},
                "model": {"__rl": True, "mode": "list", "value": "gpt-4o-mini"},
                "options": {}
            },
            "credentials": {"openAiApi": {"id": "YcZrjZr6zXnCWerf", "name": "OpenAi account"}}
        },
        {
            "id": "07fc9362-0995-46fd-abef-7521e16441b2",
            "name": "Simple Memory",
            "type": "@n8n/n8n-nodes-langchain.memoryBufferWindow",
            "typeVersion": 1.3,
            "position": [3568, 928],
            "parameters": {
                "sessionIdType": "customKey",
                "sessionKey": "={{ $json.contact_id }}_v2"
            }
        },
        {
            "id": "97d6dc42-2051-460d-83f5-7c57f2025ed9",
            "name": "Check_Booked_Rooms",
            "type": "n8n-nodes-base.airtableTool",
            "typeVersion": 2.1,
            "position": [3680, 960],
            "parameters": {
                "base": {"__rl": True, "mode": "list", "value": "appe9ophN5EpDuPHZ"},
                "operation": "search",
                "options": {},
                "table": {"__rl": True, "mode": "list", "value": "Reservations"}
            },
            "credentials": {"airtableTokenApi": {"id": "9zB00kyjeufS2QkT", "name": "Airtable Personal Access Token account"}}
        },
        {
            "id": "648acc3b-b7cf-4a11-a831-294c7764fde8",
            "name": "Get_Room_Inventory",
            "type": "n8n-nodes-base.airtableTool",
            "typeVersion": 2.1,
            "position": [3680, 1120],
            "parameters": {
                "base": {"__rl": True, "mode": "list", "value": "appe9ophN5EpDuPHZ"},
                "operation": "search",
                "options": {},
                "table": {"__rl": True, "mode": "list", "value": "Tipo de Habitaci\\u00f3n"}
            },
            "credentials": {"airtableTokenApi": {"id": "9zB00kyjeufS2QkT", "name": "Airtable Personal Access Token account"}}
        },
        {
            "id": "8f6ed625-7892-4a7b-a459-a5cabd6b7713",
            "name": "Booking_Tool",
            "type": "n8n-nodes-base.airtableTool",
            "typeVersion": 2.1,
            "position": [3808, 864],
            "parameters": {
                "base": {"__rl": True, "mode": "list", "value": "appe9ophN5EpDuPHZ"},
                "columns": {
                    "mappingMode": "defineBelow",
                    "value": {
                        "Check_In": "={{ $json.check_in || $json.checkIn || $json.Check_In }}",
                        "Check_Out": "={{ $json.check_out || $json.checkOut || $json.Check_Out }}",
                        "Guest_Name": "={{ $json.name || $json.guest_name || $json.Guest_Name || 'Unknown Guest' }}",
                        "Notes": "={{ $json.email || $json.notes || $json.Notes }}",
                        "Phone_Number": "={{ $json.contact_id }}",
                        "Room_Type": "={{ $json.room || $json.room_type || $json.Room_Type }}"
                    }
                },
                "operation": "create",
                "options": {},
                "table": {"__rl": True, "mode": "id", "value": "tblcDA6RlfHkEUPBj"}
            },
            "credentials": {"airtableTokenApi": {"id": "9zB00kyjeufS2QkT", "name": "Airtable Personal Access Token account"}}
        }
    ]

    connections = {
        "Vapi Webhook": {"main": [[{"node": "Voice Parser Lab", "type": "main", "index": 0}]]},
        "Voice Parser Lab": {"main": [[{"node": "Debug Ingress Monitor", "type": "main", "index": 0}]]},
        "Debug Ingress Monitor": {"main": [[{"node": "Speech Filter", "type": "main", "index": 0}]]},
        "Speech Filter": {"main": [
            [{"node": "Respond OK (Verified)", "type": "main", "index": 0}],
            [{"node": "Check State", "type": "main", "index": 0}]
        ]},
        "Check State": {"main": [[{"node": "State Router", "type": "main", "index": 0}]]},
        "State Router": {
            "main": [
                [{"node": "Escalation Alert", "type": "main", "index": 0}],
                [{"node": "Intent Classifier", "type": "main", "index": 0}]
            ]
        },
        "Intent Classifier": {"main": [[{"node": "Merge Intent Data", "type": "main", "index": 0}]]},
        "Merge Intent Data": {"main": [[{"node": "Intent Router", "type": "main", "index": 0}]]},
        "Intent Router": {
            "main": [
                [{"node": "AI Agent", "type": "main", "index": 0}],
                [{"node": "CONFIRM Bridge", "type": "main", "index": 0}],
                [{"node": "AI Agent", "type": "main", "index": 0}]
            ]
        },
        "CONFIRM Bridge": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
        "AI Agent": {"main": [[{"node": "Channel Response Router", "type": "main", "index": 0}]]},
        "Channel Response Router": {"main": [[], [{"node": "Send Vapi Voice", "type": "main", "index": 0}]]},
        
        # Specialized AI Connections
        "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
        "Simple Memory": {"ai_memory": [[{"node": "AI Agent", "type": "ai_memory", "index": 0}]]},
        "Check_Booked_Rooms": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
        "Get_Room_Inventory": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
        "Booking_Tool": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]}
    }

    payload = {
        "id": "8C9bFurfYqVYwQKM",
        "nodes": nodes,
        "connections": connections,
        "active": True
    }
    
    with open('surgical_fix_payload.json', 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    generate_payload()
