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
        this.isLoading = false;
        this.hasMoreResults = true;
        this.currentQuery = '';
        this.currentPage = 0;
        this.resultsPerPage = 20;
        
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
                     <div class="search-actions">
                         <button class="settings-button" title="Settings">
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                 <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
                             </svg>
                         </button>
                         <div class="search-shortcut">⌘K</div>
                     </div>
                 </div>
                 <div class="search-results"></div>
                 <div class="settings-panel">
                     <div class="settings-header">
                         <h3>Settings</h3>
                         <button class="close-settings">×</button>
                     </div>
                     <div class="settings-content">
                         <div class="setting-group">
                             <label for="openai-api-key">OpenAI API Key</label>
                             <div class="api-key-input-group">
                                 <input type="password" id="openai-api-key" placeholder="sk-..." class="api-key-input">
                                 <button class="test-api-key" disabled>Test</button>
                             </div>
                             <div class="api-key-status"></div>
                             <p class="setting-description">
                                 Add your OpenAI API key for enhanced semantic search. 
                                 <a href="https://platform.openai.com/api-keys" target="_blank">Get API key</a>
                             </p>
                         </div>
                         <div class="setting-group">
                             <div class="setting-toggle-row">
                                 <div class="setting-toggle-info">
                                     <label for="ai-optimization-toggle">Smart AI Processing</label>
                                     <p class="setting-description">
                                         Process only meaningful pages (30s+ visit, 500+ words). Reduces costs by ~90%.
                                     </p>
                                 </div>
                                 <label class="ios-toggle">
                                     <input type="checkbox" id="ai-optimization-toggle" checked>
                                     <span class="ios-slider"></span>
                                 </label>
                             </div>
                         </div>
                         <div class="setting-group">
                             <label>Search Statistics</label>
                             <div class="stats-display">
                                 <div class="stat-item">
                                     <span class="stat-label">Pages indexed:</span>
                                     <span class="stat-value" id="pages-count">-</span>
                                 </div>
                                 <div class="stat-item">
                                     <span class="stat-label">AI Embeddings:</span>
                                     <span class="stat-value" id="embeddings-count">-</span>
                                 </div>
                                 <div class="stat-item">
                                     <span class="stat-label">Last updated:</span>
                                     <span class="stat-value" id="last-updated">-</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
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
        this.settingsPanel = this.overlay.querySelector('.settings-panel');
        this.settingsButton = this.overlay.querySelector('.settings-button');
        this.closeSettingsButton = this.overlay.querySelector('.close-settings');
        this.apiKeyInput = this.overlay.querySelector('.api-key-input');
        this.testApiKeyButton = this.overlay.querySelector('.test-api-key');
        this.apiKeyStatus = this.overlay.querySelector('.api-key-status');
        this.aiOptimizationToggle = this.overlay.querySelector('#ai-optimization-toggle');
        
        // Hide initially
        this.overlay.style.display = 'none';
        document.body.appendChild(this.overlay);
        
        // Load settings
        this.loadSettings();
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
                opacity: 0;
                transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            #browser-history-search-overlay.visible .search-overlay-backdrop {
                opacity: 1;
            }
            
            .search-container {
                position: relative;
                width: 90%;
                max-width: 640px;
                height: 500px;
                border-radius: 20px;
                border: 1px solid rgba(0, 0, 0, 0.12);
                background: rgba(37, 37, 37, 0.80);
                box-shadow: 0px 8px 57px 0px rgba(0, 0, 0, 0.30);
                backdrop-filter: blur(42px);
                -webkit-backdrop-filter: blur(42px);
                overflow: hidden;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), 
                           transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                flex-direction: column;
            }
            
            #browser-history-search-overlay.visible .search-container {
                opacity: 1;
                transform: scale(1);
                transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, 
                           transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
            }
            
            .search-box {
                display: flex;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                background: transparent;
            }
            
            .search-icon {
                color: #9ca3af;
                margin-right: 12px;
                flex-shrink: 0;
            }
            
            .search-input {
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                font-size: 18px;
                color: #f9fafb;
                font-weight: 400;
                line-height: 1.5;
            }
            
            .search-input::placeholder {
                color: #6b7280;
            }
            
            .search-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .settings-button {
                background: transparent;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                padding: 6px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
            }
            
            .settings-button:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #d1d5db;
            }
            
            .search-shortcut {
                background: rgba(255, 255, 255, 0.1);
                color: #9ca3af;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .search-results {
                flex: 1;
                overflow-y: auto;
                background: transparent;
                min-height: 0;
            }
            
            .search-result {
                display: flex;
                align-items: center;
                padding: 12px 24px;
                cursor: pointer;
                transition: all 0.15s ease;
                position: relative;
                margin: 0 9px;
                border-radius: 10px;
            }
            
            .search-result:hover:not(.selected),
            .search-result.selected {
                background: rgba(14, 14, 14, 0.25);
                box-shadow: 0px 4px 9px 0px rgba(0, 0, 0, 0.10);
            }
            

            
            .result-favicon {
                width: 16px;
                height: 16px;
                margin-right: 12px;
                border-radius: 3px;
                flex-shrink: 0;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                color: #374151;
                font-weight: 600;
            }
            
            .result-content {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            
            .result-title-line {
                display: flex;
                align-items: center;
                gap: 8px;
                overflow: hidden;
                width: 100%;
            }
            
            .result-title {
                font-size: 16px;
                font-weight: 500;
                color: white;
                flex-shrink: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .result-url {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
                flex-shrink: 2;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .result-date {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.8);
                margin-left: 16px;
                flex-shrink: 0;
                white-space: nowrap;
                min-width: 120px;
                text-align: right;
            }
            
            /* Screenshot Preview Styles */
            .screenshot-preview-container {
                position: fixed;
                width: 250px;
                background-color: white;
                border: 1px solid #dadce0;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                z-index: 2147483648;
                overflow: hidden;
                pointer-events: none;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            
            .screenshot-preview-container.visible {
                opacity: 1;
                transform: scale(1);
            }
            
            .screenshot-preview-image {
                display: block;
                width: 250px;
                object-fit: contain;
                background-color: #f8f9fa;
                border-radius: 8px;
            }
            
            .screenshot-preview-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100px;
                color: #5f6368;
                font-size: 14px;
                background-color: #f8f9fa;
            }
            
            .search-footer {
                padding: 12px 24px;
                background: transparent;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                flex-shrink: 0;
            }
            
            .search-tips {
                display: flex;
                gap: 16px;
                font-size: 12px;
                color: #9ca3af;
            }
            
            .tip kbd {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 3px;
                padding: 2px 4px;
                font-size: 10px;
                margin: 0 2px;
                color: #d1d5db;
            }
            
            .no-results {
                padding: 40px 24px;
                text-align: center;
                color: #9ca3af;
            }
            
            .no-results-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }
            
            .loading {
                padding: 20px 24px;
                text-align: center;
                color: #9ca3af;
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
            
            .settings-panel {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(37, 37, 37, 0.98);
                backdrop-filter: blur(42px);
                -webkit-backdrop-filter: blur(42px);
                border-radius: 20px;
                display: none;
                flex-direction: column;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .settings-panel.visible {
                display: flex;
                opacity: 1;
                transform: translateY(0);
            }
            
            .settings-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                flex-shrink: 0;
            }
            
            .settings-header h3 {
                margin: 0;
                color: #f9fafb;
                font-size: 18px;
                font-weight: 600;
            }
            
            .close-settings {
                background: transparent;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                font-size: 20px;
                padding: 6px;
                border-radius: 6px;
                transition: all 0.15s ease;
                line-height: 1;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .close-settings:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #d1d5db;
            }
            
            .settings-content {
                flex: 1;
                padding: 24px;
                overflow-y: auto;
                min-height: 0;
            }
            
            .setting-group {
                margin-bottom: 32px;
            }
            
            .setting-group:last-child {
                margin-bottom: 0;
            }
            
            .setting-group label {
                display: block;
                color: #f9fafb;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 12px;
            }
            
            .api-key-input-group {
                display: flex;
                gap: 12px;
                margin-bottom: 12px;
            }
            
            .api-key-input {
                flex: 1;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                padding: 14px 18px;
                color: #f9fafb;
                font-size: 15px;
                outline: none;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                font-weight: 400;
                min-height: 48px;
                box-sizing: border-box;
            }
            
            .api-key-input:focus {
                border-color: rgba(59, 130, 246, 0.6);
                background: rgba(255, 255, 255, 0.06);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            
            .api-key-input::placeholder {
                color: #6b7280;
            }
            
            .test-api-key {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                border: none;
                color: white;
                padding: 14px 24px;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
                min-height: 48px;
                box-sizing: border-box;
                white-space: nowrap;
            }
            
            .test-api-key:hover:not(:disabled) {
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            
            .test-api-key:disabled {
                background: rgba(255, 255, 255, 0.08);
                color: #6b7280;
                cursor: not-allowed;
                box-shadow: none;
                transform: none;
            }
            
            .api-key-status {
                font-size: 14px;
                margin-bottom: 12px;
                min-height: 20px;
                font-weight: 500;
            }
            
            .api-key-status.success {
                color: #10b981;
            }
            
            .api-key-status.error {
                color: #ef4444;
            }
            
            .setting-description {
                font-size: 14px;
                color: #9ca3af;
                margin: 0;
                line-height: 1.5;
            }
            
            .setting-description a {
                color: #3b82f6;
                text-decoration: none;
            }
            
            .setting-description a:hover {
                text-decoration: underline;
            }
            
            .stats-display {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                padding: 24px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            
            .stat-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding: 12px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .stat-item:last-child {
                margin-bottom: 0;
                border-bottom: none;
            }
            
            .stat-label {
                color: #9ca3af;
                font-size: 15px;
                font-weight: 500;
            }
            
            .stat-value {
                color: #f9fafb;
                font-size: 15px;
                font-weight: 600;
            }
            
            .setting-toggle-row {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 20px;
            }
            
            .setting-toggle-info {
                flex: 1;
            }
            
            .setting-toggle-info label {
                margin-bottom: 8px;
            }
            
            .ios-toggle {
                position: relative;
                display: inline-block;
                width: 51px;
                height: 31px;
                flex-shrink: 0;
                margin-top: 2px;
            }
            
            .ios-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .ios-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #39393d;
                border-radius: 31px;
                transition: all 0.25s ease;
                box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.1);
            }
            
            .ios-slider:before {
                position: absolute;
                content: "";
                height: 27px;
                width: 27px;
                left: 2px;
                top: 2px;
                background: #ffffff;
                border-radius: 50%;
                transition: all 0.25s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1);
            }
            
            .ios-toggle input:checked + .ios-slider {
                background: #34c759;
                box-shadow: inset 0 0 0 2px rgba(52, 199, 89, 0.2);
            }
            
            .ios-toggle input:checked + .ios-slider:before {
                transform: translateX(20px);
            }
            
            .ios-toggle:hover .ios-slider {
                box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.15), 0 0 0 4px rgba(52, 199, 89, 0.1);
            }
            
            .ios-toggle input:checked:hover + .ios-slider {
                box-shadow: inset 0 0 0 2px rgba(52, 199, 89, 0.3), 0 0 0 4px rgba(52, 199, 89, 0.15);
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
        
        // Infinite scroll
        this.resultsContainer.addEventListener('scroll', () => {
            this.handleScroll();
        });
        
        // Settings panel
        this.settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showSettings();
        });
        
        this.closeSettingsButton.addEventListener('click', () => {
            this.hideSettings();
        });
        
        // API key input
        this.apiKeyInput.addEventListener('input', () => {
            const hasKey = this.apiKeyInput.value.trim().length > 0;
            this.testApiKeyButton.disabled = !hasKey;
            this.apiKeyStatus.textContent = '';
            this.apiKeyStatus.className = 'api-key-status';
        });
        
        this.testApiKeyButton.addEventListener('click', () => {
            this.testApiKey();
        });
        
        // Save API key on blur
        this.apiKeyInput.addEventListener('blur', () => {
            this.saveApiKey();
        });
        
        // AI optimization toggle
        this.aiOptimizationToggle.addEventListener('change', () => {
            this.saveAiOptimizationSetting();
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
        
        // Load recent history if no search query
        if (!this.searchInput.value.trim()) {
            this.loadRecentHistory();
        }
    }
    
    hide() {
        if (!this.isVisible) return;
        
        this.overlay.classList.remove('visible');
        this.isVisible = false;
        
        // Hide any screenshot previews
        this.hideScreenshotPreview();
        
        setTimeout(() => {
            this.overlay.style.display = 'none';
            document.body.style.overflow = '';
        }, 200);
        
        // Clear search
        this.searchInput.value = '';
        this.resultsContainer.innerHTML = '';
        this.selectedIndex = -1;
        this.currentResults = [];
        this.currentQuery = '';
        this.currentPage = 0;
        this.hasMoreResults = true;
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
        
        // Reset pagination
        this.currentPage = 0;
        this.hasMoreResults = true;
        this.currentQuery = query.trim();
        
        if (!this.currentQuery) {
            this.loadRecentHistory();
            return;
        }
        
        // Show loading
        this.resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.performSearch(this.currentQuery);
        }, 300);
    }
    
    async performSearch(query, append = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            // Send search request to background script
            const response = await chrome.runtime.sendMessage({
                type: 'SEARCH_HISTORY',
                query: query,
                page: this.currentPage,
                limit: this.resultsPerPage
            });
            
            if (response && response.success) {
                if (append) {
                    this.appendResults(response.results);
                } else {
                    this.displayResults(response.results);
                }
                
                // Check if there are more results
                this.hasMoreResults = response.results.length === this.resultsPerPage;
            } else {
                if (!append) {
                    this.displayNoResults();
                }
            }
        } catch (error) {
            console.error('Search error:', error);
            if (!append) {
                this.displayError();
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    async loadRecentHistory() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.resultsContainer.innerHTML = '<div class="loading">Loading recent history...</div>';
        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_RECENT_HISTORY',
                page: this.currentPage,
                limit: this.resultsPerPage
            });
            
            if (response && response.success) {
                this.displayResults(response.results);
                this.hasMoreResults = response.results.length === this.resultsPerPage;
            } else {
                this.displayNoResults();
            }
        } catch (error) {
            console.error('Error loading recent history:', error);
            this.displayError();
        } finally {
            this.isLoading = false;
        }
    }
    
    handleScroll() {
        if (this.isLoading || !this.hasMoreResults) return;
        
        const container = this.resultsContainer;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Load more when user is near the bottom (within 100px)
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            this.loadMoreResults();
        }
    }
    
    async loadMoreResults() {
        if (this.isLoading || !this.hasMoreResults) return;
        
        this.currentPage++;
        
        // Add loading indicator at bottom
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-more';
        loadingDiv.innerHTML = '<div class="loading">Loading more...</div>';
        this.resultsContainer.appendChild(loadingDiv);
        
        if (this.currentQuery) {
            await this.performSearch(this.currentQuery, true);
        } else {
            await this.loadMoreRecentHistory();
        }
        
        // Remove loading indicator
        loadingDiv.remove();
    }
    
    async loadMoreRecentHistory() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_RECENT_HISTORY',
                page: this.currentPage,
                limit: this.resultsPerPage
            });
            
            if (response && response.success) {
                this.appendResults(response.results);
                this.hasMoreResults = response.results.length === this.resultsPerPage;
            }
        } catch (error) {
            console.error('Error loading more recent history:', error);
        } finally {
            this.isLoading = false;
        }
    }
    
    displayResults(results) {
        this.currentResults = results;
        this.selectedIndex = -1;
        
        if (results.length === 0) {
            this.displayNoResults();
            return;
        }
        
        // Add test screenshot to first result for testing
        if (results.length > 0 && !results[0].screenshot) {
            results[0].screenshot = this.generateTestScreenshot();
        }
        
        const html = results.map((result, index) => `
            <div class="search-result" data-url="${result.url}" data-index="${index}">
                <div class="result-favicon">
                    ${result.favicon ? `<img src="${result.favicon}" width="16" height="16" alt="">` : this.getGenericFavicon(result.url)}
                </div>
                <div class="result-content">
                    <div class="result-title-line">
                        <span class="result-title">${this.escapeHtml(result.title || 'Untitled')}</span>
                        <span class="result-url">${this.getSimplifiedUrl(result.url)}</span>
                    </div>
                </div>
                <div class="result-date">${this.formatDate(result.visitDate)}</div>
            </div>
        `).join('');
        
        this.resultsContainer.innerHTML = html;
        this.attachResultEventListeners();
    }
    
    appendResults(results) {
        if (results.length === 0) return;
        
        const newResults = results.filter(result => 
            !this.currentResults.some(existing => existing.url === result.url)
        );
        
        this.currentResults = [...this.currentResults, ...newResults];
        
        const html = newResults.map((result, index) => {
            const globalIndex = this.currentResults.length - newResults.length + index;
            return `
                <div class="search-result" data-url="${result.url}" data-index="${globalIndex}">
                    <div class="result-favicon">
                        ${result.favicon ? `<img src="${result.favicon}" width="16" height="16" alt="">` : this.getGenericFavicon(result.url)}
                    </div>
                    <div class="result-content">
                        <div class="result-title-line">
                            <span class="result-title">${this.escapeHtml(result.title || 'Untitled')}</span>
                            <span class="result-url">${this.getSimplifiedUrl(result.url)}</span>
                        </div>
                    </div>
                    <div class="result-date">${this.formatDate(result.visitDate)}</div>
                </div>
            `;
        }).join('');
        
        this.resultsContainer.insertAdjacentHTML('beforeend', html);
        this.attachResultEventListeners();
    }
    
    attachResultEventListeners() {
        const results = this.resultsContainer.querySelectorAll('.search-result');
        results.forEach((result, index) => {
            // Remove existing listeners to avoid duplicates
            result.removeEventListener('mouseenter', result._mouseEnterHandler);
            result.removeEventListener('mousemove', result._mouseMoveHandler);
            result.removeEventListener('mouseleave', result._mouseLeaveHandler);
            result.removeEventListener('click', result._clickHandler);
            
            let hoverTimeout;
            
            // Create new handlers
            result._mouseEnterHandler = (e) => {
                // Clear any existing timeout
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                }
                
                // Set delay before showing preview (300ms as per PRD)
                hoverTimeout = setTimeout(() => {
                    const resultData = this.currentResults[index];
                    if (resultData && resultData.screenshot) {
                        this.showScreenshotPreview(resultData.screenshot, result, e);
                    }
                }, 300);
                
                this.selectedIndex = index;
                this.updateSelection();
            };
            
            result._mouseMoveHandler = (e) => {
                // Update preview position as mouse moves within the row
                const existingPreview = document.getElementById('screenshot-preview');
                if (existingPreview && existingPreview.classList.contains('visible')) {
                    this.updatePreviewPosition(existingPreview, result, e);
                }
            };
            
            result._mouseLeaveHandler = () => {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
                this.hideScreenshotPreview();
            };
            
            result._clickHandler = () => {
                this.openUrl(result.dataset.url);
            };
            
            // Attach new listeners
            result.addEventListener('mouseenter', result._mouseEnterHandler);
            result.addEventListener('mousemove', result._mouseMoveHandler);
            result.addEventListener('mouseleave', result._mouseLeaveHandler);
            result.addEventListener('click', result._clickHandler);
        });
        
        // Handle mouse leaving the entire results container
        this.resultsContainer.removeEventListener('mouseleave', this.resultsContainer._mouseLeaveHandler);
        this.resultsContainer._mouseLeaveHandler = () => {
            this.selectedIndex = -1;
            this.updateSelection();
            this.hideScreenshotPreview();
        };
        this.resultsContainer.addEventListener('mouseleave', this.resultsContainer._mouseLeaveHandler);
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
    
    getSimplifiedUrl(url) {
        try {
            const urlObj = new URL(url);
            let hostname = urlObj.hostname;
            
            // Remove www. prefix
            if (hostname.startsWith('www.')) {
                hostname = hostname.substring(4);
            }
            
            return hostname;
        } catch {
            return url;
        }
    }
    
    formatDate(timestamp) {
        if (!timestamp) {
            return '';
        }
        
        // Handle both timestamp numbers and ISO date strings
        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            return '';
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
        
        let result;
        if (diffDays === 0) {
            result = timeStr; // Just time for today
        } else if (diffDays === 1) {
            result = `Yesterday - ${timeStr}`;
        } else {
            // For older dates: "5 Jun - 21:34"
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = date.getDate();
            const month = monthNames[date.getMonth()];
            result = `${day} ${month} - ${timeStr}`;
        }
        
        return result;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Screenshot Preview Functions
    showScreenshotPreview(screenshot, resultDiv, mouseEvent) {
        // Remove any existing preview
        this.hideScreenshotPreview();
        
        const previewContainer = document.createElement('div');
        previewContainer.className = 'screenshot-preview-container';
        previewContainer.id = 'screenshot-preview';
        
        // Show loading state first
        previewContainer.innerHTML = `
            <div class="screenshot-preview-loading">Loading preview...</div>
        `;
        
        document.body.appendChild(previewContainer);
        
        // Position the preview
        this.positionPreviewAtMouse(previewContainer, resultDiv, mouseEvent, 100); // Initial height
        
        // Create image to get natural dimensions
        const img = new Image();
        img.onload = () => {
            const maxHeight = 200;
            const displayHeight = Math.min(img.naturalHeight, maxHeight);
            
            previewContainer.innerHTML = `
                <img src="${screenshot}" 
                     class="screenshot-preview-image"
                     style="height: ${displayHeight}px;" 
                     alt="Page preview">
            `;
            
            // Update position with actual image height
            this.positionPreviewAtMouse(previewContainer, resultDiv, mouseEvent, displayHeight);
            
            // Show with animation
            requestAnimationFrame(() => {
                previewContainer.classList.add('visible');
            });
        };
        
        img.onerror = () => {
            previewContainer.innerHTML = `
                <div class="screenshot-preview-loading">Preview unavailable</div>
            `;
            requestAnimationFrame(() => {
                previewContainer.classList.add('visible');
            });
        };
        
        img.src = screenshot;
    }
    
    positionPreviewAtMouse(previewContainer, resultDiv, mouseEvent, imageHeight) {
        const rowRect = resultDiv.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Get mouse position
        const mouseX = mouseEvent.clientX;
        
        // Calculate position
        const previewWidth = 250;
        const previewHeight = imageHeight + 20; // +20px for padding
        
        // Horizontal: Right of mouse cursor with small gap
        let left = mouseX + 15; // 15px gap from cursor
        
        // Check if preview would go off-screen on the right
        if (left + previewWidth > viewportWidth - 10) {
            // Show on left side of mouse instead
            left = mouseX - previewWidth - 15;
        }
        
        // Vertical: Align with the row's vertical center
        const rowCenterY = rowRect.top + (rowRect.height / 2);
        let top = rowCenterY - (previewHeight / 2);
        
        // Ensure preview stays within viewport
        if (top < 10) {
            top = 10;
        } else if (top + previewHeight > viewportHeight - 10) {
            top = viewportHeight - previewHeight - 10;
        }
        
        // Apply positioning
        previewContainer.style.left = `${left}px`;
        previewContainer.style.top = `${top}px`;
    }
    
    updatePreviewPosition(previewContainer, resultDiv, mouseEvent) {
        const viewportWidth = window.innerWidth;
        const mouseX = mouseEvent.clientX;
        
        // Update horizontal position to follow mouse
        let left = mouseX + 15;
        
        if (left + 250 > viewportWidth - 10) {
            left = mouseX - 250 - 15;
        }
        
        previewContainer.style.left = `${left}px`;
        // Keep vertical position aligned with row (don't change top)
    }
    
    hideScreenshotPreview() {
        const existingPreview = document.getElementById('screenshot-preview');
        if (existingPreview) {
            existingPreview.classList.remove('visible');
            
            setTimeout(() => {
                if (existingPreview.parentNode) {
                    existingPreview.parentNode.removeChild(existingPreview);
                }
            }, 200);
        }
    }
    
    // Generate a test screenshot for development/testing
    generateTestScreenshot() {
        const canvas = document.createElement('canvas');
        canvas.width = 250;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        
        // Create a simple test image
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 250, 150);
        
        ctx.fillStyle = '#4285f4';
        ctx.fillRect(10, 10, 230, 40);
        
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText('Test Website Preview', 20, 35);
        
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText('This is a test screenshot preview', 20, 70);
        ctx.fillText('Hover functionality is working!', 20, 90);
        
        ctx.fillStyle = '#ddd';
        ctx.fillRect(20, 100, 60, 20);
        ctx.fillRect(90, 100, 60, 20);
        ctx.fillRect(160, 100, 60, 20);
        
        return canvas.toDataURL('image/png', 0.8);
    }
    
    showSettings() {
        this.settingsPanel.style.display = 'flex';
        // Trigger animation on next frame
        requestAnimationFrame(() => {
            this.settingsPanel.classList.add('visible');
        });
        this.loadStats();
    }
    
    hideSettings() {
        this.settingsPanel.classList.remove('visible');
        // Hide after animation completes
        setTimeout(() => {
            this.settingsPanel.style.display = 'none';
        }, 200);
    }
    
    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_SETTINGS'
            });
            
            if (response && response.success && response.settings) {
                const apiKey = response.settings.openaiApiKey;
                if (apiKey) {
                    // Show masked API key
                    this.apiKeyInput.value = '••••••••••••••••••••••••••••••••••••••••••••••••••••';
                    this.testApiKeyButton.disabled = false;
                    this.apiKeyStatus.textContent = 'API key configured';
                    this.apiKeyStatus.className = 'api-key-status success';
                }
                
                // Load AI optimization setting (default to true)
                const aiOptimization = response.settings.aiOptimization !== false;
                this.aiOptimizationToggle.checked = aiOptimization;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    async loadStats() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_STATS'
            });
            
            if (response && response.success && response.stats) {
                const pagesCount = document.getElementById('pages-count');
                const embeddingsCount = document.getElementById('embeddings-count');
                const lastUpdated = document.getElementById('last-updated');
                
                if (pagesCount) {
                    pagesCount.textContent = response.stats.totalPages || 0;
                }
                
                if (embeddingsCount) {
                    embeddingsCount.textContent = response.stats.totalEmbeddings || '-';
                }
                
                if (lastUpdated && response.stats.lastUpdate) {
                    const date = new Date(response.stats.lastUpdate);
                    lastUpdated.textContent = date.toLocaleDateString();
                } else if (lastUpdated) {
                    lastUpdated.textContent = 'Never';
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        
        // Don't save if it's the masked value
        if (apiKey.includes('••••')) {
            return;
        }
        
        if (!apiKey) {
            return;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SET_OPENAI_API_KEY',
                apiKey: apiKey
            });
            
            if (response && response.success) {
                this.apiKeyStatus.textContent = 'API key saved successfully';
                this.apiKeyStatus.className = 'api-key-status success';
                // Mask the key after saving
                this.apiKeyInput.value = '••••••••••••••••••••••••••••••••••••••••••••••••••••';
                this.testApiKeyButton.disabled = false;
            } else {
                this.apiKeyStatus.textContent = response.error || 'Failed to save API key';
                this.apiKeyStatus.className = 'api-key-status error';
            }
        } catch (error) {
            this.apiKeyStatus.textContent = 'Error saving API key';
            this.apiKeyStatus.className = 'api-key-status error';
        }
    }
    
    async testApiKey() {
        this.testApiKeyButton.textContent = 'Testing...';
        this.testApiKeyButton.disabled = true;
        this.apiKeyStatus.textContent = '';
        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_OPENAI_STATUS'
            });
            
            if (response && response.success) {
                this.apiKeyStatus.textContent = 'API key is working correctly';
                this.apiKeyStatus.className = 'api-key-status success';
            } else {
                this.apiKeyStatus.textContent = 'API key test failed';
                this.apiKeyStatus.className = 'api-key-status error';
            }
        } catch (error) {
            this.apiKeyStatus.textContent = 'Error testing API key';
            this.apiKeyStatus.className = 'api-key-status error';
        } finally {
            this.testApiKeyButton.textContent = 'Test';
            this.testApiKeyButton.disabled = false;
        }
    }
    
    async saveAiOptimizationSetting() {
        try {
            await chrome.runtime.sendMessage({
                type: 'SET_AI_OPTIMIZATION',
                enabled: this.aiOptimizationToggle.checked
            });
        } catch (error) {
            console.error('Error saving AI optimization setting:', error);
        }
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

// Page visit tracking for AI optimization
let pageVisitStartTime = Date.now();
let pageVisitTracked = false;

// Auto-extract content when page loads (for future processing)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(autoExtractContent, 2000); // Wait 2 seconds for dynamic content
    });
} else {
    setTimeout(autoExtractContent, 2000);
}

