import json
import os

input_path = r'C:\Users\ASUS\.gemini\antigravity\brain\68206391-927a-4fdf-89bb-8c2ac4a9b3e3\.system_generated\steps\1225\output.txt'
output_path = r'C:\Users\ASUS\.gemini\antigravity\brain\68206391-927a-4fdf-89bb-8c2ac4a9b3e3\reconstructed_workflow.json'

with open(input_path, 'r', encoding='utf-8') as f:
    data = json.load(f)['data']

nodes = data['nodes']
connections = data['connections']

# Remove old Intent Router nodes
names_to_remove = ['Intent Router', 'Intent Router Final', 'Intent Router Code V2', 'Intent Router Code V3']
nodes = [n for n in nodes if n['name'] not in names_to_remove]

# Add the new Switch node
new_node = {
    'parameters': {
        'mode': 'expression',
        'output': '={{ [\"booking\", \"faq\", \"pricing_info\"].includes($json.intent) ? 0 : ($json.intent === \"confirm\" ? 1 : ($json.intent === \"cancel\" ? 2 : 3)) }}'
    },
    'id': 'intent-router-v3-4-final-id',
    'name': 'Intent Router Final',
    'type': 'n8n-nodes-base.switch',
    'typeVersion': 3.4,
    'position': [3280, 864]
}
nodes.append(new_node)

# Clean up connections related to Intent Router
if 'High-Value upgrade logic' in connections:
    # Ensure connections['High-Value upgrade logic']['main'] exists
    if 'main' not in connections['High-Value upgrade logic']:
        connections['High-Value upgrade logic']['main'] = [[]]
    connections['High-Value upgrade logic']['main'][0] = [
        { 'node': 'Intent Router Final', 'type': 'main', 'index': 0 }
    ]

# Define Intent Router Final outgoing connections
connections['Intent Router Final'] = {
    'main': [
        [{ 'node': 'AI Agent', 'type': 'main', 'index': 0 }],
        [{ 'node': 'CONFIRM Bridge', 'type': 'main', 'index': 0 }],
        [{ 'node': 'Cancel Message', 'type': 'main', 'index': 0 }],
        [
            { 'node': 'Escalation Alert (Holding)', 'type': 'main', 'index': 0 },
            { 'node': 'Prepare Handoff Payload Logic Final', 'type': 'main', 'index': 0 }
        ]
    ]
}

# Create final payload
payload = {
    'name': 'Hotel Booking Reservation Automation - WhatsApp',
    'nodes': nodes,
    'connections': connections,
    'active': True
}

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(payload, f, indent=2)

print('SUCCESS: Reconstructed workflow saved.')
