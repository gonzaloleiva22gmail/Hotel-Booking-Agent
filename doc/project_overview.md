# Hotel Booking Reservation Automation — Project Overview

> Structured handoff document for AI system continuity.

---

## 1. Project Purpose

A fully automated hotel reservation system for a **Peruvian hotel** that:
- Accepts guest booking requests via **WhatsApp** (Twilio Sandbox)
- Uses an AI Agent to conduct a multi-turn Spanish conversation, collect booking details, and confirm reservations
- Writes confirmed bookings directly to **Airtable**
- Optionally handles **voice calls** via Vapi
- Syncs reservation data to **Google Sheets** as a secondary dashboard

---

## 2. Skills Configured (.agent/skills/)

| Skill | Purpose |
|---|---|
| `n8n-autonomous-debug-loop` | Debug loop: trigger webhook → read execution log → apply MCP patch → re-test. Strictly no UI interaction. |
| `conversational-state-validator` | Audit intent classification and memory node isolation. Read-only, no workflow modifications. |

---

## 3. Current Integrations

### n8n Cloud
- **Instance:** `https://gonzaloleiva22.app.n8n.cloud`
- **API Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (stored in scripts)
- **Primary Workflow:** `Hotel Booking Reservation Automation - Airtable`
  - **Workflow ID:** `NtqV5Ao5QBUwNvEZ`
  - **Status:** Active
  - **Webhook URL:** `https://gonzaloleiva22.app.n8n.cloud/webhook/twilio-inbound`
- **Secondary Workflow (Sheets Sync):** `Hotel Booking Reservation - Airtable to Sheets`
  - **Workflow ID:** `X5LxXDep6JXxzLcc`
  - **Status:** Active

### Airtable
- **Base ID:** `appe9ophN5EpDuPHZ`
- **Credential ID:** `9zB00kyjeufS2QkT` (Airtable Personal Access Token)
- **Tables used:**
  - `Reservations` — booking records written by AI Agent
  - `Tipo de Habitación` — room inventory (read-only)

### Twilio
- **Method:** WhatsApp Sandbox
- **Sandbox Number:** `+14155238886`
- **Webhook configured to POST to:** `/webhook/twilio-inbound`
- **Credential ID:** `tvdY7GXrGwDG1quE`
- **Note:** Sandbox users must join via `join difficulty-but` before messages arrive

### OpenAI
- **Credential ID:** `YcZrjZr6zXnCWerf`
- **Model used (Intent Classifier):** `openai/gpt-4.1-mini` (via n8n OpenAI node)
- **Model used (AI Agent):** `gpt-4.1-mini` (via LangChain Chat Model node)

### Redis (Upstash)
- **Purpose:** Persistent session state per user (`human_mode` / `bot_mode`)
- **Credential ID:** `HeH0gtQL2DHVTg4I` (named "Upstash Global Redis")
- **Key pattern:** `grandview_v2:{{ phone_number }}`
- **Note:** Key prefix was migrated from `grandview:` to `grandview_v2:` for a session reset

### Google Sheets
- **Purpose:** Backup dashboard sync (secondary workflow `X5LxXDep6JXxzLcc`)
- **Credential:** Service account JSON (`groovy-datum-284702-25d0f11508f8.json`)

### Vapi (Voice AI)
- **Webhook path:** `vapi-inbound`
- **Response mode:** `respondToWebhook` node
- **Status:** Configured but secondary — primary channel is WhatsApp

---

## 4. n8n Workflow Node Architecture (Primary Workflow)

```
[Twilio Webhook]  [Vapi Webhook]
       │                 │
       └────────┬────────┘
            [Normalize Input]
            → phone_number, from, user_message
                    │
            [Check State]  ← Redis GET grandview_v2:{phone}
                    │
            [State Router]  ← Switch on value
            ├── human_mode → [Escalation Alert]
            └── bot_mode / null → [Intent Classifier]
                                        │
                                  [Intent Router]
                                  ├── BOOKING → [AI Agent]
                                  └── CONFIRM → [AI Agent]
                                        │
                                  [AI Agent] ← LangChain agent
                                  ├── OpenAI Chat Model
                                  ├── Simple Memory (window buffer, keyed by 'from')
                                  ├── Check_Booked_Rooms (Airtable search tool)
                                  ├── Get_Room_Inventory (Airtable search tool)
                                  └── Booking_Tool (Airtable create tool) ← KEY NODE
                                        │
                                  [Channel Response Router]
                                  ├── Twilio → [Send WhatsApp] + [Sync to Sheets]
                                  └── Vapi   → [Send Vapi Voice]
```

---

## 5. AI Agent Configuration (Key Node)

- **Type:** `@n8n/n8n-nodes-langchain.agent` v3
- **System Message (Spanish):**
  > "Eres un asistente de reservas para un hotel en Perú. Si el usuario confirma (dice 'si', 'ok', 'adelante'), DEBES llamar a 'Booking_Tool'. Datos obligatorios: Guest_Name, Check_In (YYYY-MM-DD), Check_Out (YYYY-MM-DD), Room_Type. Extrae los datos del historial y llama a 'Booking_Tool' DE INMEDIATO tras la confirmación."
