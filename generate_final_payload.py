import json

# Map of existing node names to their current IDs in n8n (from Step 155)
node_id_map = {
    "Vapi Webhook": "cc27c19b-87a2-4fa9-bf9a-adac84d3dd6c",
    "Voice Parser Lab": "9bdcc656-f617-4af1-869a-1497f218a228",
    "Debug Ingress Monitor": "debug-ingress-monitor-node",
    "Speech Filter": "speech-filter-switch-id",
    "Respond OK (Verified)": "cf12e577-10ad-4f64-955e-fdaf7f6207e9",
    "Check State": "4c1a28a7-bd0a-4df8-85c2-f9c1956689ab",
    "State Router": "03905e3f-0465-4bd1-91eb-09cc46d3be2c",
    "Escalation Alert": "f9d87c2b-2dd7-4986-9022-0af83e144e56",
    "Intent Classifier": "73219488-2396-4453-9600-0a12a4efca9d",
    "Merge Intent Data": "3abe12ae-d49d-4c58-9670-08d581fb6b9e",
    "Intent Router": "c82ce2eb-5b8e-4dfa-9cf7-ec826e8cd060",
    "AI Agent": "35daaebf-b2fb-420c-b757-d9af60728499",
    "CONFIRM Bridge": "8b2b7323-81bf-4188-bef8-b2b3433990b5",
    "Channel Response Router": "3691b8f8-43a1-4697-ab6d-889dc48990bb",
    "Send Vapi Voice": "fe67c542-e150-4c52-8b0d-f0eeeda3078b",
    "OpenAI Chat Model": "82f9f170-cbf6-417c-b1cc-12d98f7adeed"
}

# Original workflow data path
original_path = r"C:\Users\ASUS\.gemini\antigravity\brain\b9a6d767-dbf4-4ca4-b57f-f76cf4bcba9d\.system_generated\steps\15\output.txt"
with open(original_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

original_data = data['data']

nodes_to_remove = ["Twilio Webhook", "WhatsApp Parser Lab", "Send WhatsApp", "Sync to Sheets"]

new_nodes = []
filtered_node_names = []

for node in original_data['nodes']:
    if node['name'] not in nodes_to_remove:
        clean_node = {
            "name": node['name'],
            "type": node['type'],
            "typeVersion": node['typeVersion'],
            "position": node['position'],
            "parameters": node['parameters']
        }
        if 'credentials' in node:
            clean_node['credentials'] = node['credentials']
        
        # Assign existing ID or original ID for new nodes
        if clean_node['name'] in node_id_map:
            clean_node['id'] = node_id_map[clean_node['name']]
        else:
            clean_node['id'] = node['id'] # Use original ID for the 4 nodes not yet added
        
        if clean_node['name'] == "Speech Filter":
            clean_node['parameters']['output'] = "={{ $json.event_type === 'model-request' && $json.user_message && $json.user_message.trim().length > 0 ? 1 : 0 }}"
            clean_node['parameters']['mode'] = 'expression'
        
        new_nodes.append(clean_node)
        filtered_node_names.append(node['name'])

new_connections = {}
original_connections = original_data['connections']

for source_name, source_data in original_connections.items():
    if source_name not in filtered_node_names:
        continue
    
    new_source_data = {}
    for conn_type, index_groups in source_data.items():
        new_index_groups = []
        for index_group in index_groups:
            new_group = [conn for conn in index_group if conn['node'] in filtered_node_names]
            new_index_groups.append(new_group)
        new_source_data[conn_type] = new_index_groups
    
    new_connections[source_name] = new_source_data

final_payload = {
    "nodes": new_nodes,
    "connections": new_connections
}

output_path = r"c:\repo\Hotel Clinics Agents\Hotel Reservation Automation\final_payload_with_ids.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(final_payload, f, indent=2)

print(f"Final payload generated at {output_path}")
