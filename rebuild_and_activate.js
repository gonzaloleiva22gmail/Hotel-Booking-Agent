
const axios = require('axios');

const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwYTZhMDlmZS1hODRmLTQ3YjctOTllYy0zNjU3NjgzYjc5YmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcyMTY5NzYwLCJleHAiOjE3NzcyOTg0MDB9.toajaPWURSrcX4slGDEM9Ji8vHUWUGoOXR6SigtPEn0';
const baseUrl = 'https://gonzaloleiva22.app.n8n.cloud/api/v1';
const workflowId = 'NtqV5Ao5QBUwNvEZ';

async function rebuildAndActivate() {
  try {
    console.log('Fetching workflow...');
    const res = await axios.get(`${baseUrl}/workflows/${workflowId}`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });
    const workflow = res.data;
    console.log('Current active:', workflow.active);

    // 1. Remove the old broken Booking_Tool node (the toolCustom one)
    console.log('Removing old Booking_Tool node...');
    workflow.nodes = workflow.nodes.filter(n => n.name !== 'Booking_Tool');

    // 2. Remove its connection
    delete workflow.connections['Booking_Tool'];

    // 3. Add native Airtable Tool node (proven to work - same type as Check_Booked_Rooms)
    console.log('Adding native Airtable Tool node for booking creation...');
    const nativeAirtableTool = {
      parameters: {
        operation: 'create',
        base: {
          __rl: true,
          value: 'appe9ophN5EpDuPHZ',
          mode: 'list'
        },
        table: {
          __rl: true,
          value: 'Reservations',
          mode: 'name'
        },
        columns: {
          mappingMode: 'defineBelow',
          value: {
            Guest_Name:   '={{ $fromAI("Guest_Name", "Full name of the guest") }}',
            Check_In:     '={{ $fromAI("Check_In", "Check-in date in YYYY-MM-DD format") }}',
            Check_Out:    '={{ $fromAI("Check_Out", "Check-out date in YYYY-MM-DD format") }}',
            Room_Type:    '={{ $fromAI("Room_Type", "Type of room requested") }}',
            Phone_Number: '={{ $fromAI("Phone_Number", "Guest phone number") }}',
            Notes:        '={{ $fromAI("Notes", "Any additional notes or requests") }}'
          }
        },
        options: {}
      },
      id: 'native-booking-tool-001',
      name: 'Booking_Tool',
      type: 'n8n-nodes-base.airtableTool',
      typeVersion: 2.1,
      position: [1520, 208],
      credentials: {
        airtableTokenApi: {
          id: '9zB00kyjeufS2QkT',
          name: 'Airtable Personal Access Token account'
        }
      }
    };
    workflow.nodes.push(nativeAirtableTool);

    // 4. Add connection: Booking_Tool -> AI Agent (as ai_tool)
    workflow.connections['Booking_Tool'] = {
      ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]]
    };

    // 5. Push update
    const cleanPayload = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData
    };

    console.log('Saving workflow...');
    await axios.put(`${baseUrl}/workflows/${workflowId}`, cleanPayload, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });
    console.log('Saved. Now reactivating...');

    // 6. REACTIVATE immediately
    await axios.post(`${baseUrl}/workflows/${workflowId}/activate`, {}, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });

    // 7. Confirm
    const verify = await axios.get(`${baseUrl}/workflows/${workflowId}`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });

    console.log('');
    console.log('========================================');
    console.log('WORKFLOW ACTIVE:', verify.data.active);
    console.log('BookingTool: Native Airtable Tool (create)');
    console.log('Webhook is LIVE - send your WhatsApp now!');
    console.log('========================================');

  } catch (e) {
    console.error('Error:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
  }
}

rebuildAndActivate();
