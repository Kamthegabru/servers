const fetch = require('node-fetch');

// This is the main function that Netlify will run
exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { action, serverId: serverKey } = JSON.parse(event.body);
        const { CLIENT_ID, CLIENT_SECRET } = process.env;

        // Map the friendly server key to the correct environment variable for the UUID
        const workstationUuids = {
            ws1: process.env.WORKSTATION_1_UUID,
            ws2: process.env.WORKSTATION_2_UUID,
            ws3: process.env.WORKSTATION_3_UUID,
            ws4: process.env.WORKSTATION_4_UUID,
            ws5: process.env.WORKSTATION_5_UUID,
        };

        const serverUuid = workstationUuids[serverKey];

        // --- VALIDATION ---
        if (!CLIENT_ID || !CLIENT_SECRET) {
            return { statusCode: 500, body: JSON.stringify({ error: 'API credentials are not configured in environment variables.' }) };
        }
        if (!serverKey || !serverUuid) {
             return { statusCode: 400, body: JSON.stringify({ error: `UUID for ${serverKey} is not configured or invalid.` }) };
        }
        if (!['power_on', 'power_off', 'status'].includes(action)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action specified.' }) };
        }

        // --- STEP 1: AUTHENTICATE WITH KAMATERA ---
        const authResponse = await fetch('https://console.kamatera.com/service/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: CLIENT_ID, secret: CLIENT_SECRET }),
        });
        
        const authData = await authResponse.json();
        if (!authResponse.ok || !authData.authentication) {
            throw new Error('Kamatera authentication failed.');
        }
        const authToken = authData.authentication;

        // --- STEP 2: PERFORM THE REQUESTED ACTION ---
        const headers = {
            'Content-Type': 'application/json',
            'AuthClientId': CLIENT_ID,
            'AuthSecret': authToken,
        };

        let response, data, message, status = 'success';

        if (action === 'power_on' || action === 'power_off') {
            const powerState = action === 'power_on' ? 'on' : 'off';
            response = await fetch(`https://console.kamatera.com/service/server/${serverUuid}/power`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ power: powerState }),
            });
             if (!response.ok) throw new Error(await response.text());
            message = `Successfully sent power ${powerState} command.`;
        } else { // status
            response = await fetch(`https://console.kamatera.com/service/server/${serverUuid}`, {
                method: 'GET',
                headers,
            });
             if (!response.ok) throw new Error(await response.text());
            data = await response.json();
            message = `Server status is currently: ${data.power.toUpperCase()}`;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message, status }),
        };

    } catch (error) {
        console.error('Function Error:', error);
        // Try to parse the error if it's a JSON string from Kamatera
        let errorMessage = error.message;
        try {
            const parsedError = JSON.parse(errorMessage);
            if (parsedError.errors && parsedError.errors[0]) {
                errorMessage = parsedError.errors[0].info || 'An unknown Kamatera API error occurred.';
            }
        } catch (e) {
            // It wasn't JSON, so we use the original message
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: errorMessage }),
        };
    }
};

