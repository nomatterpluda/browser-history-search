// DOM elements
const searchInput = document.getElementById('searchInput');
const loadingState = document.getElementById('loadingState');
const resultsContainer = document.getElementById('resultsContainer');
const noResults = document.getElementById('noResults');

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
});

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

// Perform search (placeholder implementation)
async function performSearch(query) {
    console.log('Searching for:', query);
    
    showLoadingState();
    
    try {
        // TODO: Implement actual search functionality
        // For now, simulate search delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Placeholder results
        const mockResults = [
            {
                title: 'Example Search Result',
                snippet: 'This is a placeholder result for the search query: ' + query,
                url: 'https://example.com',
                visitDate: new Date().toISOString(),
                favicon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMUE3M0U4Ii8+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5FPC90ZXh0Pgo8L3N2Zz4K'
            }
        ];
        
        displayResults(mockResults);
        
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
            <img class="result-favicon" src="${result.favicon}" alt="favicon">
            <span>${relativeDate}</span>
        </div>
    `;
    
    // Add click handler to open URL
    resultDiv.addEventListener('click', () => {
        chrome.tabs.create({ url: result.url });
        window.close();
    });
    
    return resultDiv;
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