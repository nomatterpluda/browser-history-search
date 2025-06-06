// DOM elements
const searchInput = document.getElementById('searchInput');
const loadingState = document.getElementById('loadingState');
const resultsContainer = document.getElementById('resultsContainer');
const noResults = document.getElementById('noResults');
const extractButton = document.getElementById('extractButton');
const statsButton = document.getElementById('statsButton');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.getElementById('closeModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveSettings = document.getElementById('saveSettings');
const testApi = document.getElementById('testApi');
const apiStatus = document.getElementById('apiStatus');
const statusText = document.getElementById('statusText');

// State management
let searchTimeout;
const SEARCH_DELAY = 300; // ms

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    console.log('Browser History Search extension loaded');
    searchInput.focus();
    
    // Add event listeners
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleKeyDown);
    extractButton.addEventListener('click', handleExtractContent);
    statsButton.addEventListener('click', showStats);
    settingsButton.addEventListener('click', openSettings);
    closeModal.addEventListener('click', closeSettings);
    saveSettings.addEventListener('click', handleSaveSettings);
    testApi.addEventListener('click', handleTestApi);
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });
    
    // Load recent history on startup
    loadRecentHistory();
});

// Load recent history items
async function loadRecentHistory() {
    try {
        showLoadingState();
        
        const response = await chrome.runtime.sendMessage({
            type: 'SEARCH_HISTORY',
            query: '' // Empty query returns recent items
        });
        
        if (response.success && response.results.length > 0) {
            displayResults(response.results);
        } else {
            hideAllStates();
        }
        
    } catch (error) {
        console.error('Error loading recent history:', error);
        hideAllStates();
    }
}

// Handle search input with debouncing
function handleSearchInput(event) {
    const query = event.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Hide previous results
    hideAllStates();
    
    if (query.length === 0) {
        return;
    }
    
    // Show loading state after delay
    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, SEARCH_DELAY);
}

// Handle keyboard navigation
function handleKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            performSearch(query);
        }
    }
}

// Perform search using background script
async function performSearch(query) {
    console.log('Searching for:', query);
    
    showLoadingState();
    
    try {
        // Send search request to background script
        const response = await chrome.runtime.sendMessage({
            type: 'SEARCH_HISTORY',
            query: query
        });
        
        if (response.success) {
            displayResults(response.results);
        } else {
            console.error('Search failed:', response.error);
            showNoResults();
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showNoResults();
    }
}

// Display search results
function displayResults(results) {
    hideAllStates();
    
    if (results.length === 0) {
        showNoResults();
        return;
    }
    
    resultsContainer.innerHTML = '';
    
    results.forEach(result => {
        const resultElement = createResultElement(result);
        resultsContainer.appendChild(resultElement);
    });
    
    resultsContainer.classList.remove('hidden');
}

// Create individual result element
function createResultElement(result) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    
    const visitDate = new Date(result.visitDate);
    const relativeDate = getRelativeDate(visitDate);
    
    resultDiv.innerHTML = `
        <div class="result-title">${escapeHtml(result.title)}</div>
        <div class="result-snippet">${escapeHtml(result.snippet)}</div>
        <div class="result-meta">
            <img class="result-favicon" src="${result.favicon}" alt="favicon" onerror="this.style.display='none'">
            <span>${relativeDate}</span>
        </div>
    `;
    
    // Add click handler to open URL
    resultDiv.addEventListener('click', () => {
        chrome.tabs.create({ url: result.url });
        window.close();
    });
    
    return resultDiv;
}

// Utility functions
function hideAllStates() {
    loadingState.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    noResults.classList.add('hidden');
}

function showLoadingState() {
    hideAllStates();
    loadingState.classList.remove('hidden');
}

function showNoResults() {
    hideAllStates();
    noResults.classList.remove('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getRelativeDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    }
}

// Handle extract content button click
async function handleExtractContent() {
    try {
        extractButton.disabled = true;
        extractButton.textContent = '⏳ Extracting...';
        
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            throw new Error('No active tab found');
        }
        
        // Request content extraction from background script
        const response = await chrome.runtime.sendMessage({
            type: 'EXTRACT_CONTENT_FROM_TAB',
            tabId: tab.id
        });
        
        if (response.success) {
            extractButton.textContent = '✅ Extracted!';
            setTimeout(() => {
                extractButton.textContent = '📄 Extract Current Page';
                extractButton.disabled = false;
            }, 2000);
            
            console.log('Content extracted successfully:', response.content);
        } else {
            throw new Error(response.error || 'Extraction failed');
        }
        
    } catch (error) {
        console.error('Error extracting content:', error);
        
        // Show more specific error messages
        if (error.message.includes('content scripts not allowed')) {
            extractButton.textContent = '❌ System Page';
        } else if (error.message.includes('Could not establish connection')) {
            extractButton.textContent = '❌ Refresh Page';
        } else {
            extractButton.textContent = '❌ Failed';
        }
        
        setTimeout(() => {
            extractButton.textContent = '📄 Extract Current Page';
            extractButton.disabled = false;
        }, 3000);
    }
}

