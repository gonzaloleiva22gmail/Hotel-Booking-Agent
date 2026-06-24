import json
import os

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
# Also keep track of filtered node names to clean up connections
filtered_node_names = []

for node in original_data['nodes']:
    if node['name'] not in nodes_to_remove:
        # Update Speech Filter expression
        if node['name'] == "Speech Filter":
            node['parameters']['output'] = "={{ $json.event_type === 'model-request' && $json.user_message && $json.user_message.trim().length > 0 ? 1 : 0 }}"
            node['parameters']['mode'] = 'expression'
        new_nodes.append(node)
        filtered_node_names.append(node['name'])

# Filter connections
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
new_workflow = {
    "name": "Hotel Booking Reservation Automation - VAPI",
    "nodes": new_nodes,
    "connections": new_connections,
    "settings": original_data.get("settings", {})
}

# Write out the JSON for the tool call
output_path = r"c:\repo\Hotel Clinics Agents\Hotel Reservation Automation\new_workflow.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(new_workflow, f, indent=2)

print(f"Workflow JSON generated successfully at {output_path}")
