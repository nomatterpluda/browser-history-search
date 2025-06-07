// Content script for extracting page content
// Prevent multiple injections
if (window.browserHistorySearchContentScript) {
    console.log('Content script already loaded, skipping');
} else {
    window.browserHistorySearchContentScript = true;
    console.log('Browser History Search content script loaded');

// Configuration for content extraction
if (!window.EXTRACTION_CONFIG) {
    window.EXTRACTION_CONFIG = {
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
}

// ========================================
// SEARCH OVERLAY FUNCTIONALITY
// ========================================

class SearchOverlay {
    constructor() {
        this.overlay = null;
        this.searchInput = null;
        this.resultsContainer = null;
        this.isVisible = false;
        this.searchTimeout = null;
        this.currentResults = [];
        this.selectedIndex = -1;
        
        this.initializeOverlay();
        this.setupEventListeners();
    }
    
    initializeOverlay() {
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'browser-history-search-overlay';
        this.overlay.innerHTML = `
            <div class="search-overlay-backdrop"></div>
            <div class="search-container">
                <div class="search-box">
                    <div class="search-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </div>
                    <input type="text" class="search-input" placeholder="Search your browsing history..." autocomplete="off" spellcheck="false">
                    <div class="search-shortcut">⌘K</div>
                </div>
                <div class="search-results"></div>
                <div class="search-footer">
                    <div class="search-tips">
                        <span class="tip"><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
                        <span class="tip"><kbd>↵</kbd> Open</span>
                        <span class="tip"><kbd>Esc</kbd> Close</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.addStyles();
        
        // Get references
        this.searchInput = this.overlay.querySelector('.search-input');
        this.resultsContainer = this.overlay.querySelector('.search-results');
        
        // Hide initially
        this.overlay.style.display = 'none';
        document.body.appendChild(this.overlay);
    }
    
    addStyles() {
        if (document.getElementById('browser-history-search-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'browser-history-search-styles';
        styles.type = 'text/css';
        styles.textContent = `
            #browser-history-search-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 2147483647;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 15vh;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                opacity: 0;
                transform: scale(0.95);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            #browser-history-search-overlay.visible {
                opacity: 1;
                transform: scale(1);
            }
            
            .search-overlay-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
            }
            
            .search-container {
                position: relative;
                width: 90%;
                max-width: 640px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 16px;
                box-shadow: 
                    0 20px 40px rgba(0, 0, 0, 0.1),
                    0 8px 16px rgba(0, 0, 0, 0.08),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4);
                overflow: hidden;
                transform: translateY(0);
                transition: transform 0.2s ease;
            }
            
            .search-box {
                display: flex;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                background: rgba(255, 255, 255, 0.8);
            }
            
            .search-icon {
                color: #6b7280;
                margin-right: 12px;
                flex-shrink: 0;
            }
            
            .search-input {
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                font-size: 18px;
                color: #1f2937;
                font-weight: 400;
                line-height: 1.5;
            }
            
            .search-input::placeholder {
                color: #9ca3af;
            }
            
            .search-shortcut {
                background: rgba(0, 0, 0, 0.05);
                color: #6b7280;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                border: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .search-results {
                max-height: 400px;
                overflow-y: auto;
                background: rgba(255, 255, 255, 0.9);
            }
            
            .search-result {
                display: flex;
                align-items: center;
                padding: 12px 24px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.04);
                cursor: pointer;
                transition: all 0.15s ease;
                position: relative;
            }
            
            .search-result:hover,
            .search-result.selected {
                background: rgba(59, 130, 246, 0.08);
                border-left: 3px solid #3b82f6;
                padding-left: 21px;
            }
            
            .search-result:last-child {
                border-bottom: none;
            }
            
            .result-favicon {
                width: 20px;
                height: 20px;
                margin-right: 12px;
                border-radius: 4px;
                flex-shrink: 0;
                background: #f3f4f6;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                color: #6b7280;
                font-weight: 600;
            }
            
            .result-content {
                flex: 1;
                min-width: 0;
            }
            
            .result-title {
                font-size: 16px;
                font-weight: 500;
                color: #1f2937;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .result-url {
                font-size: 13px;
                color: #6b7280;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 2px;
            }
            
            .result-snippet {
                font-size: 13px;
                color: #9ca3af;
                line-height: 1.4;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            
            .result-date {
                font-size: 12px;
                color: #9ca3af;
                margin-left: 12px;
                flex-shrink: 0;
            }
            
            .search-footer {
                padding: 12px 24px;
                background: rgba(249, 250, 251, 0.8);
                border-top: 1px solid rgba(0, 0, 0, 0.06);
            }
            
            .search-tips {
                display: flex;
                gap: 16px;
                font-size: 12px;
                color: #6b7280;
            }
            
            .tip kbd {
                background: rgba(0, 0, 0, 0.05);
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 3px;
                padding: 2px 4px;
                font-size: 10px;
                margin: 0 2px;
            }
            
            .no-results {
                padding: 40px 24px;
                text-align: center;
                color: #6b7280;
            }
            
            .no-results-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }
            
            .loading {
                padding: 20px 24px;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
            }
            
            .loading::after {
                content: '';
                display: inline-block;
                width: 12px;
                height: 12px;
                border: 2px solid #e5e7eb;
                border-top: 2px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-left: 8px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .search-container {
                    background: rgba(31, 41, 55, 0.95);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                
                .search-box {
                    background: rgba(31, 41, 55, 0.8);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                
                .search-input {
                    color: #f9fafb;
                }
                
                .search-input::placeholder {
                    color: #6b7280;
                }
                
                .search-results {
                    background: rgba(31, 41, 55, 0.9);
                }
                
                .result-title {
                    color: #f9fafb;
                }
                
                .search-footer {
                    background: rgba(17, 24, 39, 0.8);
                    border-color: rgba(255, 255, 255, 0.1);
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd+K or Ctrl+K to open
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
                return;
            }
            
            // Handle overlay-specific shortcuts
            if (this.isVisible) {
                switch (e.key) {
                    case 'Escape':
                        e.preventDefault();
                        this.hide();
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        this.selectNext();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        this.selectPrevious();
                        break;
                    case 'Enter':
                        e.preventDefault();
                        this.openSelected();
                        break;
                }
            }
        });
        
        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay || e.target.classList.contains('search-overlay-backdrop')) {
                this.hide();
            }
        });
        
        // Search input
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        // Result clicks
        this.resultsContainer.addEventListener('click', (e) => {
            const result = e.target.closest('.search-result');
            if (result) {
                const url = result.dataset.url;
                if (url) {
                    this.openUrl(url);
                }
            }
        });
    }
    
    show() {
        if (this.isVisible) return;
        
        this.overlay.style.display = 'flex';
        this.isVisible = true;
        
        // Trigger animation
        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
            this.searchInput.focus();
        });
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
    
    hide() {
        if (!this.isVisible) return;
        
        this.overlay.classList.remove('visible');
        this.isVisible = false;
        
        setTimeout(() => {
            this.overlay.style.display = 'none';
            document.body.style.overflow = '';
        }, 200);
        
        // Clear search
        this.searchInput.value = '';
        this.resultsContainer.innerHTML = '';
        this.selectedIndex = -1;
        this.currentResults = [];
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        
        if (!query.trim()) {
            this.resultsContainer.innerHTML = '';
            return;
        }
        
        // Show loading
        this.resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300);
    }
    
    async performSearch(query) {
        try {
            // Send search request to background script
            const response = await chrome.runtime.sendMessage({
                type: 'SEARCH_HISTORY',
                query: query
            });
            
            if (response && response.success) {
                this.displayResults(response.results);
            } else {
                this.displayNoResults();
            }
        } catch (error) {
            console.error('Search error:', error);
            this.displayError();
        }
    }
    
    displayResults(results) {
        this.currentResults = results;
        this.selectedIndex = -1;
        
        if (results.length === 0) {
            this.displayNoResults();
            return;
        }
        
        const html = results.map((result, index) => `
            <div class="search-result" data-url="${result.url}" data-index="${index}">
                <div class="result-favicon">
                    ${result.favicon ? `<img src="${result.favicon}" width="20" height="20" alt="">` : this.getGenericFavicon(result.url)}
                </div>
                <div class="result-content">
                    <div class="result-title">${this.escapeHtml(result.title || 'Untitled')}</div>
                    <div class="result-url">${this.escapeHtml(result.url)}</div>
                    ${result.snippet ? `<div class="result-snippet">${this.escapeHtml(result.snippet)}</div>` : ''}
                </div>
                <div class="result-date">${this.formatDate(result.lastVisitTime)}</div>
            </div>
        `).join('');
        
        this.resultsContainer.innerHTML = html;
    }
    
    displayNoResults() {
        this.resultsContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <div>No results found</div>
            </div>
        `;
    }
    
    displayError() {
        this.resultsContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">⚠️</div>
                <div>Search error occurred</div>
            </div>
        `;
    }
    
    selectNext() {
        if (this.currentResults.length === 0) return;
        
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
        this.updateSelection();
    }
    
    selectPrevious() {
        if (this.currentResults.length === 0) return;
        
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection();
    }
    
    updateSelection() {
        const results = this.resultsContainer.querySelectorAll('.search-result');
        results.forEach((result, index) => {
            result.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // Scroll selected item into view
        if (this.selectedIndex >= 0) {
            const selectedResult = results[this.selectedIndex];
            if (selectedResult) {
                selectedResult.scrollIntoView({ block: 'nearest' });
            }
        }
    }
    
    openSelected() {
        if (this.selectedIndex >= 0 && this.currentResults[this.selectedIndex]) {
            const url = this.currentResults[this.selectedIndex].url;
            this.openUrl(url);
        }
    }
    
    openUrl(url) {
        window.open(url, '_blank');
        this.hide();
    }
    
    getGenericFavicon(url) {
        try {
            const domain = new URL(url).hostname;
            const letter = domain.charAt(0).toUpperCase();
            return letter;
        } catch {
            return '🌐';
        }
    }
    
    formatDate(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize search overlay
let searchOverlay = null;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSearchOverlay);
} else {
    initializeSearchOverlay();
}

function initializeSearchOverlay() {
    // Only initialize on regular web pages, not extension pages
    if (window.location.protocol === 'chrome-extension:' || 
        window.location.protocol === 'moz-extension:' ||
        window.location.protocol === 'chrome:') {
        return;
    }
    
    if (!searchOverlay) {
        searchOverlay = new SearchOverlay();
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_SEARCH_OVERLAY') {
        if (searchOverlay) {
            searchOverlay.toggle();
            sendResponse({ success: true });
        } else {
            console.log('Search overlay not initialized yet, initializing...');
            initializeSearchOverlay();
            setTimeout(() => {
                if (searchOverlay) {
                    searchOverlay.toggle();
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Could not initialize overlay' });
                }
            }, 100);
        }
        return true; // Keep message channel open for async response
    }
    
    if (message.type === 'PING') {
        sendResponse({ success: true });
        return;
    }
    
    if (message.type === 'EXTRACT_CONTENT') {
        console.log('Content extraction requested');
        
        if (!shouldProcessPage()) {
            sendResponse({ success: false, reason: 'Page not suitable for processing' });
            return;
        }
        
        const extractedContent = extractPageContent();
        
        if (extractedContent) {
            sendResponse({ success: true, content: extractedContent });
        } else {
            sendResponse({ success: false, reason: 'Failed to extract content' });
        }
    }
});

