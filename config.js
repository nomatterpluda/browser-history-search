// Configuration for Browser History Search extension

// OpenAI API Configuration
const OPENAI_CONFIG = {
    apiUrl: 'https://api.openai.com/v1/embeddings',
    model: 'text-embedding-ada-002', // As specified in PRD
    maxTokens: 8191, // Max tokens for ada-002 model
    batchSize: 10, // Process embeddings in batches
    rateLimitDelay: 1000, // 1 second between requests to respect rate limits
    maxRetries: 3
};

// Content Processing Configuration
const CONTENT_CONFIG = {
    maxContentLength: 5000, // Limit content to avoid API costs
    minContentLength: 50,
    chunkSize: 3000, // Split large content into chunks
    overlapSize: 200 // Overlap between chunks for context
};

// Storage Configuration
const STORAGE_CONFIG = {
    embeddingsPrefix: 'embeddings_',
    contentPrefix: 'content_',
    settingsKey: 'settings',
    statsKey: 'stats',
    maxStorageItems: 1000 // Prevent unlimited storage growth
};

// Search Configuration
const SEARCH_CONFIG = {
    similarityThreshold: 0.7, // Minimum similarity score for results
    maxResults: 10,
    boostRecentPages: true, // Give higher scores to recently visited pages
    recencyBoostFactor: 0.1
};

// Export configuration (for use in other scripts)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OPENAI_CONFIG,
        CONTENT_CONFIG,
        STORAGE_CONFIG,
        SEARCH_CONFIG
    };
} 