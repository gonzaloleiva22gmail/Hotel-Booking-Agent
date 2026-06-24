# n8n Supabase Credential Setup

`update_live_n8n_supabase.mjs` now expects the live n8n workflows to read the
Supabase service-role token from an n8n credential reference instead of
embedding the secret directly into workflow JSON.

## Required root `.env` entries

Add these keys to `C:\repo\Hotel Clinics Agents\Hotel Reservation Automation\.env`:

```text
SUPABASE_N8N_CREDENTIAL_TYPE=httpHeaderAuth
SUPABASE_N8N_CREDENTIAL_ID=<n8n credential id>
SUPABASE_N8N_CREDENTIAL_NAME=<n8n credential display name>
```

## Expected n8n credential

Create or reuse an n8n credential that stores the Supabase service-role key.

- Recommended type: `httpHeaderAuth`
- Credential value: the Supabase `service_role` token
- Purpose: attached to the Supabase-backed Code/Tool nodes so they can call
  Supabase REST without storing the secret in workflow code

## Current script behavior

When those env vars are present, `update_live_n8n_supabase.mjs` will:

1. fetch each of the five live hotel workflows
2. preserve local backup artifacts under `doc/backups`
3. generate redacted patch JSON under `doc/backups/generated-supabase-patches`
4. attach the configured n8n credential reference to the Supabase-backed nodes
5. update the live workflows without embedding the raw service-role key
