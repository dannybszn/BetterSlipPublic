// Documentation search functionality
class DocumentationSearch {
    constructor() {
        this.searchInputs = document.querySelectorAll('.docs-search');
        this.searchableContent = [];
        this.currentResults = [];
        this.init();
    }

    init() {
        this.loadSearchIndex();
        this.setupEventListeners();
    }

    loadSearchIndex() {
        // Use the global search index if available
        if (typeof SEARCH_INDEX !== 'undefined') {
            this.searchableContent = SEARCH_INDEX;
        } else {
            // Fallback to indexing current page
            this.indexContent();
        }
    }

    indexContent() {
        // Index all headings and their content
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headings.forEach(heading => {
            const headingText = heading.textContent.trim();
            const headingLevel = parseInt(heading.tagName.substring(1));
            
            // Get the content following this heading until the next heading of same or higher level
            let content = '';
            let currentElement = heading.nextElementSibling;
            
            while (currentElement) {
                const nextHeading = currentElement.querySelector('h1, h2, h3, h4, h5, h6');
                const isHeading = currentElement.matches('h1, h2, h3, h4, h5, h6');
                
                if (isHeading) {
                    const nextLevel = parseInt(currentElement.tagName.substring(1));
                    if (nextLevel <= headingLevel) break;
                }
                
                if (nextHeading) {
                    const nextLevel = parseInt(nextHeading.tagName.substring(1));
                    if (nextLevel <= headingLevel) break;
                }
                
                // Extract text content, excluding script and style elements
                const textContent = this.getTextContent(currentElement);
                if (textContent) {
                    content += ' ' + textContent;
                }
                
                currentElement = currentElement.nextElementSibling;
            }

            // Create search index entry
            this.searchableContent.push({
                title: headingText,
                content: content.trim(),
                element: heading,
                level: headingLevel,
                url: window.location.pathname + '#' + (heading.id || this.generateId(headingText))
            });
        });

        // Also index navigation items
        const navItems = document.querySelectorAll('.docs-nav a');
        navItems.forEach(link => {
            this.searchableContent.push({
                title: link.textContent.trim(),
                content: 'Navigation: ' + link.textContent.trim(),
                element: link,
                level: 0,
                url: link.href,
                isNavigation: true
            });
        });
    }

    getTextContent(element) {
        // Clone the element to avoid modifying the original
        const clone = element.cloneNode(true);
        
        // Remove script and style elements
        const scriptsAndStyles = clone.querySelectorAll('script, style');
        scriptsAndStyles.forEach(el => el.remove());
        
        // Get text content and clean it up
        let text = clone.textContent || clone.innerText || '';
        
        // Clean up extra whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        return text;
    }

    generateId(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
    }

    setupEventListeners() {
        this.searchInputs.forEach(input => {
            // Wrap input in a container if not already wrapped
            if (!input.parentElement.classList.contains('search-container')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'search-container';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
            }

            input.addEventListener('input', this.debounce((e) => {
                this.performSearch(e.target.value);
            }, 300));

            input.addEventListener('focus', () => {
                if (input.value.length >= 2) {
                    this.performSearch(input.value);
                }
            });

            input.addEventListener('keydown', (e) => {
                this.handleKeyNavigation(e);
            });
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSearchResults();
            }
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    performSearch(query) {
        if (!query || query.length < 2) {
            this.hideSearchResults();
            return;
        }

        const normalizedQuery = query.toLowerCase();
        const queryWords = normalizedQuery.split(/\s+/);
        const results = [];

        this.searchableContent.forEach(item => {
            let score = 0;
            const titleLower = item.title.toLowerCase();
            const contentLower = item.content.toLowerCase();
            
            // Check for exact phrase match
            const exactTitleMatch = titleLower.includes(normalizedQuery);
            const exactContentMatch = contentLower.includes(normalizedQuery);
            
            // Check for all words present
            const allWordsInTitle = queryWords.every(word => titleLower.includes(word));
            const allWordsInContent = queryWords.every(word => contentLower.includes(word));
            
            // Score calculation
            if (exactTitleMatch) {
                score += titleLower.indexOf(normalizedQuery) === 0 ? 20 : 15;
            } else if (allWordsInTitle) {
                score += 10;
            }
            
            if (exactContentMatch) {
                score += 5;
            } else if (allWordsInContent) {
                score += 2;
            }
            
            // Bonus for category match
            if (item.category && item.category.toLowerCase().includes(normalizedQuery)) {
                score += 3;
            }

            if (score > 0) {
                results.push({
                    ...item,
                    score,
                    titleMatch: exactTitleMatch || allWordsInTitle,
                    contentMatch: exactContentMatch || allWordsInContent
                });
            }
        });

        // Sort by score (highest first)
        results.sort((a, b) => b.score - a.score);
        
        // Limit results
        this.currentResults = results.slice(0, 10);
        this.displaySearchResults(this.currentResults, query);
    }

    displaySearchResults(results, query) {
        this.searchInputs.forEach(input => {
            let container = input.parentElement.querySelector('.search-results');
            
            if (!container) {
                container = document.createElement('div');
                container.className = 'search-results';
                input.parentElement.appendChild(container);
            }

            if (results.length === 0) {
                container.innerHTML = `
                    <div class="search-result-item no-results">
                        <div class="search-result-title">No results found</div>
                        <div class="search-result-content">Try different keywords</div>
                    </div>
                `;
            } else {
                container.innerHTML = results.map((result, index) => `
                    <div class="search-result-item ${index === 0 ? 'highlighted' : ''}" data-url="${result.url}">
                        <div class="search-result-title">
                            ${this.highlightText(result.title, query)}
                            ${result.category ? `<span class="nav-badge">${result.category}</span>` : ''}
                        </div>
                        <div class="search-result-content">
                            ${this.highlightText(this.truncateText(result.content, 120), query)}
                        </div>
                    </div>
                `).join('');

                // Add click handlers to results
                container.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const url = item.dataset.url;
                        if (url) {
                            window.location.href = url;
                        }
                    });
                });
            }

            container.style.display = 'block';
        });
    }

    highlightText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        
        const truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        
        return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
    }

    showSearchResults() {
        this.searchInputs.forEach(input => {
            const container = input.parentElement.querySelector('.search-results');
            if (container && this.currentResults.length > 0) {
                container.style.display = 'block';
            }
        });
    }

    hideSearchResults() {
        this.searchInputs.forEach(input => {
            const container = input.parentElement.querySelector('.search-results');
            if (container) {
                container.style.display = 'none';
            }
        });
    }

    handleKeyNavigation(e) {
        const container = e.target.parentElement.querySelector('.search-results');
        if (!container || container.style.display === 'none') return;

        const items = container.querySelectorAll('.search-result-item:not(.no-results)');
        const highlighted = container.querySelector('.search-result-item.highlighted');
        
        let currentIndex = highlighted ? Array.from(items).indexOf(highlighted) : -1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, items.length - 1);
                this.updateHighlight(items, currentIndex);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                this.updateHighlight(items, currentIndex);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (highlighted) {
                    highlighted.click();
                } else if (e.target.value.length >= 2) {
                    // If no item is highlighted but there's a search query, perform the search
                    this.performSearch(e.target.value);
                }
                break;
                
            case 'Escape':
                this.hideSearchResults();
                e.target.blur();
                break;
        }
    }

    updateHighlight(items, index) {
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === index);
        });
    }
}

