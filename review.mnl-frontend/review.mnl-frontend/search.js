// Search functionality for Review.Mnl

// --- Shared filter state ---
var _searchQuery = '';
var _activeCategories = [];
var _activeRating = null;
var _allCenters = []; // populated from API

// --- Filter persistence (localStorage) ---
const FILTER_STORAGE_KEY = 'rmnl_applied_filters';

// Save filter state to localStorage
function saveFilterState() {
    const filterState = {
        categories: _activeCategories,
        rating: _activeRating,
        savedAt: new Date().toISOString()
    };
    try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
    } catch (e) {
        console.warn('Failed to save filter state:', e);
    }
}

// Load filter state from localStorage
function loadFilterState() {
    try {
        const stored = localStorage.getItem(FILTER_STORAGE_KEY);
        if (stored) {
            const filterState = JSON.parse(stored);
            _activeCategories = filterState.categories || [];
            _activeRating = filterState.rating || null;
            return true;
        }
    } catch (e) {
        console.warn('Failed to load filter state:', e);
    }
    return false;
}

// Clear saved filters from localStorage
function clearSavedFilters() {
    try {
        localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (e) {
        console.warn('Failed to clear saved filters:', e);
    }
}

// Display applied filters
function updateAppliedFiltersDisplay() {
    let appliedFiltersContainer = document.getElementById('appliedFiltersDisplay');
    
    // Create container if it doesn't exist
    if (!appliedFiltersContainer) {
        const body = document.querySelector('.body');
        if (!body) return;
        
        appliedFiltersContainer = document.createElement('div');
        appliedFiltersContainer.id = 'appliedFiltersDisplay';
        appliedFiltersContainer.className = 'applied-filters-display';
        
        const filterSection = document.querySelector('.filter-container');
        if (filterSection) {
            body.insertBefore(appliedFiltersContainer, filterSection.nextSibling);
        } else {
            body.insertBefore(appliedFiltersContainer, body.firstChild);
        }
    }
    
    // Build filter tags
    let tagsHtml = '';
    
    if (_activeCategories.length > 0) {
        _activeCategories.forEach(function(cat) {
            tagsHtml += '<span class="filter-tag">' + escHtml(cat) + 
                '<button class="filter-tag-remove" data-type="category" data-value="' + 
                escHtml(cat) + '" aria-label="Remove ' + escHtml(cat) + '">×</button></span>';
        });
    }
    
    if (_activeRating) {
        tagsHtml += '<span class="filter-tag">' + escHtml(_activeRating) + 
            '<button class="filter-tag-remove" data-type="rating" aria-label="Remove rating filter">×</button></span>';
    }
    
    if (tagsHtml) {
        appliedFiltersContainer.innerHTML = 
            '<div class="applied-filters-header">' +
                '<strong>Applied Filters:</strong> ' +
                '<span class="applied-filters-tags">' + tagsHtml + '</span>' +
                '<button class="clear-all-filters-btn">Clear All</button>' +
            '</div>';
        appliedFiltersContainer.style.display = 'block';
        
        // Attach event listeners to remove buttons
        appliedFiltersContainer.querySelectorAll('.filter-tag-remove').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const type = this.getAttribute('data-type');
                const value = this.getAttribute('data-value');
                
                if (type === 'category') {
                    _activeCategories = _activeCategories.filter(function(c) { return c !== value; });
                    // Deactivate button in UI
                    const categoryBtn = Array.from(document.querySelectorAll('.filter-btn'))
                        .find(function(btn) { return btn.textContent.trim().toLowerCase() === value.toLowerCase(); });
                    if (categoryBtn) categoryBtn.classList.remove('active');
                } else if (type === 'rating') {
                    _activeRating = null;
                    // Deactivate button in UI
                    document.querySelectorAll('.filter-btn.active').forEach(function(btn) {
                        const isRatingBtn = btn.textContent.includes('★');
                        if (isRatingBtn) btn.classList.remove('active');
                    });
                }
                
                saveFilterState();
                updateAppliedFiltersDisplay();
                applyAllFilters();
            });
        });
        
        // Clear all button
        const clearAllBtn = appliedFiltersContainer.querySelector('.clear-all-filters-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', function(e) {
                e.preventDefault();
                _activeCategories = [];
                _activeRating = null;
                clearSavedFilters();
                document.querySelectorAll('.filter-btn.active').forEach(function(btn) {
                    btn.classList.remove('active');
                });
                updateAppliedFiltersDisplay();
                applyAllFilters();
            });
        }
    } else {
        appliedFiltersContainer.style.display = 'none';
    }
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------
function starString(rating) {
    const r = Math.round(rating || 0);
    return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function buildCard(center) {
    const div = document.createElement('div');
    div.className = 'result-card';
    div.setAttribute('data-id', center.id);
    div.setAttribute('data-category', (center.category || '').trim());
    // Map backend field avg_rating to avg_rating for display
    const rating = center.avg_rating !== undefined ? center.avg_rating : center.average_rating;
    div.setAttribute('data-rating', Math.round(rating || 0));
    div.style.cursor = 'pointer';

    // Map backend field business_name to display name
    const centerName = center.business_name || center.name || 'Unnamed Center';
    const centerDesc = center.description || '';
    
    div.innerHTML =
        '<div class="result-image"></div>' +
        '<div class="result-content">' +
            '<h3>' + escHtml(centerName) + '</h3>' +
            '<p class="result-location">' + escHtml(center.address || '') + '</p>' +
            '<p class="result-description">' + escHtml(centerDesc) + '</p>' +
            '<div class="result-rating">' + starString(rating) +
                ' <span style="font-size:0.8em;color:#555;">' +
                (rating ? Number(rating).toFixed(1) : 'No ratings') +
                '</span>' +
            '</div>' +
        '</div>';

    div.addEventListener('click', function() {
        window.location.href = 'viewcenter.html?id=' + center.id;
    });
    return div;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Load centers from API then render
// ---------------------------------------------------------------------------
async function loadCenters() {
    const container = document.getElementById('resultsContainer');
    const loadingMsg = document.getElementById('loadingMsg');
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const q = urlParams.get('q') || '';
        let centers;
        if (q) {
            centers = await CentersAPI.search(q);
        } else {
            centers = await CentersAPI.getAll();
        }
        _allCenters = Array.isArray(centers) ? centers : (centers.centers || []);
    } catch (err) {
        if (loadingMsg) loadingMsg.textContent = 'Failed to load centers. Is the server running?';
        return;
    }

    if (loadingMsg) loadingMsg.remove();
    _allCenters.forEach(function(c) { container.appendChild(buildCard(c)); });
    applyAllFilters();
}

// ---------------------------------------------------------------------------
// Filter / search (operates on rendered cards)
// ---------------------------------------------------------------------------
function applyAllFilters() {
    const cards = Array.from(document.querySelectorAll('.result-card'));
    let visibleCount = 0;
    cards.forEach(function(card) {
        const name = (card.querySelector('h3') ? card.querySelector('h3').textContent : '').toLowerCase();
        const location = (card.querySelector('.result-location') ? card.querySelector('.result-location').textContent : '').toLowerCase();
        const desc = (card.querySelector('.result-description') ? card.querySelector('.result-description').textContent : '').toLowerCase();
        const cardCategory = (card.getAttribute('data-category') || '').trim();
        const cardRating = parseInt(card.getAttribute('data-rating') || '0', 10);

        // Search match
        const q = _searchQuery.toLowerCase().trim();
        const searchMatch = !q || name.includes(q) || location.includes(q) || desc.includes(q);

        // Category match
        const categoryMatch = _activeCategories.length === 0 ||
            _activeCategories.map(function(c){ return c.toLowerCase(); }).includes(cardCategory.toLowerCase());

        // Rating match
        var ratingMatch = true;
        if (_activeRating) {
            const m = _activeRating.match(/^(\d+)/);
            const minRating = m ? parseInt(m[1], 10) : 0;
            ratingMatch = cardRating >= minRating;
        }

        const visible = searchMatch && categoryMatch && ratingMatch;
        card.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
    });

    // No results message
    var noResults = document.getElementById('noResultsMsg');
    if (!noResults) {
        noResults = document.createElement('p');
        noResults.id = 'noResultsMsg';
        noResults.style.cssText = 'color:#6b7280;font-size:0.95rem;padding:24px 0;text-align:center;width:100%;';
        noResults.textContent = 'No review centers found.';
        var container = document.querySelector('.results-container');
        if (container) container.appendChild(noResults);
    }
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
}

// Handle search form submission
function handleSearch(event) {
    event.preventDefault();
    const path = window.location.pathname;
    const isIndexPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
    if (isIndexPage) {
        window.location.href = 'login.html';
        return;
    }
    const searchInput = event.target.querySelector('input[name="search"]');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    if (searchQuery) {
        window.location.href = 'search.html?q=' + encodeURIComponent(searchQuery);
    }
}

// Handle search icon click
function handleSearchIconClick(searchForm) {
    const path = window.location.pathname;
    const isIndexPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
    if (isIndexPage) {
        window.location.href = 'login.html';
        return;
    }
    const searchInput = searchForm.querySelector('input[name="search"]');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    if (searchQuery) {
        window.location.href = 'search.html?q=' + encodeURIComponent(searchQuery);
    }
}

// Populate search box from URL and trigger filter
function displaySearchResults() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q') || '';
    const categoryParam = urlParams.get('category') || '';

    // Restore search query
    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput && searchQuery) {
        searchInput.value = searchQuery;
        _searchQuery = searchQuery;
    }

    // Auto-activate matching category filter button
    if (categoryParam) {
        const catSection = Array.from(document.querySelectorAll('.filter-section'))
            .find(function(s){ const h = s.querySelector('h2,p'); return h && h.textContent.trim().toLowerCase().includes('category'); });
        if (catSection) {
            const filterContainer = document.getElementById('filterContainer');
            const arrow = document.getElementById('filterArrow');
            if (filterContainer) { filterContainer.style.display = 'block'; }
            if (arrow) { arrow.textContent = 'keyboard_arrow_up'; }

            const btns = Array.from(catSection.querySelectorAll('.filter-btn'));
            btns.forEach(function(btn) {
                if (btn.textContent.trim().toLowerCase() === categoryParam.toLowerCase()) {
                    btn.classList.add('active');
                }
            });
            _activeCategories = Array.from(catSection.querySelectorAll('.filter-btn.active'))
                .map(function(b){ return b.textContent.trim(); });
        }
    }
}

