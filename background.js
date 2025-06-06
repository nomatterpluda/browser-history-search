// Background script for Browser History Search extension
console.log('Browser History Search background script loaded');

// Import configuration and services
importScripts('config.js', 'openai-service.js');

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
            
        case 'GET_STATS':
            getStats()
                .then(stats => sendResponse({ success: true, stats }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'SET_OPENAI_API_KEY':
            openAIService.setApiKey(message.apiKey)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'GET_OPENAI_STATUS':
            sendResponse({ 
                success: true, 
                status: openAIService.getUsageStats() 
            });
            break;
            
        case 'GENERATE_EMBEDDINGS':
            generateEmbeddingsForContent(message.contentId)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'UPDATE_SETTINGS':
            updateSettings(message.settings)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'CONTENT_EXTRACTED':
            // Handle content extracted from pages
            handleContentExtracted(message.content)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'EXTRACT_CONTENT_FROM_TAB':
            // Extract content from a specific tab
            extractContentFromTab(message.tabId)
                .then(content => sendResponse({ success: true, content }))
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
        favicon: getFaviconUrl(historyItem.url),
        visitCount: historyItem.visitCount || 1,
        relevanceScore: calculateRelevanceScore(historyItem)
    };
}

// Get favicon URL with fallback
function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Use Google's favicon service as it's more reliable
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch (error) {
        // Fallback to a generic icon
        return generateGenericFavicon(url);
    }
}

// Generate a simple generic favicon
function generateGenericFavicon(url) {
    try {
        const urlObj = new URL(url);
        const firstLetter = urlObj.hostname.charAt(0).toUpperCase();
        
        // Create a simple SVG favicon with the first letter of the domain
        const svg = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <rect width="16" height="16" fill="#1a73e8"/>
            <text x="8" y="12" font-family="Arial, sans-serif" font-size="10" fill="white" text-anchor="middle">${firstLetter}</text>
        </svg>`;
        
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    } catch (error) {
        // Ultimate fallback - a simple blue square
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMWE3M2U4Ii8+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn4yQPC90ZXh0Pgo8L3N2Zz4K';
    }
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

// Content extraction and processing
async function handleContentExtracted(extractedContent) {
    try {
        console.log('Processing extracted content:', extractedContent.url);
        
        // Store the extracted content for future processing
        await storeExtractedContent(extractedContent);
        
        // Generate embeddings if OpenAI is configured
        if (openAIService.isReady()) {
            await generateEmbeddingsForStoredContent(extractedContent.url);
        } else {
            console.log('OpenAI not configured, skipping embeddings generation');
        }
        
    } catch (error) {
        console.error('Error handling extracted content:', error);
        throw error;
    }
}

// Store extracted content in local storage
async function storeExtractedContent(content) {
    try {
        const storageKey = `content_${content.url}`;
        const contentData = {
            ...content,
            storedAt: new Date().toISOString(),
            processed: false // Will be true after embeddings are generated
        };
        
        await chrome.storage.local.set({ [storageKey]: contentData });
        
        // Update stats
        const stats = await getStats();
        stats.totalPages = (stats.totalPages || 0) + 1;
        stats.lastUpdate = new Date().toISOString();
        await chrome.storage.local.set({ stats });
        
        console.log('Content stored for URL:', content.url);
        
    } catch (error) {
        console.error('Error storing extracted content:', error);
        throw error;
    }
}

// Extract content from a specific tab
async function extractContentFromTab(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
        
        if (response.success) {
            await handleContentExtracted(response.content);
            return response.content;
        } else {
            throw new Error(response.reason || 'Content extraction failed');
        }
        
    } catch (error) {
        console.error('Error extracting content from tab:', error);
        throw error;
    }
}

// Get stored statistics
async function getStats() {
    try {
        const result = await chrome.storage.local.get(['stats']);
        return result.stats || { totalPages: 0, lastUpdate: null };
    } catch (error) {
        console.error('Error getting stats:', error);
        return { totalPages: 0, lastUpdate: null };
    }
}

// Get all stored content (for debugging/management)
async function getAllStoredContent() {
    try {
        const allData = await chrome.storage.local.get(null);
        const contentItems = {};
        
        Object.keys(allData).forEach(key => {
            if (key.startsWith('content_')) {
                contentItems[key] = allData[key];
            }
        });
        
        return contentItems;
    } catch (error) {
        console.error('Error getting stored content:', error);
        return {};
    }
}

// OpenAI Embeddings Functions
async function generateEmbeddingsForStoredContent(url) {
    try {
        const contentKey = `content_${url}`;
        const result = await chrome.storage.local.get([contentKey]);
        const contentData = result[contentKey];
        
        if (!contentData) {
            throw new Error('Content not found for URL: ' + url);
        }
        
        console.log('Generating embeddings for:', url);
        
        const embeddingResult = await openAIService.generateEmbeddings(contentData.content);
        
        if (embeddingResult.success) {
            // Store the embedding
            const embeddingKey = `embeddings_${url}`;
            const embeddingData = {
                url: url,
                embedding: embeddingResult.embedding,
                tokens: embeddingResult.tokens,
                generatedAt: new Date().toISOString(),
                contentLength: contentData.content.length
            };
            
            await chrome.storage.local.set({ [embeddingKey]: embeddingData });
            
            // Mark content as processed
            contentData.processed = true;
            contentData.embeddingGeneratedAt = new Date().toISOString();
            await chrome.storage.local.set({ [contentKey]: contentData });
            
            console.log('Embeddings generated and stored for:', url);
            return embeddingData;
        } else {
            throw new Error('Failed to generate embeddings');
        }
        
    } catch (error) {
        console.error('Error generating embeddings for content:', error);
        throw error;
    }
}

async function generateEmbeddingsForContent(contentId) {
    try {
        // This function can be called manually for specific content
        const url = contentId.replace('content_', '');
        return await generateEmbeddingsForStoredContent(url);
    } catch (error) {
        console.error('Error in generateEmbeddingsForContent:', error);
        throw error;
    }
}

// Get all stored embeddings
async function getAllEmbeddings() {
    try {
        const allData = await chrome.storage.local.get(null);
        const embeddings = {};
        
        Object.keys(allData).forEach(key => {
            if (key.startsWith('embeddings_')) {
                embeddings[key] = allData[key];
            }
        });
        
        return embeddings;
    } catch (error) {
        console.error('Error getting embeddings:', error);
        return {};
    }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) {
        return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in background script:', event.reason);
}); 