// Initialize search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DocumentationSearch();
});

// CSS for search results (injected via JavaScript)
const searchStyles = `
.search-container {
    position: relative;
    width: 100%;
}

.search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    z-index: 1000;
    max-height: 420px;
    overflow-y: auto;
    display: none;
    animation: searchDropdown 0.2s ease-out;
}

@keyframes searchDropdown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.search-result-item {
    padding: 14px 18px;
    border-bottom: 1px solid #f1f3f4;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.search-result-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: transparent;
    transition: background 0.2s ease;
}

.search-result-item:last-child {
    border-bottom: none;
    border-radius: 0 0 10px 10px;
}

.search-result-item:first-child {
    border-radius: 10px 10px 0 0;
}

.search-result-item:hover {
    background-color: #f8f9fa;
    padding-left: 22px;
}

.search-result-item:hover::before {
    background: #C5B358;
}

.search-result-item.highlighted {
    background-color: #fff8e1;
    border-left: 3px solid #C5B358;
    padding-left: 18px;
}

.search-result-item.highlighted::before {
    background: #C5B358;
}

.search-result-item.no-results {
    cursor: default;
    color: #6c757d;
    text-align: center;
    padding: 24px;
    font-style: italic;
}

.search-result-item.no-results:hover {
    background-color: transparent;
    padding-left: 24px;
}

.search-result-item.no-results::before {
    display: none;
}

.search-result-title {
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    line-height: 1.3;
}

.search-result-content {
    color: #6c757d;
    font-size: 13px;
    line-height: 1.5;
    margin-left: 0;
}

.nav-badge {
    background: linear-gradient(135deg, #C5B358 0%, #d4c167 100%);
    color: #000;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(197, 179, 88, 0.2);
}

.search-result-item mark {
    background: linear-gradient(135deg, #fff2cc 0%, #ffeb99 100%);
    color: #1a1a1a;
    padding: 2px 4px;
    border-radius: 4px;
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(197, 179, 88, 0.2);
}

.docs-search {
    position: relative;
    transition: all 0.2s ease;
}

.docs-search:focus {
    transform: scale(1.02);
}

.docs-sidebar {
    position: relative;
}

.search-results::-webkit-scrollbar {
    width: 8px;
}

.search-results::-webkit-scrollbar-track {
    background: #f8f9fa;
    border-radius: 4px;
}

.search-results::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #C5B358 0%, #d4c167 100%);
    border-radius: 4px;
    border: 1px solid #fff;
}

.search-results::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #B3A147 0%, #c2ae5a 100%);
}

.search-results::-webkit-scrollbar-corner {
    background: #f8f9fa;
}

/* Search input enhancement */
.docs-search:focus {
    border-color: #C5B358;
    box-shadow: 0 0 0 4px rgba(197, 179, 88, 0.15);
    outline: none;
}

/* Search result loading state */
.search-results.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60px;
    color: #6c757d;
    font-style: italic;
}

/* Better spacing and typography */
.search-result-title:not(:only-child) {
    margin-bottom: 8px;
}

.search-result-content:empty {
    display: none;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = searchStyles;
document.head.appendChild(styleSheet);