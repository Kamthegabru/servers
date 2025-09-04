document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    const powerOnBtn = document.getElementById('powerOnBtn');
    const powerOffBtn = document.getElementById('powerOffBtn');
    const statusBtn = document.getElementById('statusBtn');
    const powerControls = document.getElementById('power-controls');
    const loadingSpinner = document.getElementById('loading-spinner');
    const messageBox = document.getElementById('message-box');
    const allButtons = document.querySelectorAll('.power-btn');

    function showMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700', 'bg-blue-100', 'text-blue-700');
        if (type === 'error') {
            messageBox.classList.add('bg-red-100', 'text-red-700');
        } else if (type === 'success') {
            messageBox.classList.add('bg-green-100', 'text-green-700');
        } else {
            messageBox.classList.add('bg-blue-100', 'text-blue-700');
        }
        messageBox.classList.remove('hidden');
    }

    function toggleLoading(isLoading) {
        if (isLoading) {
            powerControls.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
            messageBox.classList.add('hidden');
        } else {
            powerControls.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
        }
    }
    
    function setButtonsDisabled(disabled) {
        allButtons.forEach(button => button.disabled = disabled);
    }

    async function makeRequest(action, serverKey) {
        toggleLoading(true);
        try {
            const response = await fetch('/.netlify/functions/kamatera-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, serverId: serverKey }), // Send the key, not the UUID
            });

            const resultText = await response.text();
            if (!response.ok) {
                throw new Error(resultText || `Server returned an error: ${response.status} ${response.statusText}`);
            }
            
            try {
                const result = JSON.parse(resultText);
                if (result.error) {
                    throw new Error(result.error);
                }
                showMessage(result.message, result.status);
            } catch (e) {
                throw new Error(`Received an unexpected, non-JSON response from the server: ${resultText}`);
            }

        } catch (error) {
            showMessage(`Error: ${error.message}`, 'error');
        } finally {
            toggleLoading(false);
        }
    }
    
    function handleAction(action) {
        const serverKey = serverSelect.value;
        if (!serverKey) {
            showMessage('Please select a workstation from the list.', 'error');
            return;
        }
        makeRequest(action, serverKey);
    }

    powerOnBtn.addEventListener('click', () => handleAction('power_on'));
    powerOffBtn.addEventListener('click', () => handleAction('power_off'));
    statusBtn.addEventListener('click', () => handleAction('status'));
    
    serverSelect.addEventListener('change', () => {
        setButtonsDisabled(serverSelect.value === '');
    });

    // Initially disable buttons
    setButtonsDisabled(true);
});
