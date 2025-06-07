// Background script for Browser History Search extension
console.log('Browser History Search background script loaded');

// Configuration constants (inlined for compatibility)
const OPENAI_CONFIG = {
    apiUrl: 'https://api.openai.com/v1/embeddings',
    model: 'text-embedding-ada-002',
    maxTokens: 8191,
    batchSize: 10,
    rateLimitDelay: 1000,
    maxRetries: 3
};

const CONTENT_CONFIG = {
    maxContentLength: 5000,
    minContentLength: 50,
    chunkSize: 3000,
    overlapSize: 200
};

const STORAGE_CONFIG = {
    embeddingsPrefix: 'embeddings_',
    contentPrefix: 'content_',
    settingsKey: 'settings',
    statsKey: 'stats',
    maxStorageItems: 1000
};

const SEARCH_CONFIG = {
    similarityThreshold: 0.7,
    maxResults: 10,
    boostRecentPages: true,
    recencyBoostFactor: 0.1
};

// OpenAI Service (simplified for background script)
class OpenAIService {
    constructor() {
        this.apiKey = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            const settings = await this.getSettings();
            this.apiKey = settings.openaiApiKey;
            
            if (!this.apiKey) {
                console.warn('OpenAI API key not configured');
                return false;
            }
            
            this.isInitialized = true;
            console.log('OpenAI service initialized');
            return true;
            
        } catch (error) {
            console.error('Error initializing OpenAI service:', error);
            return false;
        }
    }

    async setApiKey(apiKey) {
        try {
            if (!apiKey || typeof apiKey !== 'string') {
                throw new Error('Invalid API key');
            }

            const testResult = await this.testApiKey(apiKey);
            if (!testResult.success) {
                throw new Error(testResult.error);
            }

            const settings = await this.getSettings();
            settings.openaiApiKey = apiKey;
            await this.saveSettings(settings);
            
            this.apiKey = apiKey;
            this.isInitialized = true;
            
            return { success: true };
            
        } catch (error) {
            console.error('Error setting API key:', error);
            return { success: false, error: error.message };
        }
    }

    async testApiKey(apiKey) {
        try {
            const response = await fetch(OPENAI_CONFIG.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: OPENAI_CONFIG.model,
                    input: 'test'
                })
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json();
                return { 
                    success: false, 
                    error: errorData.error?.message || 'API key validation failed' 
                };
            }
            
        } catch (error) {
            return { 
                success: false, 
                error: 'Network error during API key validation' 
            };
        }
    }

    async generateEmbeddings(text) {
        if (!this.isInitialized || !this.apiKey) {
            throw new Error('OpenAI service not initialized or API key missing');
        }

        if (!text || text.trim().length === 0) {
            throw new Error('Text content is required');
        }

        const truncatedText = this.truncateText(text);
        
        try {
            const response = await this.makeApiRequest({
                model: OPENAI_CONFIG.model,
                input: truncatedText
            });

            if (response.data && response.data.length > 0) {
                return {
                    success: true,
                    embedding: response.data[0].embedding,
                    tokens: response.usage?.total_tokens || 0
                };
            } else {
                throw new Error('No embedding data received');
            }
            
        } catch (error) {
            console.error('Error generating embeddings:', error);
            throw error;
        }
    }

    async makeApiRequest(payload, retryCount = 0) {
        try {
            const response = await fetch(OPENAI_CONFIG.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                
                if (response.status === 429 && retryCount < OPENAI_CONFIG.maxRetries) {
                    const retryDelay = Math.pow(2, retryCount) * 1000;
                    console.log(`Rate limited, retrying in ${retryDelay}ms...`);
                    await this.delay(retryDelay);
                    return this.makeApiRequest(payload, retryCount + 1);
                }
                
                throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
            }

            return await response.json();
            
        } catch (error) {
            if (retryCount < OPENAI_CONFIG.maxRetries) {
                console.log(`Request failed, retrying... (${retryCount + 1}/${OPENAI_CONFIG.maxRetries})`);
                await this.delay(1000 * (retryCount + 1));
                return this.makeApiRequest(payload, retryCount + 1);
            }
            throw error;
        }
    }

    truncateText(text) {
        if (text.length <= CONTENT_CONFIG.maxContentLength) {
            return text;
        }
        return text.substring(0, CONTENT_CONFIG.maxContentLength) + '...';
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getSettings() {
        try {
            const result = await chrome.storage.local.get([STORAGE_CONFIG.settingsKey]);
            return result[STORAGE_CONFIG.settingsKey] || {};
        } catch (error) {
            console.error('Error getting settings:', error);
            return {};
        }
    }

    async saveSettings(settings) {
        try {
            await chrome.storage.local.set({ [STORAGE_CONFIG.settingsKey]: settings });
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    isReady() {
        return this.isInitialized && this.apiKey;
    }

    getUsageStats() {
        return {
            isConfigured: !!this.apiKey,
            isReady: this.isReady()
        };
    }
}

// Create singleton instance
const openAIService = new OpenAIService();

// Auto-initialize when script loads
openAIService.initialize().catch(console.error);

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
            
        case 'GET_CURRENT_TAB_ID':
            // Get current tab ID for screenshot capture
            chrome.tabs.query({ active: true, currentWindow: true })
                .then(tabs => {
                    const tabId = tabs.length > 0 ? tabs[0].id : null;
                    sendResponse({ success: true, tabId });
                })
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'GET_STORED_CONTENT':
            // Get stored content for a URL
            getStoredContentForUrl(message.url)
                .then(content => sendResponse({ success: true, content }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'DEBUG_STORAGE':
            // Debug function to check what's stored
            getAllStoredContent()
                .then(content => {
                    const urls = Object.keys(content).map(key => content[key].url);
                    sendResponse({ success: true, storedUrls: urls, totalItems: urls.length });
                })
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

// Enhanced search function that includes extracted content
async function handleHistorySearch(query) {
    console.log('Searching history for:', query);
    
    try {
        if (query.trim() === '') {
            // Return recent items if no query
            const historyItems = await getRecentHistory(500);
            const filteredItems = filterHistoryItems(historyItems);
            return filteredItems.slice(0, 10).map(item => formatHistoryItem(item));
        }
        
        // Try semantic search first if OpenAI is available
        if (openAIService.isReady()) {
            try {
                const semanticResults = await performSemanticSearch(query);
                if (semanticResults.length > 0) {
                    console.log(`Found ${semanticResults.length} semantic search results`);
                    return semanticResults;
                }
            } catch (error) {
                console.warn('Semantic search failed, falling back to text search:', error.message);
            }
        }
        
        // Fallback to enhanced text search
        return await performTextSearch(query);
        
    } catch (error) {
        console.error('Search error:', error);
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

// Enhanced text search that includes extracted content
async function performTextSearch(query) {
    console.log('Performing enhanced text search for:', query);
    
    // Preprocess query - remove common words and short terms
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const searchTerms = query.toLowerCase()
        .split(/\s+/)
        .filter(term => term.length >= 2 && !stopWords.includes(term))
        .filter(term => term.length > 0);
    
    if (searchTerms.length === 0) {
        console.log('No valid search terms after preprocessing');
        return [];
    }
    
    console.log('Search terms after preprocessing:', searchTerms);
    
    // Get browser history
    const historyItems = await getRecentHistory(500);
    const filteredItems = filterHistoryItems(historyItems);
    
    // Get extracted content
    const extractedContent = await getAllStoredContent();
    
    const results = [];
    
    // Search through browser history (titles and URLs) - require higher threshold
    filteredItems.forEach(item => {
        const titleScore = calculateTextMatchScore(item.title || '', searchTerms);
        const urlScore = calculateTextMatchScore(item.url || '', searchTerms) * 0.5; // URL matches less important
        const totalScore = titleScore + urlScore;
        
        if (totalScore >= 5) { // Higher threshold for title/URL matches
            results.push({
                ...formatHistoryItem(item),
                matchScore: totalScore,
                matchType: 'title'
            });
        }
    });
    
    // Search through extracted content - require meaningful matches
    Object.values(extractedContent).forEach(content => {
        if (!content.content) return;
        
        const titleScore = calculateTextMatchScore(content.title || '', searchTerms);
        const contentScore = calculateTextMatchScore(content.content, searchTerms);
        const totalScore = titleScore * 2 + contentScore; // Title matches more important
        
        if (totalScore >= 8) { // Higher threshold for content matches
            // Check if we already have this URL from history search
            const existingIndex = results.findIndex(r => r.url === content.url);
            
            if (existingIndex >= 0) {
                // Boost existing result if content matches
                results[existingIndex].matchScore = Math.max(results[existingIndex].matchScore, totalScore);
                results[existingIndex].matchType = 'content';
                results[existingIndex].snippet = generateContentSnippet(content.content, searchTerms);
            } else {
                // Add new result from extracted content
                results.push({
                    id: `content-${Date.now()}-${Math.random()}`,
                    title: content.title || 'Untitled Page',
                    url: content.url,
                    snippet: generateContentSnippet(content.content, searchTerms),
                    visitDate: content.extractedAt || new Date().toISOString(),
                    favicon: getFaviconUrl(content.url),
                    visitCount: 1,
                    relevanceScore: totalScore / 20, // Normalize to 0-1
                    matchScore: totalScore,
                    matchType: 'content'
                });
            }
        }
    });
    
    // Sort by match score and recency
    results.sort((a, b) => {
        const scoreA = a.matchScore * (a.relevanceScore || 0.5);
        const scoreB = b.matchScore * (b.relevanceScore || 0.5);
        return scoreB - scoreA;
    });
    
    console.log(`Found ${results.length} text search results`);
    return results.slice(0, 10);
}

// Calculate text match score with better precision
function calculateTextMatchScore(text, searchTerms) {
    let score = 0;
    const textLower = text.toLowerCase();
    const textWords = textLower.split(/\s+/);
    
    searchTerms.forEach(term => {
        const termLower = term.toLowerCase();
        
        // Exact word matches (highest score)
        const exactWordMatch = textWords.some(word => 
            word.replace(/[^\w]/g, '') === termLower.replace(/[^\w]/g, '')
        );
        if (exactWordMatch) {
            score += 10;
            return;
        }
        
        // Exact phrase matches
        if (textLower.includes(termLower)) {
            score += 5;
            return;
        }
        
        // Word starts with term (medium score)
        const startsWithMatch = textWords.some(word => 
            word.replace(/[^\w]/g, '').startsWith(termLower.replace(/[^\w]/g, ''))
        );
        if (startsWithMatch && termLower.length >= 3) {
            score += 2;
            return;
        }
        
        // Partial matches only for longer terms (low score)
        if (termLower.length >= 4) {
            const partialMatch = textWords.some(word => 
                word.replace(/[^\w]/g, '').includes(termLower.replace(/[^\w]/g, ''))
            );
            if (partialMatch) {
                score += 1;
            }
        }
    });
    
    return score;
}

// Generate content snippet with highlighted terms
function generateContentSnippet(content, searchTerms) {
    const maxLength = 150;
    const lowerContent = content.toLowerCase();
    
    // Find the first occurrence of any search term
    let bestIndex = -1;
    let bestTerm = '';
    
    searchTerms.forEach(term => {
        const index = lowerContent.indexOf(term.toLowerCase());
        if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
            bestIndex = index;
            bestTerm = term;
        }
    });
    
    if (bestIndex === -1) {
        // No terms found, return beginning
        return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
    
    // Extract snippet around the found term
    const start = Math.max(0, bestIndex - 50);
    const end = Math.min(content.length, start + maxLength);
    let snippet = content.substring(start, end);
    
    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
}

// Perform semantic search using OpenAI embeddings
async function performSemanticSearch(query) {
    console.log('Performing semantic search for:', query);
    
    try {
        // Generate embedding for the search query
        const queryEmbeddingResult = await openAIService.generateEmbeddings(query);
        if (!queryEmbeddingResult.success) {
            throw new Error('Failed to generate query embedding');
        }
        
        const queryEmbedding = queryEmbeddingResult.embedding;
        
        // Get all stored embeddings
        const allEmbeddings = await getAllEmbeddings();
        const results = [];
        
        // Calculate similarity scores with higher threshold
        Object.values(allEmbeddings).forEach(embeddingData => {
            const similarity = cosineSimilarity(queryEmbedding, embeddingData.embedding);
            
            if (similarity > 0.8) { // Higher threshold for better precision
                results.push({
                    url: embeddingData.url,
                    similarity: similarity
                });
            }
        });
        
        // Sort by similarity
        results.sort((a, b) => b.similarity - a.similarity);
        
        // Get content for top results and format them
        const formattedResults = [];
        for (const result of results.slice(0, 10)) {
            const content = await getStoredContentForUrl(result.url);
            if (content) {
                formattedResults.push({
                    id: `semantic-${Date.now()}-${Math.random()}`,
                    title: content.title || 'Untitled Page',
                    url: content.url,
                    snippet: content.content ? content.content.substring(0, 150) + '...' : 'No content available',
                    visitDate: content.extractedAt || new Date().toISOString(),
                    favicon: getFaviconUrl(content.url),
                    visitCount: 1,
                    relevanceScore: result.similarity,
                    matchType: 'semantic'
                });
            }
        }
        
        return formattedResults;
        
    } catch (error) {
        console.error('Semantic search error:', error);
        return [];
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
        
        // Try to capture screenshot if tabId is available
        if (extractedContent.tabId) {
            try {
                const screenshot = await capturePageScreenshot(extractedContent.tabId);
                if (screenshot) {
                    extractedContent.screenshot = screenshot;
                    console.log('Screenshot captured for:', extractedContent.url);
                }
            } catch (screenshotError) {
                console.log('Could not capture screenshot:', screenshotError.message);
            }
        }
        
        // Store the extracted content for future processing
        await storeExtractedContent(extractedContent);
        
        // Generate embeddings if OpenAI is configured
        if (openAIService.isReady()) {
            try {
                await generateEmbeddingsForStoredContent(extractedContent.url);
            } catch (error) {
                console.warn('Embeddings generation failed, continuing without:', error.message);
                // Continue without embeddings - the extension will still work with text search
            }
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
        
        // Clean up old content if we have too many items
        await cleanupOldContent();
        
    } catch (error) {
        console.error('Error storing extracted content:', error);
        throw error;
    }
}

// Extract content from a specific tab
async function extractContentFromTab(tabId) {
    try {
        // First, get tab information to check if content script can run
        const tab = await chrome.tabs.get(tabId);
        
        // Check if the URL is compatible with content scripts
        if (!isValidUrlForContentScript(tab.url)) {
            throw new Error(`Cannot extract content from ${tab.url} - content scripts not allowed on this type of page`);
        }
        
        // Check if content script is already injected
        try {
            const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            if (!response) {
                // Content script not present, inject it
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
            }
        } catch (injectionError) {
            // Content script not present, inject it
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
            } catch (secondError) {
                console.log('Failed to inject content script:', secondError);
            }
        }
        
        // Wait a moment for content script to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
        
        if (response && response.success) {
            await handleContentExtracted(response.content);
            return response.content;
        } else {
            throw new Error(response?.reason || 'Content extraction failed');
        }
        
    } catch (error) {
        console.error('Error extracting content from tab:', error);
        throw error;
    }
}

// Check if URL is valid for content script injection
function isValidUrlForContentScript(url) {
    if (!url) return false;
    
    const invalidPatterns = [
        /^chrome:/,
        /^chrome-extension:/,
        /^moz-extension:/,
        /^about:/,
        /^file:/,
        /^data:/,
        /^javascript:/
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(url));
}

// Capture screenshot of a tab
async function capturePageScreenshot(tabId) {
    try {
        // Make sure the tab is active and visible
        const tab = await chrome.tabs.get(tabId);
        if (!tab || tab.status !== 'complete') {
            throw new Error('Tab not ready for screenshot');
        }
        
        // Wait a bit more for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Double-check tab is still complete
        const updatedTab = await chrome.tabs.get(tabId);
        if (!updatedTab || updatedTab.status !== 'complete') {
            throw new Error('Tab status changed during wait');
        }
        
        // Capture visible tab with higher quality
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'jpeg',
            quality: 60  // Lower quality to reduce file size
        });
        
        // Convert to smaller thumbnail for storage efficiency
        const thumbnail = await createThumbnail(dataUrl, 250, 200);
        return thumbnail;
        
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        return null;
    }
}

// Create thumbnail from full screenshot
async function createThumbnail(dataUrl, maxWidth, maxHeight) {
    try {
        // Use OffscreenCanvas which is available in service workers
        const canvas = new OffscreenCanvas(maxWidth, maxHeight);
        const ctx = canvas.getContext('2d');
        
        // Convert data URL to ImageBitmap (works in service workers)
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        
        // Calculate scaling to fit within bounds while maintaining aspect ratio
        const scale = Math.min(maxWidth / imageBitmap.width, maxHeight / imageBitmap.height);
        const scaledWidth = imageBitmap.width * scale;
        const scaledHeight = imageBitmap.height * scale;
        
        // Center the image
        const x = (maxWidth - scaledWidth) / 2;
        const y = (maxHeight - scaledHeight) / 2;
        
        // Fill background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, maxWidth, maxHeight);
        
        // Draw scaled image
        ctx.drawImage(imageBitmap, x, y, scaledWidth, scaledHeight);
        
        // Convert to blob and then to data URL
        const thumbnailBlob = await canvas.convertToBlob({ 
            type: 'image/jpeg', 
            quality: 0.7 
        });
        
        // Convert blob to data URL
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(thumbnailBlob);
        });
        
    } catch (error) {
        console.error('Error creating thumbnail:', error);
        // Fallback: return original but warn about size
        console.warn('Using full-size image - storage may be impacted');
        return dataUrl;
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

// Clean up old content to prevent unlimited storage growth
async function cleanupOldContent() {
    try {
        const allData = await chrome.storage.local.get(null);
        const contentItems = [];
        
        // Collect all content items with timestamps
        Object.keys(allData).forEach(key => {
            if (key.startsWith('content_')) {
                const item = allData[key];
                if (item && item.storedAt) {
                    contentItems.push({
                        key: key,
                        storedAt: new Date(item.storedAt),
                        hasScreenshot: !!item.screenshot
                    });
                }
            }
        });
        
        // Keep only the 100 most recent items
        const maxItems = 100;
        if (contentItems.length > maxItems) {
            // Sort by date (newest first)
            contentItems.sort((a, b) => b.storedAt - a.storedAt);
            
            // Remove oldest items
            const itemsToRemove = contentItems.slice(maxItems);
            const keysToRemove = itemsToRemove.map(item => item.key);
            
            // Also remove corresponding embeddings
            const embeddingKeysToRemove = itemsToRemove.map(item => 
                item.key.replace('content_', 'embeddings_')
            );
            
            const allKeysToRemove = [...keysToRemove, ...embeddingKeysToRemove];
            await chrome.storage.local.remove(allKeysToRemove);
            
            console.log(`Cleaned up ${itemsToRemove.length} old content items`);
        }
        
    } catch (error) {
        console.error('Error cleaning up old content:', error);
    }
}

// Get stored content for a specific URL
async function getStoredContentForUrl(url) {
    try {
        const contentKey = `content_${url}`;
        const result = await chrome.storage.local.get([contentKey]);
        return result[contentKey] || null;
    } catch (error) {
        console.error('Error getting stored content for URL:', error);
        return null;
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