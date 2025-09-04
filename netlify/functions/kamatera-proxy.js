// IMPORTANT: This function requires you to set CLIENT_ID and CLIENT_SECRET
// as Environment Variables in your Netlify site settings.
// DO NOT PASTE YOUR KEYS HERE.

const fetch = require('node-fetch');

// Function to get an authentication token from Kamatera
async function getAuthToken(id, secret) {
    const url = 'https://console.kamatera.com/service/authenticate';
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: id, secret: secret })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Authentication failed:', errorText);
            return null;
        }
        
        const data = await response.json();
        return data.authentication || null;
    } catch (error) {
        console.error('Error fetching auth token:', error);
        return null;
    }
}

// Function to make API calls to Kamatera
async function callKamateraApi(token, endpoint, method = 'GET', data = null) {
    const url = `https://console.kamatera.com/service${endpoint}`;
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        const responseBody = await response.json().catch(() => response.text()); // Handle JSON or text response
        return {
            code: response.status,
            body: responseBody
        };
    } catch (error) {
        console.error('Error in callKamateraApi:', error);
        return {
            code: 500,
            body: { error: 'Failed to contact Kamatera API.' }
        };
    }
}


// The main handler for the Netlify Function
exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const { CLIENT_ID, CLIENT_SECRET } = process.env;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'API credentials are not configured in Netlify environment variables.' })
        };
    }
    
    try {
        const { action, serverId } = JSON.parse(event.body);

        if (!action || !serverId) {
             return { statusCode: 400, body: JSON.stringify({ error: 'Missing action or serverId.' }) };
        }

        const authToken = await getAuthToken(CLIENT_ID, CLIENT_SECRET);
        if (!authToken) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Could not authenticate with Kamatera.' }) };
        }

        let apiResponse;
        let responseBody = {};
        let statusCode = 200;

        switch (action) {
            case 'power_on':
            case 'power_off':
                const powerState = (action === 'power_on') ? 'on' : 'off';
                apiResponse = await callKamateraApi(authToken, `/server/${serverId}/power`, 'PUT', { power: powerState });
                if (apiResponse.code === 200) {
                    responseBody = { message: `Successfully sent 'Power ${powerState}' request for ${serverId}.`, status: 'success' };
                } else {
                    statusCode = apiResponse.code;
                    responseBody = { error: `Kamatera API Error: ${JSON.stringify(apiResponse.body)}`, status: 'error' };
                }
                break;

            case 'status':
                apiResponse = await callKamateraApi(authToken, `/server/${serverId}`);
                if (apiResponse.code === 200) {
                    const powerStatus = apiResponse.body.power ? apiResponse.body.power.toUpperCase() : 'UNKNOWN';
                    responseBody = { message: `Workstation ${serverId} status is: ${powerStatus}.`, status: 'info' };
                } else {
                    statusCode = apiResponse.code;
                    responseBody = { error: `Kamatera API Error: ${JSON.stringify(apiResponse.body)}`, status: 'error' };
                }
                break;

            default:
                statusCode = 400;
                responseBody = { error: 'Invalid action specified.', status: 'error' };
                break;
        }
        
        return { statusCode, body: JSON.stringify(responseBody) };

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