// Initialize filter interactions
function initFilters() {
    // Load previously saved filters from localStorage
    const hasSavedFilters = loadFilterState();
    
    const filterSections = document.querySelectorAll('.filter-section');

    filterSections.forEach(function(section) {
        const titleEl = section.querySelector('h2, p');
        if (!titleEl) return;
        const title = titleEl.textContent.trim().toLowerCase();
        const buttons = Array.from(section.querySelectorAll('.filter-btn'));

        if (title.includes('category')) {
            buttons.forEach(function(btn) {
                // Restore active state if saved
                if (hasSavedFilters && _activeCategories.includes(btn.textContent.trim())) {
                    btn.classList.add('active');
                }
                
                btn.addEventListener('click', function() {
                    btn.classList.toggle('active');
                    _activeCategories = Array.from(section.querySelectorAll('.filter-btn.active'))
                        .map(function(b){ return b.textContent.trim(); });
                    saveFilterState();
                    updateClearState();
                    updateAppliedFiltersDisplay();
                });
                // Add Enter key support to filter buttons
                btn.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        btn.click();
                    }
                });
            });
        }

        if (title.includes('ratings')) {
            buttons.forEach(function(btn) {
                // Restore active state if saved
                if (hasSavedFilters && btn.textContent.trim() === _activeRating) {
                    btn.classList.add('active');
                }
                
                btn.addEventListener('click', function() {
                    buttons.forEach(function(b){ b.classList.remove('active'); });
                    btn.classList.add('active');
                    _activeRating = btn.textContent.trim();
                    saveFilterState();
                    updateClearState();
                    updateAppliedFiltersDisplay();
                });
                // Add Enter key support to rating buttons
                btn.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        btn.click();
                    }
                });
            });
        }
    });

    function updateClearState() {
        const clearBtnLocal = document.getElementById('clearFiltersBtn');
        if (!clearBtnLocal) return;
        const anyActive = !!document.querySelector('.filter-btn.active');
        clearBtnLocal.disabled = !anyActive;
    }

    const applyBtn = document.getElementById('applyFiltersBtn');
    const clearBtn = document.getElementById('clearFiltersBtn');
    const popup = document.getElementById('filterPopup');
    const popupContent = document.getElementById('filterPopupContent');
    const closeBtn = document.getElementById('filterPopupClose');

    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            const catSection = Array.from(document.querySelectorAll('.filter-section'))
                .find(function(s){ const h = s.querySelector('h2,p'); return h && h.textContent.trim().toLowerCase().includes('category'); });
            _activeCategories = catSection
                ? Array.from(catSection.querySelectorAll('.filter-btn.active')).map(function(b){ return b.textContent.trim(); })
                : [];

            const ratingSection = Array.from(document.querySelectorAll('.filter-section'))
                .find(function(s){ const h = s.querySelector('h2,p'); return h && h.textContent.trim().toLowerCase().includes('ratings'); });
            const activeRatingBtn = ratingSection ? ratingSection.querySelector('.filter-btn.active') : null;
            _activeRating = activeRatingBtn ? activeRatingBtn.textContent.trim() : null;

            saveFilterState();
            updateAppliedFiltersDisplay();
            applyAllFilters();

            if (_activeCategories.length === 0 && !_activeRating) {
                popupContent.innerHTML = '<p class="popup-no-filters">No filters selected.</p>';
            } else {
                let html = '';
                if (_activeCategories.length > 0) {
                    html += '<p style="color:#555;font-size:13px;margin-bottom:8px;"><strong>Categories:</strong></p>';
                    html += _activeCategories.map(function(c){ return '<span class="filter-tag">' + c + '</span>'; }).join('');
                }
                if (_activeRating) {
                    html += '<p style="color:#555;font-size:13px;margin:14px 0 8px;"><strong>Rating:</strong></p>';
                    html += '<span class="filter-tag rating-tag">' + _activeRating + '</span>';
                }
                popupContent.innerHTML = html;
            }
            popup.style.display = 'flex';
        });
        // Add Enter key support to Apply Filters button
        applyBtn.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyBtn.click();
            }
        });
    }

    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn.active').forEach(function(b){ b.classList.remove('active'); });
            _activeCategories = [];
            _activeRating = null;
            clearSavedFilters();
            updateAppliedFiltersDisplay();
            if (popup) popup.style.display = 'none';
            updateClearState();
            applyAllFilters();
        });
        // Add Enter key support to Clear Filters button
        clearBtn.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearBtn.click();
            }
        });
    }

    // Add Enter key support to filter container for quicker filtering
    const filterContainer = document.getElementById('filterContainer');
    if (filterContainer) {
        filterContainer.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (applyBtn) {
                    applyBtn.click();
                }
            }
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', function(){ if (popup) popup.style.display = 'none'; });
    if (popup) popup.addEventListener('click', function(e){ if (e.target === popup) popup.style.display = 'none'; });

    updateClearState();
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Wire search forms
    const searchForms = document.querySelectorAll('.search-form');
    searchForms.forEach(function(form) {
        form.addEventListener('submit', handleSearch);
        const searchIcon = form.querySelector('.search-icon');
        if (searchIcon) searchIcon.addEventListener('click', function(){ handleSearchIconClick(form); });

        const searchInput = form.querySelector('input[name="search"]');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                _searchQuery = searchInput.value;
                applyAllFilters();
            });
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = searchInput.value.trim();
                    if (query) {
                        window.location.href = 'search.html?q=' + encodeURIComponent(query);
                    }
                }
            });
        }
    });

    if (window.location.pathname.includes('search.html')) {
        displaySearchResults();
        loadCenters();
    }
    initFilters();
    updateAppliedFiltersDisplay();
    applyAllFilters();
});

