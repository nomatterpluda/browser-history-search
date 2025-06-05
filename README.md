# Browser History Search - Chrome Extension

A Chrome extension that enables semantic search of browsing history using natural language queries. Find previously visited pages by describing their content rather than remembering exact keywords or URLs.

## Features

- 🔍 **Semantic Search**: Search your browsing history using natural language descriptions
- ⚡ **Instant Results**: Real-time search with debounced input
- 🎯 **Relevance Ranking**: Results ranked by semantic similarity
- 🖼️ **Visual Previews**: Hover previews of pages (coming soon)
- 🔒 **Privacy First**: All data stored locally on your machine

## Installation

### Development Setup

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the project directory
5. The extension should now appear in your Chrome toolbar

### Testing the Extension

1. Click the extension icon in your Chrome toolbar
2. Try searching with natural language queries like:
   - "that article about productivity tips"
   - "the website with elegant fonts"
   - "documentation about React hooks"

## Project Structure

```
browser-history-search/
├── manifest.json          # Extension configuration
├── popup.html            # Search interface
├── popup.css             # Styling
├── popup.js              # Frontend logic
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Development Status

This is the initial setup phase. Current functionality:

- ✅ Basic Chrome extension structure
- ✅ Popup interface with search input
- ✅ Background script foundation
- ✅ Mock search results
- 🚧 Chrome History API integration (next phase)
- 🚧 OpenAI embeddings integration (next phase)
- 🚧 Semantic search implementation (next phase)

## Tech Stack

- **Frontend**: JavaScript/TypeScript
- **Browser APIs**: Chrome Extensions API, Chrome History API
- **Storage**: Chrome Local Storage + IndexedDB
- **AI Service**: OpenAI Embeddings API
- **Preview System**: Dynamic iframe loading

## Next Steps

1. **Phase 1**: Core Infrastructure
   - Add Chrome History API integration
   - Implement local storage functionality
   - Add required permissions

2. **Phase 2**: Content Processing
   - Content extraction from web pages
   - OpenAI API integration
   - Data processing pipeline

3. **Phase 3**: Search Functionality
   - Semantic search implementation
   - Results display enhancement
   - Performance optimization

## Contributing

This project follows a phased development approach. Each feature is implemented incrementally and tested before moving to the next phase.

## License

MIT License - see LICENSE file for details 