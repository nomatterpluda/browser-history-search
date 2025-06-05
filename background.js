// Background script for Browser History Search extension
console.log('Browser History Search background script loaded');

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        // First time installation
        console.log('First time installation - setting up extension');
        initializeExtension();
    } else if (details.reason === 'update') {
        // Extension updated
        console.log('Extension updated from version:', details.previousVersion);
    }
});

// Extension startup handler
chrome.runtime.onStartup.addListener(() => {
    console.log('Browser started - extension active');
});

// Initialize extension
async function initializeExtension() {
    try {
        // Set default settings
        await chrome.storage.local.set({
            settings: {
                dataRetentionDays: 180, // 6 months default
                maxResults: 10,
                enablePreview: true,
                lastProcessedDate: null
            },
            stats: {
                totalPages: 0,
                lastUpdate: new Date().toISOString()
            }
        });
        
        console.log('Extension initialized with default settings');
        
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.type) {
        case 'SEARCH_HISTORY':
            handleHistorySearch(message.query)
                .then(results => sendResponse({ success: true, results }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep message channel open for async response
            
        case 'GET_SETTINGS':
            getSettings()
                .then(settings => sendResponse({ success: true, settings }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'UPDATE_SETTINGS':
            updateSettings(message.settings)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        default:
            console.warn('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
});

// Placeholder search function (to be implemented in later phases)
async function handleHistorySearch(query) {
    console.log('Searching history for:', query);
    
    // TODO: Implement actual semantic search
    // For now, return mock results
    return [
        {
            id: 'mock-1',
            title: 'Mock Search Result',
            url: 'https://example.com',
            snippet: `Mock result for query: "${query}"`,
            visitDate: new Date().toISOString(),
            favicon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMUE3M0U4Ii8+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5NPC90ZXh0Pgo8L3N2Zz4K',
            relevanceScore: 0.85
        }
    ];
}

// Get extension settings
async function getSettings() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        return result.settings || {};
    } catch (error) {
        console.error('Error getting settings:', error);
        throw error;
    }
}

// Update extension settings
async function updateSettings(newSettings) {
    try {
        const currentSettings = await getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        
        await chrome.storage.local.set({ settings: updatedSettings });
        console.log('Settings updated:', updatedSettings);
        
    } catch (error) {
        console.error('Error updating settings:', error);
        throw error;
    }
}

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in background script:', event.reason);
}); 