function applyAllFilters() {
    const cards = Array.from(document.querySelectorAll('.result-card'));
    let visibleCount = 0;
    cards.forEach(function(card) {
        const name = (card.querySelector('h3') ? card.querySelector('h3').textContent : '').toLowerCase();
        const location = (card.querySelector('.result-location') ? card.querySelector('.result-location').textContent : '').toLowerCase();
        const desc = (card.querySelector('.result-description') ? card.querySelector('.result-description').textContent : '').toLowerCase();
        const cardCategory = (card.getAttribute('data-category') || '').trim();
        const cardRating = parseInt(card.getAttribute('data-rating') || '0', 10);

        // Search match
        const q = _searchQuery.toLowerCase().trim();
        const searchMatch = !q || name.includes(q) || location.includes(q) || desc.includes(q);

        // Category match
        const categoryMatch = _activeCategories.length === 0 ||
            _activeCategories.map(function(c){ return c.toLowerCase(); }).includes(cardCategory.toLowerCase());

        // Rating match
        var ratingMatch = true;
        if (_activeRating) {
            const m = _activeRating.match(/^(\d+)/);
            const minRating = m ? parseInt(m[1], 10) : 0;
            ratingMatch = cardRating >= minRating;
        }

        const visible = searchMatch && categoryMatch && ratingMatch;
        card.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
    });

    // No results message
    var noResults = document.getElementById('noResultsMsg');
    if (!noResults) {
        noResults = document.createElement('p');
        noResults.id = 'noResultsMsg';
        noResults.style.cssText = 'color:#6b7280;font-size:0.95rem;padding:24px 0;text-align:center;width:100%;';
        noResults.textContent = 'No review centers found.';
        var container = document.querySelector('.results-container');
        if (container) container.appendChild(noResults);
    }
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
}