// ========================================
// EXISTING CONTENT EXTRACTION FUNCTIONALITY
// ========================================

// Extract meaningful text content from the page
function extractPageContent() {
    try {
        // Get page title
        const title = document.title || '';
        
        // Get meta description
        const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
        
        // Extract main content
        const mainContent = extractMainText();
        
        // Combine and clean content
        const combinedContent = `${title} ${metaDescription} ${mainContent}`.trim();
        const cleanedContent = cleanText(combinedContent);
        
        // Validate content length
        if (cleanedContent.length < window.EXTRACTION_CONFIG.minTextLength) {
            console.log('Page content too short, skipping extraction');
            return null;
        }
        
        // Truncate if too long
        const finalContent = cleanedContent.length > window.EXTRACTION_CONFIG.maxTextLength 
            ? cleanedContent.substring(0, window.EXTRACTION_CONFIG.maxTextLength) + '...'
            : cleanedContent;
            
        return {
            url: window.location.href,
            title: title,
            content: finalContent,
            extractedAt: new Date().toISOString(),
            contentLength: finalContent.length
        };
        
    } catch (error) {
        console.error('Error extracting page content:', error);
        return null;
    }
}

// Extract main text content from the page
function extractMainText() {
    // Try to find main content areas first
    const mainSelectors = [
        'main',
        'article', 
        '[role="main"]',
        '.main-content',
        '.content',
        '.post-content',
        '.entry-content',
        '#content',
        '#main'
    ];
    
    let mainElement = null;
    for (const selector of mainSelectors) {
        mainElement = document.querySelector(selector);
        if (mainElement) break;
    }
    
    // Fallback to body if no main content area found
    const targetElement = mainElement || document.body;
    
    if (!targetElement) return '';
    
    // Clone the element to avoid modifying the original page
    const clonedElement = targetElement.cloneNode(true);
    
    // Remove unwanted elements
    window.EXTRACTION_CONFIG.excludeSelectors.forEach(selector => {
        const elements = clonedElement.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    });
    
    // Extract text content
    return clonedElement.textContent || clonedElement.innerText || '';
}