- **Memory:** Simple Window Buffer Memory — session keyed by `from` (phone number), `contextWindowLength: 6`

### Booking_Tool (Current State)
- **Type:** `n8n-nodes-base.airtableTool` (native Airtable Tool, NOT custom JS)
- **Operation:** `create`
- **Base:** `appe9ophN5EpDuPHZ`
- **Table:** `Reservations`
- **Field mapping:** Uses `$fromAI()` expressions for all fields

---

## 6. Environment Variables / Credentials

There is **no `.env` file** — all credentials are stored inside n8n's credential vault.

| Service | Credential Name | n8n Credential ID |
|---|---|---|
| OpenAI | OpenAi account | `YcZrjZr6zXnCWerf` |
| Airtable | Airtable Personal Access Token account | `9zB00kyjeufS2QkT` |
| Twilio | Twilio account | `tvdY7GXrGwDG1quE` |
| Redis (Upstash) | Upstash Global Redis | `HeH0gtQL2DHVTg4I` |
| Google Sheets | (Service Account) | `cTs8Rs44PevT2afR` |

Scripts in the local folder use the n8n API key directly (not secure for production — should be moved to env vars).

---

## 7. Frontend Frameworks

**None.** This is a pure backend automation project. There is no frontend, no React/Next.js, no UI layer. All interaction happens via WhatsApp messages.

---

## 8. Deployment Configuration

**No Vercel/Netlify/Docker.** The system is deployed entirely on:
- **n8n Cloud** (SaaS) — workflow execution engine
- **Upstash** (SaaS) — serverless Redis for session state
- **Airtable** (SaaS) — database
- **Twilio** (SaaS) — WhatsApp messaging

The local repo folder is a **utility/scripting workspace** only — it contains Node.js scripts for programmatic workflow management via the n8n REST API.

---

## 9. Project Folder Structure

```
c:\repo\Hotel Clinics Agents\Hotel Reservation Automation\
│
├── .agent/
│   └── skills/
│       ├── n8n-autonomous-debug-loop/SKILL.md
│       └── conversational-state-validator/SKILL.md
│
├── node_modules/          ← npm dependencies (axios, n8n-mcp)
├── package.json           ← { "dependencies": { "n8n-mcp": "^2.35.5" } }
│
├── workflow_inspect.json  ← Last saved snapshot of primary workflow (NtqV5Ao5QBUwNvEZ)
├── room_types_inventory.csv
├── airtable_ready_export.csv
│
├── execution_*.json       ← Execution logs saved for debugging (700KB–3MB each)
├── log_*.txt              ← UTF-8 encoded execution text logs
│
├── rebuild_and_activate.js   ← LATEST: Replaces Booking_Tool + reactivates workflow
├── fix_and_activate.js
├── force_fresh_session.js    ← Migrates Redis key prefix for session reset
├── surgical_reset_v4.js
├── patch_*.js             ← Historical patch scripts (workflow updates)
├── update_workflow_phase*.js ← Phase-based workflow rebuild scripts
└── *.py                   ← Python utilities (Google Sheets extraction, debug)
```

---

## 10. APIs Currently Used

| API | Purpose | Auth Method |
|---|---|---|
| n8n REST API v1 | Read/write/activate workflows | Bearer API Key in header |
| Airtable REST API | Create/search reservation records | PAT Bearer token |
| OpenAI API | Intent classification + AI Agent LLM | API Key (via n8n credential) |
| Twilio API | Send WhatsApp messages | Account SID + Auth Token (via n8n) |
| Redis REST API (Upstash) | Read/write session state | Redis protocol (via n8n) |
| Google Sheets API | Sync booking data to spreadsheet | Service account JSON |

---

## 11. Constraints & Conventions

| Convention | Detail |
|---|---|
| **Language** | All guest-facing content in **Spanish** |
| **Session keying** | Redis key: `grandview_v2:{phone_number}` (phone stripped of `whatsapp:` prefix) |
| **n8n API caveat** | Every `PUT` to update a workflow **auto-deactivates** it — always call `/activate` immediately after |
| **No UI edits** | All workflow changes must be made via the n8n REST API, never via the canvas UI |
| **Intent values** | `BOOKING`, `CONFIRM`, `CANCEL`, `FAQ`, `ESCALATE` (exact strings, uppercase) |
| **Date format** | All Airtable dates must be `YYYY-MM-DD` |
| **Tool naming** | n8n tool node names must be alphanumeric + underscores only (no spaces) |
| **Scripting language** | All automation scripts use **Node.js** with `axios` |
| **No sub-workflow calling** | The `@n8n/n8n-nodes-langchain.toolWorkflow` node has known validation issues — use native `airtableTool` instead |