// Handle search form submission
function handleSearch(event) {
    event.preventDefault();
    const path = window.location.pathname;
    const isIndexPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
    if (isIndexPage) {
        window.location.href = 'login.html';
        return;
    }
    const searchInput = event.target.querySelector('input[name="search"]');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    if (searchQuery) {
        window.location.href = 'search.html?q=' + encodeURIComponent(searchQuery);
    }
}

// Handle search icon click
function handleSearchIconClick(searchForm) {
    const path = window.location.pathname;
    const isIndexPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
    if (isIndexPage) {
        window.location.href = 'login.html';
        return;
    }
    const searchInput = searchForm.querySelector('input[name="search"]');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    if (searchQuery) {
        window.location.href = 'search.html?q=' + encodeURIComponent(searchQuery);
    }
}

// Populate search box from URL and trigger filter
function displaySearchResults() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q') || '';
    const categoryParam = urlParams.get('category') || '';

    // Restore search query
    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput && searchQuery) {
        searchInput.value = searchQuery;
        _searchQuery = searchQuery;
    }

    // Auto-activate matching category filter button
    if (categoryParam) {
        const catSection = Array.from(document.querySelectorAll('.filter-section'))
            .find(function(s){ const h = s.querySelector('h2,p'); return h && h.textContent.trim().toLowerCase().includes('category'); });
        if (catSection) {
            // Open the filter panel so the active state is visible
            const filterContainer = document.getElementById('filterContainer');
            const arrow = document.getElementById('filterArrow');
            if (filterContainer) { filterContainer.style.display = 'block'; }
            if (arrow) { arrow.textContent = 'keyboard_arrow_up'; }

            const btns = Array.from(catSection.querySelectorAll('.filter-btn'));
            btns.forEach(function(btn) {
                if (btn.textContent.trim().toLowerCase() === categoryParam.toLowerCase()) {
                    btn.classList.add('active');
                }
            });
            _activeCategories = Array.from(catSection.querySelectorAll('.filter-btn.active'))
                .map(function(b){ return b.textContent.trim(); });
        }
    }

    applyAllFilters();
}

