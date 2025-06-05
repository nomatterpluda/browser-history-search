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
                .catch(error => {
                    console.error('Search error:', error);
                    sendResponse({ success: false, error: error.message });
                });
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
            
        case 'PING':
            // Health check endpoint
            sendResponse({ success: true, status: 'ready' });
            break;
            
        default:
            console.warn('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
});

// History API integration
async function getRecentHistory(maxResults = 100) {
    try {
        const endTime = Date.now();
        const startTime = endTime - (7 * 24 * 60 * 60 * 1000); // Last 7 days
        
        const historyItems = await chrome.history.search({
            text: '',
            startTime: startTime,
            endTime: endTime,
            maxResults: maxResults
        });
        
        console.log(`Retrieved ${historyItems.length} history items`);
        return historyItems;
        
    } catch (error) {
        console.error('Error fetching history:', error);
        throw error;
    }
}

// Filter and process history items
function filterHistoryItems(historyItems) {
    // Filter out unwanted URLs
    const excludePatterns = [
        /^chrome:/,
        /^chrome-extension:/,
        /^moz-extension:/,
        /^about:/,
        /^file:/,
        /localhost/,
        /127\.0\.0\.1/,
        /\.local$/
    ];
    
    return historyItems.filter(item => {
        // Skip items without title or with very short titles
        if (!item.title || item.title.length < 3) return false;
        
        // Skip items matching exclude patterns
        if (excludePatterns.some(pattern => pattern.test(item.url))) return false;
        
        // Skip items with very low visit count
        if (item.visitCount < 1) return false;
        
        return true;
    });
}

// Search function with basic text matching (before semantic search)
async function handleHistorySearch(query) {
    console.log('Searching history for:', query);
    
    try {
        // Get recent history
        const historyItems = await getRecentHistory(500);
        const filteredItems = filterHistoryItems(historyItems);
        
        if (query.trim() === '') {
            // Return recent items if no query
            return filteredItems.slice(0, 10).map(item => formatHistoryItem(item));
        }
        
        // Basic text search (will be replaced with semantic search later)
        const searchTerms = query.toLowerCase().split(' ');
        const matchedItems = filteredItems.filter(item => {
            const searchText = `${item.title} ${item.url}`.toLowerCase();
            return searchTerms.some(term => searchText.includes(term));
        });
        
        // Sort by visit count and recency
        matchedItems.sort((a, b) => {
            const scoreA = (a.visitCount || 1) * (a.lastVisitTime || 0);
            const scoreB = (b.visitCount || 1) * (b.lastVisitTime || 0);
            return scoreB - scoreA;
        });
        
        return matchedItems.slice(0, 10).map(item => formatHistoryItem(item));
        
    } catch (error) {
        console.error('Search error:', error);
        // Fallback to mock results if history API fails
        return [{
            id: 'error-fallback',
            title: 'Search temporarily unavailable',
            url: '#',
            snippet: 'Please try again in a moment.',
            visitDate: new Date().toISOString(),
            favicon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZmY0NDQ0Ii8+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4hPC90ZXh0Pgo8L3N2Zz4K',
            relevanceScore: 0
        }];
    }
}

// Format history item for display
function formatHistoryItem(historyItem) {
    const visitDate = new Date(historyItem.lastVisitTime || Date.now());
    
    return {
        id: historyItem.id || `history-${Date.now()}`,
        title: historyItem.title || 'Untitled Page',
        url: historyItem.url,
        snippet: generateSnippet(historyItem),
        visitDate: visitDate.toISOString(),
        favicon: `chrome://favicon/${historyItem.url}`,
        visitCount: historyItem.visitCount || 1,
        relevanceScore: calculateRelevanceScore(historyItem)
    };
}

// Generate snippet from URL and title
function generateSnippet(historyItem) {
    const title = historyItem.title || '';
    const url = historyItem.url || '';
    
    // Extract domain for context
    let domain = '';
    try {
        domain = new URL(url).hostname;
    } catch (e) {
        domain = url;
    }
    
    // Create snippet
    if (title.length > 50) {
        return `${title.substring(0, 50)}... • ${domain}`;
    } else {
        return `${title} • ${domain}`;
    }
}

// Calculate basic relevance score
function calculateRelevanceScore(historyItem) {
    const visitCount = historyItem.visitCount || 1;
    const recency = historyItem.lastVisitTime || 0;
    const now = Date.now();
    const daysSinceVisit = (now - recency) / (1000 * 60 * 60 * 24);
    
    // Score based on visit count and recency
    const visitScore = Math.min(visitCount / 10, 1); // Normalize to 0-1
    const recencyScore = Math.max(0, 1 - (daysSinceVisit / 30)); // Decay over 30 days
    
    return (visitScore * 0.6 + recencyScore * 0.4);
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