// Track page unload to measure time spent
window.addEventListener('beforeunload', () => {
    if (!pageVisitTracked) {
        const timeSpent = Date.now() - pageVisitStartTime;
        // Store time spent for potential AI processing
        chrome.runtime.sendMessage({
            type: 'PAGE_VISIT_TRACKED',
            url: window.location.href,
            timeSpent: timeSpent
        }).catch(() => {
            // Ignore errors during page unload
        });
        pageVisitTracked = true;
    }
});

// Also track on visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !pageVisitTracked) {
        const timeSpent = Date.now() - pageVisitStartTime;
        if (timeSpent > 30000) { // Only track if spent more than 30 seconds
            chrome.runtime.sendMessage({
                type: 'PAGE_VISIT_TRACKED',
                url: window.location.href,
                timeSpent: timeSpent
            }).catch(() => {
                // Ignore errors
            });
            pageVisitTracked = true;
        }
    }
});

// Check if page should be processed for AI embeddings
function shouldEmbedPage(pageData) {
    const url = pageData.url || window.location.href;
    const timeSpent = pageData.timeSpent || 0;
    const wordCount = pageData.wordCount || 0;
    
    // Must spend at least 30 seconds on page
    if (timeSpent < 30000) {
        return false;
    }
    
    // Must have substantial content (500+ words)
    if (wordCount < 500) {
        return false;
    }
    
    // Skip navigation pages
    if (isNavigationPage(url)) {
        return false;
    }
    
    // Skip search results pages
    if (isSearchResultsPage(url)) {
        return false;
    }
    
    // Skip login/auth pages
    if (isAuthPage(url)) {
        return false;
    }
    
    // Skip social media feeds and news aggregators
    if (isSocialMediaFeed(url) || isNewsAggregator(url)) {
        return false;
    }
    
    return true;
}

