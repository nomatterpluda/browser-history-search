// OpenAI API Service for Browser History Search extension

class OpenAIService {
    constructor() {
        this.apiKey = null;
        this.isInitialized = false;
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    // Initialize the service with API key
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

    // Set API key
    async setApiKey(apiKey) {
        try {
            if (!apiKey || typeof apiKey !== 'string') {
                throw new Error('Invalid API key');
            }

            // Test the API key with a small request
            const testResult = await this.testApiKey(apiKey);
            if (!testResult.success) {
                throw new Error(testResult.error);
            }

            // Save the API key
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

    // Test API key validity
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

    // Generate embeddings for text content
    async generateEmbeddings(text) {
        if (!this.isInitialized || !this.apiKey) {
            throw new Error('OpenAI service not initialized or API key missing');
        }

        if (!text || text.trim().length === 0) {
            throw new Error('Text content is required');
        }

        // Truncate text if too long
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

    // Generate embeddings for multiple texts (batch processing)
    async generateBatchEmbeddings(texts) {
        if (!Array.isArray(texts) || texts.length === 0) {
            throw new Error('Texts array is required');
        }

        const results = [];
        const batchSize = OPENAI_CONFIG.batchSize;
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const truncatedBatch = batch.map(text => this.truncateText(text));
            
            try {
                const response = await this.makeApiRequest({
                    model: OPENAI_CONFIG.model,
                    input: truncatedBatch
                });

                if (response.data) {
                    results.push(...response.data.map(item => item.embedding));
                }
                
                // Rate limiting delay
                if (i + batchSize < texts.length) {
                    await this.delay(OPENAI_CONFIG.rateLimitDelay);
                }
                
            } catch (error) {
                console.error(`Error in batch ${i}-${i + batchSize}:`, error);
                // Continue with next batch instead of failing completely
                results.push(...new Array(batch.length).fill(null));
            }
        }
        
        return results;
    }

    // Make API request with retry logic
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
                
                // Handle rate limiting
                if (response.status === 429 && retryCount < OPENAI_CONFIG.maxRetries) {
                    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
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

    // Truncate text to fit within token limits
    truncateText(text) {
        if (text.length <= CONTENT_CONFIG.maxContentLength) {
            return text;
        }
        
        // Simple truncation - could be improved with proper tokenization
        return text.substring(0, CONTENT_CONFIG.maxContentLength) + '...';
    }

    // Utility functions
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

    // Check if service is ready
    isReady() {
        return this.isInitialized && this.apiKey;
    }

    // Get API usage statistics
    getUsageStats() {
        // This could be expanded to track API usage, costs, etc.
        return {
            isConfigured: !!this.apiKey,
            isReady: this.isReady()
        };
    }
}

// Create singleton instance
const openAIService = new OpenAIService();

// Auto-initialize when script loads
if (typeof chrome !== 'undefined' && chrome.storage) {
    openAIService.initialize().catch(console.error);
} 