// Clean and normalize text content
function cleanText(text) {
    return text
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove special characters but keep basic punctuation
        .replace(/[^\w\s.,!?;:()\-]/g, ' ')
        // Remove multiple spaces
        .replace(/\s{2,}/g, ' ')
        // Trim
        .trim();
}

// Check if page should be processed
function shouldProcessPage() {
    const url = window.location.href;
    
    // Skip certain types of pages
    const skipPatterns = [
        /^chrome:/,
        /^chrome-extension:/,
        /^moz-extension:/,
        /^about:/,
        /^file:/,
        /localhost/,
        /127\.0\.0\.1/,
        /\.local$/,
        /\.(pdf|jpg|jpeg|png|gif|svg|mp4|mp3|zip|exe)$/i
    ];
    
    if (skipPatterns.some(pattern => pattern.test(url))) {
        return false;
    }
    
    // Skip if page is too small (likely not content)
    const bodyText = document.body?.textContent || '';
    if (bodyText.length < window.EXTRACTION_CONFIG.minTextLength) {
        return false;
    }
    
    return true;
}

// Auto-extract content when page loads (for future processing)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(autoExtractContent, 2000); // Wait 2 seconds for dynamic content
    });
} else {
    setTimeout(autoExtractContent, 2000);
}

// Automatically extract content for processing
function autoExtractContent() {
    if (!shouldProcessPage()) return;
    
    const extractedContent = extractPageContent();
    if (extractedContent) {
        // Get current tab ID and add it to content
        chrome.runtime.sendMessage({
            type: 'GET_CURRENT_TAB_ID'
        }).then(response => {
            if (response && response.tabId) {
                extractedContent.tabId = response.tabId;
            }
            
            // Send to background script for processing
            chrome.runtime.sendMessage({
                type: 'CONTENT_EXTRACTED',
                content: extractedContent
            }).catch(error => {
                console.log('Background script not ready, content extraction skipped');
            });
        }).catch(error => {
            // Send without tabId if we can't get it
            chrome.runtime.sendMessage({
                type: 'CONTENT_EXTRACTED',
                content: extractedContent
            }).catch(error => {
                console.log('Background script not ready, content extraction skipped');
            });
        });
    }
}

} // End of guard to prevent multiple injections