function isNavigationPage(url) {
    const navigationPatterns = [
        /\/sitemap/i,
        /\/navigation/i,
        /\/menu/i,
        /\/index\.html?$/i,
        /\/$/, // Root pages
        /\/category\//i,
        /\/tag\//i,
        /\/archive/i
    ];
    
    return navigationPatterns.some(pattern => pattern.test(url));
}

function isSearchResultsPage(url) {
    const searchPatterns = [
        /[?&]q=/i,
        /[?&]search=/i,
        /[?&]query=/i,
        /\/search\//i,
        /\/results\//i,
        /google\.com\/search/i,
        /bing\.com\/search/i,
        /duckduckgo\.com/i
    ];
    
    return searchPatterns.some(pattern => pattern.test(url));
}

function isAuthPage(url) {
    const authPatterns = [
        /\/login/i,
        /\/signin/i,
        /\/signup/i,
        /\/register/i,
        /\/auth/i,
        /\/password/i,
        /\/forgot/i,
        /\/reset/i,
        /\/verify/i,
        /\/oauth/i
    ];
    
    return authPatterns.some(pattern => pattern.test(url));
}

function isSocialMediaFeed(url) {
    const socialPatterns = [
        /twitter\.com\/home/i,
        /facebook\.com\/$/i,
        /instagram\.com\/$/i,
        /linkedin\.com\/feed/i,
        /reddit\.com\/$/i,
        /reddit\.com\/r\/[^\/]+\/?$/i, // Subreddit main pages
        /tiktok\.com\/$/i
    ];
    
    return socialPatterns.some(pattern => pattern.test(url));
}

function isNewsAggregator(url) {
    const newsPatterns = [
        /news\.ycombinator\.com\/$/i,
        /reddit\.com\/r\/all/i,
        /reddit\.com\/popular/i,
        /digg\.com\/$/i,
        /slashdot\.org\/$/i
    ];
    
    return newsPatterns.some(pattern => pattern.test(url));
}

// Automatically extract content for processing
function autoExtractContent() {
    if (!shouldProcessPage()) return;
    
    const extractedContent = extractPageContent();
    if (extractedContent) {
        // Calculate word count for AI optimization
        const wordCount = extractedContent.content.split(/\s+/).length;
        extractedContent.wordCount = wordCount;
        
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