// Show extraction statistics
async function showStats() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_STATS'
        });
        
        if (response.success) {
            const stats = response.stats;
            alert(`📊 Extraction Statistics:
            
📄 Pages Processed: ${stats.totalPages || 0}
📅 Last Update: ${stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString() : 'Never'}

The extension is working! Content is being extracted and stored for future semantic search.`);
        } else {
            alert('❌ Could not load statistics');
        }
    } catch (error) {
        console.error('Error getting stats:', error);
        alert('❌ Error loading statistics');
    }
}

// Settings Modal Functions
async function openSettings() {
    try {
        // Load current settings
        await loadCurrentSettings();
        
        // Check OpenAI status
        await updateApiStatus();
        
        // Show modal
        settingsModal.classList.remove('hidden');
        apiKeyInput.focus();
        
    } catch (error) {
        console.error('Error opening settings:', error);
    }
}

function closeSettings() {
    settingsModal.classList.add('hidden');
    apiKeyInput.value = '';
}

async function loadCurrentSettings() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_SETTINGS'
        });
        
        if (response.success && response.settings.openaiApiKey) {
            // Show masked API key
            const maskedKey = response.settings.openaiApiKey.substring(0, 7) + '...' + response.settings.openaiApiKey.slice(-4);
            apiKeyInput.placeholder = `Current: ${maskedKey}`;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function updateApiStatus() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_OPENAI_STATUS'
        });
        
        if (response.success) {
            const status = response.status;
            
            if (status.isReady) {
                apiStatus.className = 'api-status success';
                statusText.textContent = '✅ API key configured and ready';
            } else if (status.isConfigured) {
                apiStatus.className = 'api-status warning';
                statusText.textContent = '⚠️ API key configured but not validated';
            } else {
                apiStatus.className = 'api-status error';
                statusText.textContent = '❌ API key not configured';
            }
        }
    } catch (error) {
        console.error('Error getting API status:', error);
        apiStatus.className = 'api-status error';
        statusText.textContent = '❌ Error checking API status';
    }
}

async function handleSaveSettings() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }
    
    if (!apiKey.startsWith('sk-')) {
        alert('Invalid API key format. OpenAI API keys start with "sk-"');
        return;
    }
    
    try {
        saveSettings.disabled = true;
        saveSettings.textContent = '💾 Saving...';
        
        const response = await chrome.runtime.sendMessage({
            type: 'SET_OPENAI_API_KEY',
            apiKey: apiKey
        });
        
        if (response.success) {
            saveSettings.textContent = '✅ Saved!';
            await updateApiStatus();
            
            setTimeout(() => {
                saveSettings.textContent = '💾 Save Settings';
                saveSettings.disabled = false;
                closeSettings();
            }, 1500);
        } else {
            throw new Error(response.error || 'Failed to save API key');
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        alert(`❌ Error saving API key: ${error.message}`);
        
        saveSettings.textContent = '💾 Save Settings';
        saveSettings.disabled = false;
    }
}

async function handleTestApi() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        alert('Please enter an API key to test');
        return;
    }
    
    try {
        testApi.disabled = true;
        testApi.textContent = '🧪 Testing...';
        
        // This will test the API key as part of the save process
        const response = await chrome.runtime.sendMessage({
            type: 'SET_OPENAI_API_KEY',
            apiKey: apiKey
        });
        
        if (response.success) {
            testApi.textContent = '✅ Valid!';
            await updateApiStatus();
        } else {
            throw new Error(response.error || 'API key test failed');
        }
        
        setTimeout(() => {
            testApi.textContent = '🧪 Test API Key';
            testApi.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Error testing API key:', error);
        alert(`❌ API key test failed: ${error.message}`);
        
        testApi.textContent = '🧪 Test API Key';
        testApi.disabled = false;
    }
} 