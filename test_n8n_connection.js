const axios = require('axios');

async function testConnection() {
    const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwYTZhMDlmZS1hODRmLTQ3YjctOTllYy0zNjU3NjgzYjc5YmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcyMTY5NzYwLCJleHAiOjE3NzcyOTg0MDB9.toajaPWURSrcX4slGDEM9Ji8vHUWUGoOXR6SigtPEn0';
    const baseUrl = 'https://gonzaloleiva22.app.n8n.cloud/api/v1';

    try {
        console.log('Testing n8n API connectivity...');
        const res = await axios.get(`${baseUrl}/workflows?limit=1`, {
            headers: { 'X-N8N-API-KEY': apiKey }
        });
        console.log('SUCCESS: Connected to n8n API.');
        console.log('Workflows found:', res.data.data.length);
    } catch (e) {
        console.error('API Error:', e.response ? e.response.status : e.message);
        process.exit(1);
    }
}

testConnection();
