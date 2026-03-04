// Search functionality for Review.Mnl

// --- Shared filter state ---
var _searchQuery = '';
var _activeCategories = [];
var _activeRating = null;

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
