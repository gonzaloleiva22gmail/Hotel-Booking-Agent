import json

# Load the original workflow data
original_path = r"C:\Users\ASUS\.gemini\antigravity\brain\b9a6d767-dbf4-4ca4-b57f-f76cf4bcba9d\.system_generated\steps\15\output.txt"
with open(original_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

original_data = data['data']

# Define nodes to remove
nodes_to_remove = [
    "Twilio Webhook",
    "WhatsApp Parser Lab",
    "Send WhatsApp",
    "Sync to Sheets"
]

# Filter nodes
new_nodes = []
filtered_node_names = []

for node in original_data['nodes']:
    if node['name'] not in nodes_to_remove:
        # Clean up node for addNode operation (remove id if you want fresh ones, but keep name)
        # Actually n8n might need temporary IDs or just names.
        # Let's keep the names and remove the IDs to avoid conflicts.
        clean_node = {
            "name": node['name'],
            "type": node['type'],
            "typeVersion": node['typeVersion'],
            "position": node['position'],
            "parameters": node['parameters']
        }
        if 'credentials' in node:
            clean_node['credentials'] = node['credentials']
        
        # Update Speech Filter expression
        if clean_node['name'] == "Speech Filter":
            clean_node['parameters']['output'] = "={{ $json.event_type === 'model-request' && $json.user_message && $json.user_message.trim().length > 0 ? 1 : 0 }}"
            clean_node['parameters']['mode'] = 'expression'
        
        new_nodes.append(clean_node)
        filtered_node_names.append(node['name'])

# Build operations
operations = []

# First, add cleanNode operations for remaining nodes (except Vapi Webhook which exists)
# Wait, I already created the workflow with Vapi Webhook.
# To be safe, I'll just use update_full_workflow with the CLEAN nodes.

# Let's try update_full_workflow again with clean names and connections.
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

# Create final payload
final_payload = {
    "nodes": new_nodes,
    "connections": new_connections
}

# Write out the JSON
output_path = r"c:\repo\Hotel Clinics Agents\Hotel Reservation Automation\final_payload.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(final_payload, f, indent=2)

print(f"Final payload generated at {output_path}")
