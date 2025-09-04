const fetch = require('node-fetch');

// This is the main handler for the Netlify Function
exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Securely get the API keys from environment variables
    const { CLIENT_ID, CLIENT_SECRET, WORKSTATION_1_UUID } = process.env;

    // --- Workstation Mapping ---
    // This maps the simple value from the HTML dropdown to the secure UUID
    const workstationMap = {
        'ws1': WORKSTATION_1_UUID,
        // To add more, create a 'WORKSTATION_2_UUID' environment variable
        // and add a line here: 'ws2': process.env.WORKSTATION_2_UUID
    };

    try {
        const { action, serverId: serverKey } = JSON.parse(event.body);
        
        // Find the actual UUID from the mapping
        const serverId = workstationMap[serverKey];

        if (!serverId) {
             return {
                statusCode: 400,
                body: JSON.stringify({ error: `Invalid workstation key provided: '${serverKey}'. Please check the configuration.`, status: 'error' }),
            };
        }

        // --- 1. Get Authentication Token from Kamatera ---
        const authResponse = await fetch('https://console.kamatera.com/service/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: CLIENT_ID, secret: CLIENT_SECRET }),
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            throw new Error(`Authentication failed: ${errorText}`);
        }
        
        const authData = await authResponse.json();
        // NOTE: The Kamatera documentation is inconsistent. Some endpoints need a Bearer token, others use keys.
        // This implementation will use the keys directly in the header as it's more common in their examples.

        let apiUrl;
        let options;
        let successMessage;

        // --- 2. Perform the Requested Action ---
        const headers = {
            'Content-Type': 'application/json',
            'AuthClientId': CLIENT_ID,
            'AuthSecret': CLIENT_SECRET
        };

        switch (action) {
            case 'power_on':
            case 'power_off':
                apiUrl = `https://console.kamatera.com/service/server/${serverId}/power`;
                options = {
                    method: 'PUT',
                    headers: headers,
                    body: JSON.stringify({ power: action === 'power_on' ? 'on' : 'off' }),
                };
                successMessage = `Successfully sent power ${action === 'power_on' ? 'ON' : 'OFF'} command to the workstation.`;
                break;
            
            case 'status':
                apiUrl = `https://console.kamatera.com/service/server/${serverId}`;
                 options = {
                    method: 'GET',
                    headers: headers,
                };
                break;

            default:
                throw new Error('Invalid action specified.');
        }

        const apiResponse = await fetch(apiUrl, options);
        const responseText = await apiResponse.text();

        if (!apiResponse.ok) {
            throw new Error(`Kamatera API Error: ${responseText}`);
        }

        // --- 3. Format and Return the Response ---
        let responsePayload;

        if (action === 'status') {
            const statusData = JSON.parse(responseText);
            responsePayload = {
                message: `Workstation '${statusData.name}' power status is currently: ${statusData.power.toUpperCase()}`,
                status: 'info',
            };
        } else {
             responsePayload = {
                message: successMessage,
                status: 'success',
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(responsePayload),
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message, status: 'error' }),
        };
    }
};

