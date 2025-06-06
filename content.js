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

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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