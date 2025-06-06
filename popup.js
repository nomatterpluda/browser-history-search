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
const previewContainer = document.getElementById('previewContainer');
const previewHeader = document.getElementById('previewHeader');
const previewContent = document.getElementById('previewContent');
const previewLoading = document.getElementById('previewLoading');

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
    
    // Hide preview when scrolling or clicking elsewhere
    document.addEventListener('scroll', hidePreview);
    document.addEventListener('click', (e) => {
        if (!previewContainer.contains(e.target) && !e.target.closest('.result-item')) {
            hidePreview();
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
    
    // Add hover preview functionality
    let hoverTimeout;
    
    resultDiv.addEventListener('mouseenter', (e) => {
        // Clear any existing timeout
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        
        // Set delay before showing preview (300ms as per PRD)
        hoverTimeout = setTimeout(() => {
            showPreview(result, resultDiv);
        }, 300);
    });
    
    resultDiv.addEventListener('mouseleave', () => {
        // Clear timeout if mouse leaves before preview shows
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        hidePreview();
    });
    
    return resultDiv;
}

// Preview functionality
let currentPreviewTimeout;

function showPreview(result, resultElement) {
    // Test if preview container exists
    if (!previewContainer) {
        console.error('Preview container not found!');
        return;
    }
    
    // Check if element still exists
    if (!resultElement || !resultElement.getBoundingClientRect) {
        console.error('Invalid result element for preview');
        return;
    }
    
    // Position preview to the right of the result item
    const rect = resultElement.getBoundingClientRect();
    const popupRect = document.body.getBoundingClientRect();
    
    console.log('Element rect:', rect);
    console.log('Popup rect:', popupRect);
    
    // Calculate position (to the right of result item)
    const left = rect.right + 10;
    const top = rect.top;
    
    // For popup extensions, position relative to viewport instead of popup bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Ensure preview stays within viewport
    const maxLeft = viewportWidth - 250 - 10; // 250px preview width + 10px margin
    const finalLeft = Math.min(left, maxLeft);
    const finalTop = Math.max(10, Math.min(top, viewportHeight - 200 - 10)); // 200px preview height
    
    console.log('Calculated position:', { finalLeft, finalTop });
    
    // Set position
    previewContainer.style.left = `${finalLeft}px`;
    previewContainer.style.top = `${finalTop}px`;
    
    // Set header content
    previewHeader.textContent = result.title || result.url;
    
    // Reset content with loading message
    previewContent.innerHTML = '<div class="preview-loading">Loading preview...</div>';
    
    // Show preview container
    previewContainer.classList.remove('hidden');
    previewContainer.style.display = 'block';
    
    console.log('Preview container should now be visible');
    console.log('Preview container classes:', previewContainer.className);
    
    // Trigger animation
    setTimeout(() => {
        previewContainer.classList.add('visible');
        console.log('Added visible class to preview');
    }, 10);
    
    // Load preview content
    loadPreviewContent(result);
}

function hidePreview() {
    if (currentPreviewTimeout) {
        clearTimeout(currentPreviewTimeout);
    }
    
    previewContainer.classList.remove('visible');
    
    // Hide after animation completes
    setTimeout(() => {
        previewContainer.classList.add('hidden');
    }, 200);
}

async function loadPreviewContent(result) {
    try {
        // First, try to load screenshot if available
        const screenshot = await getStoredScreenshot(result.url);
        if (screenshot) {
            console.log('📸 Loading screenshot for:', result.title);
            showScreenshotPreview(screenshot, result);
            return;
        }
        
        // Check if URL is likely to work in iframe
        if (isIframeBlocked(result.url)) {
            showPreviewFallback(result);
            return;
        }
        
        // Try to load as iframe for live preview
        const iframe = document.createElement('iframe');
        iframe.className = 'preview-content';
        iframe.src = result.url;
        iframe.sandbox = 'allow-same-origin';
        iframe.loading = 'lazy';
        
        // Set loading timeout (shorter for better UX)
        const loadTimeout = setTimeout(() => {
            console.log('⏰ Preview timeout, showing fallback');
            showPreviewFallback(result);
        }, 3000);
        
        iframe.onerror = () => {
            clearTimeout(loadTimeout);
            console.log('🔄 Iframe failed, showing fallback for:', result.title);
            showPreviewFallback(result);
        };
        
        // Also handle X-Frame-Options errors
        iframe.onload = () => {
            clearTimeout(loadTimeout);
            try {
                // Test if iframe content is accessible
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (!iframeDoc) {
                    console.log('🔄 Iframe blocked by X-Frame-Options, showing fallback');
                    showPreviewFallback(result);
                    return;
                }
                console.log('✅ Iframe loaded successfully');
                previewContent.innerHTML = '';
                previewContent.appendChild(iframe);
            } catch (e) {
                console.log('🔄 Iframe CORS/security error, showing fallback:', e.message);
                // Remove the failed iframe first
                previewContent.innerHTML = '';
                showPreviewFallback(result);
            }
        };
        
        // Start loading iframe
        previewContent.innerHTML = '';
        previewContent.appendChild(iframe);
        
    } catch (error) {
        console.error('Error loading preview:', error);
        showPreviewFallback(result);
    }
}

function isIframeBlocked(url) {
    // Common sites that block iframe embedding
    const blockedDomains = [
        'google.com',
        'youtube.com',
        'facebook.com',
        'twitter.com',
        'instagram.com',
        'linkedin.com',
        'github.com',
        'stackoverflow.com',
        'apple.com',
        'microsoft.com',
        'amazon.com'
    ];
    
    try {
        const domain = new URL(url).hostname.toLowerCase();
        return blockedDomains.some(blocked => domain.includes(blocked));
    } catch (e) {
        return true; // Invalid URL
    }
}

function showPreviewFallback(result) {
    console.log('📝 showPreviewFallback called for:', result.title);
    console.log('📝 Result snippet:', result.snippet);
    
    // Show content snippet as fallback
    const fallbackHTML = `
        <div style="padding: 16px; font-size: 12px; line-height: 1.4; color: #333; background: #f8f9fa; height: 100%; box-sizing: border-box;">
            <div style="font-weight: 500; margin-bottom: 8px; color: #1a73e8;">📄 Content Preview:</div>
            <div style="color: #5f6368; margin-bottom: 12px;">${escapeHtml(result.snippet || 'No content preview available')}</div>
            <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid #e8eaed; font-size: 11px; color: #9aa0a6;">
                🔗 Click to visit: ${escapeHtml(result.url)}
            </div>
        </div>
    `;
    
    previewContent.innerHTML = fallbackHTML;
    console.log('📝 Fallback content set');
}

// Get stored screenshot for a URL
async function getStoredScreenshot(url) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_STORED_CONTENT',
            url: url
        });
        
        if (response.success && response.content && response.content.screenshot) {
            return response.content.screenshot;
        }
        return null;
    } catch (error) {
        console.log('Could not get stored screenshot:', error);
        return null;
    }
}

// Show screenshot preview
function showScreenshotPreview(screenshot, result) {
    console.log('📸 Displaying screenshot preview');
    
    const screenshotHTML = `
        <div style="height: 100%; display: flex; flex-direction: column;">
            <img src="${screenshot}" 
                 class="preview-screenshot" 
                 alt="Page preview"
                 style="flex: 1; width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); color: white; padding: 8px; font-size: 11px;">
                📸 Screenshot preview
            </div>
        </div>
    `;
    
    previewContent.innerHTML = screenshotHTML;
    console.log('📸 Screenshot preview displayed');
}

function showPreviewError(message) {
    previewContent.innerHTML = `
        <div class="preview-error">
            <div>⚠️</div>
            <div>${escapeHtml(message)}</div>
            <div style="margin-top: 8px; font-size: 10px;">Click result to visit page</div>
        </div>
    `;
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