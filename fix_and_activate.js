
const axios = require('axios');

const n8nApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwYTZhMDlmZS1hODRmLTQ3YjctOTllYy0zNjU3NjgzYjc5YmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcyMTY5NzYwLCJleHAiOjE3NzcyOTg0MDB9.toajaPWURSrcX4slGDEM9Ji8vHUWUGoOXR6SigtPEn0';
const baseUrl = 'https://gonzaloleiva22.app.n8n.cloud/api/v1';
const workflowId = 'NtqV5Ao5QBUwNvEZ';

// The toolCustom node's JS code runs in n8n's sandbox.
// We use $credentials to access the Airtable token securely.
const directAirtableCode = `
const baseId = 'appe9ophN5EpDuPHZ';
const tableName = 'Reservations';

function sanitizeDate(d) {
  if (!d) return '';
  try { return new Date(d).toISOString().split('T')[0]; } catch(e) { return String(d); }
}

// Build the fields object - only include non-empty values
const fields = {};
if (query.Guest_Name)    fields['Guest_Name']    = String(query.Guest_Name);
if (query.Check_In)      fields['Check_In']      = sanitizeDate(query.Check_In);
if (query.Check_Out)     fields['Check_Out']     = sanitizeDate(query.Check_Out);
if (query.Room_Type)     fields['Room_Type']     = String(query.Room_Type);
if (query.Phone_Number)  fields['Phone_Number']  = String(query.Phone_Number);
if (query.Notes)         fields['Notes']         = String(query.Notes);

// Fetch the Airtable token from n8n credentials
const creds = await $getCredentials('airtableTokenApi');
const token = creds.airtableTokenApi;

const response = await $http.request({
  method: 'POST',
  url: \`https://api.airtable.com/v0/\${baseId}/\${tableName}\`,
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  },
  body: { fields }
});

return { success: true, record_id: response.id, fields_written: fields };
`;

async function fixAndActivate() {
  try {
    // 1. Get the current workflow
    console.log('Fetching workflow...');
    const res = await axios.get(`${baseUrl}/workflows/${workflowId}`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });
    const workflow = res.data;
    console.log('Current active status:', workflow.active);

    // 2. Update BookingTool JS
    const bookingTool = workflow.nodes.find(n => n.name === 'Booking_Tool');
    if (!bookingTool) {
      console.error('Booking_Tool node not found!');
      return;
    }

    console.log('Updating Booking_Tool with direct Airtable write...');
    bookingTool.parameters.jsCode = directAirtableCode.trim();
    bookingTool.parameters.description = 'Registers hotel reservation directly in Airtable. Required: Guest_Name, Check_In (YYYY-MM-DD), Check_Out (YYYY-MM-DD), Room_Type. Optional: Phone_Number, Notes.';

    // Add the airtable credential reference to the tool node
    bookingTool.credentials = {
      airtableTokenApi: {
        id: '9zB00kyjeufS2QkT',
        name: 'Airtable Personal Access Token account'
      }
    };

    // 3. Push update
    console.log('Saving workflow...');
    const cleanPayload = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData
    };
    await axios.put(`${baseUrl}/workflows/${workflowId}`, cleanPayload, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });
    console.log('Workflow saved.');

    // 4. REACTIVATE immediately
    console.log('Reactivating workflow (this is critical)...');
    await axios.post(`${baseUrl}/workflows/${workflowId}/activate`, {}, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });

    // 5. Confirm status
    const verify = await axios.get(`${baseUrl}/workflows/${workflowId}`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey }
    });

    console.log('');
    console.log('========================================');
    console.log('WORKFLOW ACTIVE:', verify.data.active);
    console.log('Webhook URL: https://gonzaloleiva22.app.n8n.cloud/webhook/twilio-inbound');
    console.log('BookingTool: direct Airtable write (no sub-workflow)');
    console.log('========================================');
    console.log('Send a WhatsApp message now to test!');

  } catch (e) {
    console.error('Error:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
  }
}

fixAndActivate();