// Initialize filter interactions
function initFilters() {
    const filterSections = document.querySelectorAll('.filter-section');

    filterSections.forEach(function(section) {
        const titleEl = section.querySelector('h2, p');
        if (!titleEl) return;
        const title = titleEl.textContent.trim().toLowerCase();
        const buttons = Array.from(section.querySelectorAll('.filter-btn'));

        if (title.includes('category')) {
            buttons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    btn.classList.toggle('active');
                    _activeCategories = Array.from(section.querySelectorAll('.filter-btn.active'))
                        .map(function(b){ return b.textContent.trim(); });
                    updateClearState();
                });
            });
        }

        if (title.includes('ratings')) {
            buttons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    buttons.forEach(function(b){ b.classList.remove('active'); });
                    btn.classList.add('active');
                    _activeRating = btn.textContent.trim();
                    updateClearState();
                });
            });
        }
    });

    function updateClearState() {
        const clearBtnLocal = document.getElementById('clearFiltersBtn');
        if (!clearBtnLocal) return;
        const anyActive = !!document.querySelector('.filter-btn.active');
        clearBtnLocal.disabled = !anyActive;
    }

    const applyBtn = document.getElementById('applyFiltersBtn');
    const popup = document.getElementById('filterPopup');
    const popupContent = document.getElementById('filterPopupContent');
    const closeBtn = document.getElementById('filterPopupClose');

    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            // Update categories from active buttons
            const catSection = Array.from(document.querySelectorAll('.filter-section'))
                .find(function(s){ const h = s.querySelector('h2,p'); return h && h.textContent.trim().toLowerCase().includes('category'); });
            _activeCategories = catSection
                ? Array.from(catSection.querySelectorAll('.filter-btn.active')).map(function(b){ return b.textContent.trim(); })
                : [];

            const ratingSection = Array.from(document.querySelectorAll('.filter-section'))
                .find(function(s){ const h = s.querySelector('h2,p'); return h && h.textContent.trim().toLowerCase().includes('ratings'); });
            const activeRatingBtn = ratingSection ? ratingSection.querySelector('.filter-btn.active') : null;
            _activeRating = activeRatingBtn ? activeRatingBtn.textContent.trim() : null;

            applyAllFilters();

            // Build popup
            if (_activeCategories.length === 0 && !_activeRating) {
                popupContent.innerHTML = '<p class="popup-no-filters">No filters selected.</p>';
            } else {
                let html = '';
                if (_activeCategories.length > 0) {
                    html += '<p style="color:#555;font-size:13px;margin-bottom:8px;"><strong>Categories:</strong></p>';
                    html += _activeCategories.map(function(c){ return '<span class="filter-tag">' + c + '</span>'; }).join('');
                }
                if (_activeRating) {
                    html += '<p style="color:#555;font-size:13px;margin:14px 0 8px;"><strong>Rating:</strong></p>';
                    html += '<span class="filter-tag rating-tag">' + _activeRating + '</span>';
                }
                popupContent.innerHTML = html;
            }
            popup.style.display = 'flex';
        });
    }

    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn.active').forEach(function(b){ b.classList.remove('active'); });
            _activeCategories = [];
            _activeRating = null;
            if (popup) popup.style.display = 'none';
            updateClearState();
            applyAllFilters();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', function(){ if (popup) popup.style.display = 'none'; });
    if (popup) popup.addEventListener('click', function(e){ if (e.target === popup) popup.style.display = 'none'; });

    updateClearState();
}

// Make result cards clickable
function initClickableCards() {
    document.querySelectorAll('.result-card').forEach(function(card) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function() {
            window.location.href = 'viewcenter.html';
        });
    });
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Wire search forms
    const searchForms = document.querySelectorAll('.search-form');
    searchForms.forEach(function(form) {
        form.addEventListener('submit', handleSearch);
        const searchIcon = form.querySelector('.search-icon');
        if (searchIcon) searchIcon.addEventListener('click', function(){ handleSearchIconClick(form); });

        const searchInput = form.querySelector('input[name="search"]');
        if (searchInput) {
            // Live search on input
            searchInput.addEventListener('input', function() {
                _searchQuery = searchInput.value;
                applyAllFilters();
            });
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); }
            });
        }
    });

    if (window.location.pathname.includes('search.html')) displaySearchResults();
    initFilters();
    initClickableCards();
});
