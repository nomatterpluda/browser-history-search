# Browser History Search - Chrome Extension

A Chrome extension that enables semantic search of browsing history using natural language queries. Find previously visited pages by describing their content rather than remembering exact keywords or URLs.

## ✨ Features

- 🔍 **Semantic Search**: Search your browsing history using natural language descriptions powered by OpenAI embeddings
- ⚡ **Instant Results**: Real-time search with intelligent text matching and semantic similarity
- 🎯 **Precision Ranking**: Advanced scoring system with configurable thresholds for accurate results
- 🖼️ **Visual Previews**: Hover over results to see live screenshot previews of pages
- 📄 **Content Extraction**: Automatically extracts and indexes page content for comprehensive search
- 🔒 **Privacy First**: All data stored locally on your machine - no browsing data sent to external servers
- 🎨 **Modern UI**: Clean, responsive interface with smooth animations
- ⚙️ **Smart Management**: Automatic storage cleanup and intelligent content processing

## 🚀 Installation

### For Users

1. Download the latest release from the [Releases](https://github.com/nomatterpluda/browser-history-search/releases) page
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the downloaded extension folder
5. The extension should now appear in your Chrome toolbar

### For Developers

1. Clone this repository:
   ```bash
   git clone https://github.com/nomatterpluda/browser-history-search.git
   cd browser-history-search
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the project directory
5. The extension should now appear in your Chrome toolbar

## 🔧 Setup

### OpenAI API Configuration (Optional)

For enhanced semantic search capabilities:

1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Click the extension icon and go to Settings
3. Enter your API key and test the connection
4. The extension will automatically generate embeddings for better search results

**Note**: The extension works without an API key using intelligent text matching, but semantic search provides more accurate results for natural language queries.

## 🎯 Usage

### Basic Search
1. Click the extension icon in your Chrome toolbar
2. Type natural language queries like:
   - "electric car article" → finds Tesla-related pages
   - "WWDC presentation" → finds Apple developer content
   - "productivity tips blog post"
   - "that font website with serif fonts"

### Visual Previews
- Hover over any search result to see a live screenshot preview
- Previews appear after 300ms with smooth fade-in animation
- Smart positioning keeps previews within the popup bounds

### Content Management
- The extension automatically extracts content from pages you visit
- View extraction statistics in the popup
- Storage is automatically managed with cleanup of old items

## 📁 Project Structure

```
browser-history-search/
├── manifest.json          # Extension configuration
├── popup.html            # Search interface
├── popup.css             # Styling and animations
├── popup.js              # Frontend logic and UI
├── background.js         # Service worker and API integration
├── content.js            # Content extraction script
├── icons/                # Extension icons
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 🛠️ Tech Stack

- **Frontend**: JavaScript with modern ES6+ features
- **Browser APIs**: Chrome Extensions API, Chrome History API, Chrome Tabs API
- **Storage**: Chrome Local Storage for efficient data management
- **AI Service**: OpenAI Embeddings API (text-embedding-ada-002)
- **Preview System**: Screenshot capture with automatic thumbnail generation
- **Architecture**: Manifest V3 with service worker background script

## 🎨 Key Features in Detail

### Intelligent Search Algorithm
- **Text Matching**: Advanced scoring system with exact matches, phrase matches, and partial matches
- **Semantic Search**: OpenAI embeddings with cosine similarity for natural language understanding
- **Smart Thresholds**: Different precision requirements for titles, content, and URLs
- **Query Processing**: Automatic stop word removal and term filtering

### Visual Preview System
- **Screenshot Capture**: Automatic capture of visited pages with 2-second load delay
- **Thumbnail Generation**: Efficient compression using ImageBitmap and OffscreenCanvas APIs
- **Smart Fallbacks**: Graceful handling of blocked content and CORS restrictions
- **Smooth Animations**: CSS transitions with hover delays and fade effects

### Content Processing
- **Automatic Extraction**: Intelligent content filtering excluding ads, navigation, and scripts
- **Rate Limiting**: Respectful API usage with retry logic and error handling
- **Storage Management**: Automatic cleanup keeping the 100 most recent items
- **Performance Optimization**: Debounced search with 300ms delay

## 🔒 Privacy & Security

- **Local Storage**: All browsing data and extracted content stored locally
- **API Key Security**: Secure storage with masked display in settings
- **Minimal Permissions**: Only requests necessary Chrome extension permissions
- **No Data Sharing**: Browsing history never leaves your machine (except for OpenAI embeddings)

## 📊 Performance

- **Search Speed**: <500ms response time for most queries
- **Storage Efficiency**: Intelligent compression and cleanup
- **Memory Usage**: Optimized data structures and garbage collection
- **API Costs**: Minimal usage with local caching (~$0.01 per 1000 pages)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 Development Process

This project was developed using a phased approach with incremental testing:

1. **Phase 1**: Core infrastructure and Chrome APIs integration
2. **Phase 2**: OpenAI API integration and embeddings generation
3. **Phase 3**: Content extraction and processing pipeline
4. **Phase 4**: Visual preview system with screenshot capture
5. **Phase 5**: Search precision improvements and advanced scoring

## 🐛 Known Issues

- Some websites (Google, YouTube) may block iframe previews - fallback to content snippets is provided
- Screenshot capture requires page to be the active tab
- OpenAI API rate limits may affect batch processing of large history sets

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- OpenAI for providing the embeddings API
- Chrome Extensions team for comprehensive documentation
- The open-source community for inspiration and best practices

---

**Made with ❤️ for better browsing experiences** 