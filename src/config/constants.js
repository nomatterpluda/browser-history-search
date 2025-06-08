// Centralized configuration constants for Browser History Search extension
// All configuration objects extracted from background.js for better maintainability

export const OPENAI_CONFIG = {
    apiUrl: 'https://api.openai.com/v1/embeddings',
    model: 'text-embedding-ada-002',
    maxTokens: 8191,
    batchSize: 10,
    rateLimitDelay: 1000,
    maxRetries: 3
};

export const CONTENT_CONFIG = {
    maxContentLength: 5000,
    minContentLength: 50,
    chunkSize: 3000,
    overlapSize: 200,
    minTimeForExtraction: 30000 // 30 seconds minimum time on page before extraction
};

export const STORAGE_CONFIG = {
    embeddingsPrefix: 'embeddings_',
    contentPrefix: 'content_',
    settingsKey: 'settings',
    statsKey: 'stats',
    maxStorageItems: 1000
};

export const SEARCH_CONFIG = {
    similarityThreshold: 0.7,
    maxResults: 50,
    boostRecentPages: true,
    recencyBoostFactor: 0.1
};

// UI Configuration constants
export const UI_CONFIG = {
    searchDelay: 300, // ms - debounce delay for search input
    previewDelay: 300, // ms - delay before showing hover preview
    maxPreviewWidth: 250, // px
    maxPreviewHeight: 200, // px
    resultsPerPage: 20
};

// Content extraction configuration (from content.js)
export const EXTRACTION_CONFIG = {
    maxTextLength: 5000, // Limit text to avoid API costs
    minTextLength: 50,   // Skip pages with very little content
    excludeSelectors: [
        'script',
        'style', 
        'nav',
        'header',
        'footer',
        '.advertisement',
        '.ads',
        '.sidebar',
        '.menu',
        '.navigation'
    ]
}; 